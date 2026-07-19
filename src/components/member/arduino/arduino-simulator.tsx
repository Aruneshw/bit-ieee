"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { CPU, avrInstruction, AVRIOPort, portBConfig, portCConfig, portDConfig, AVRTimer, timer0Config, timer1Config, timer2Config, AVRUSART, usart0Config } from "avr8js";
import type { BoardState, PinState } from "./arduino-board";

/* ================================================================
 * ArduinoSimulator — AVR8js simulation engine wrapper
 * ================================================================
 * Loads compiled Intel HEX into an ATmega328P CPU simulation.
 * Maps AVR port registers to virtual hardware (LEDs, buttons, etc.)
 * Provides serial output capture for the serial monitor.
 * ================================================================ */

interface SimulatorControls {
  start: (hex: string) => void;
  stop: () => void;
  reset: () => void;
  sendSerial: (data: string) => void;
  isRunning: boolean;
  boardState: BoardState;
  serialOutput: string[];
}

interface UseSimulatorOptions {
  onSerialOutput?: (line: string) => void;
  onStateChange?: (state: BoardState) => void;
  clockSpeed?: number; // Hz, default 16MHz
}

/**
 * Parse an Intel HEX string into a Uint8Array program buffer
 */
function parseHex(hexString: string): Uint8Array {
  const lines = hexString.trim().split("\n").map(l => l.trim()).filter(l => l.startsWith(":"));
  // Determine the max address to size the buffer
  let maxAddr = 0;
  for (const line of lines) {
    const byteCount = parseInt(line.substring(1, 3), 16);
    const address = parseInt(line.substring(3, 7), 16);
    const recordType = parseInt(line.substring(7, 9), 16);
    if (recordType === 0) {
      maxAddr = Math.max(maxAddr, address + byteCount);
    }
  }

  const buffer = new Uint8Array(Math.max(maxAddr, 0x8000)); // At least 32KB

  for (const line of lines) {
    const byteCount = parseInt(line.substring(1, 3), 16);
    const address = parseInt(line.substring(3, 7), 16);
    const recordType = parseInt(line.substring(7, 9), 16);

    if (recordType === 0) {
      // Data record
      for (let i = 0; i < byteCount; i++) {
        buffer[address + i] = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
      }
    } else if (recordType === 1) {
      // End of file
      break;
    }
  }

  return buffer;
}

/**
 * Map AVR pin numbers to Arduino pin numbers
 * Arduino Uno (ATmega328P) pin mapping:
 *   Digital 0-7  → PORTD (PD0-PD7)
 *   Digital 8-13 → PORTB (PB0-PB5)
 *   Analog A0-A5 → PORTC (PC0-PC5)
 */
function portPinToArduinoPin(port: string, bit: number): number | null {
  switch (port) {
    case "D": return bit; // 0-7
    case "B": return 8 + bit; // 8-13 (only bits 0-5 used)
    case "C": return 14 + bit; // A0-A5 (14-19)
    default: return null;
  }
}

const EMPTY_BOARD_STATE: BoardState = {
  pins: {},
  running: false,
};

export function useArduinoSimulator(options: UseSimulatorOptions = {}): SimulatorControls {
  const { onSerialOutput, onStateChange, clockSpeed = 16_000_000 } = options;

  const cpuRef = useRef<CPU | null>(null);
  const animFrameRef = useRef<number>(0);
  const [isRunning, setIsRunning] = useState(false);
  const [boardState, setBoardState] = useState<BoardState>(EMPTY_BOARD_STATE);
  const [serialOutput, setSerialOutput] = useState<string[]>([]);
  const serialBufferRef = useRef<string>("");

  // Pin state tracking
  const pinStatesRef = useRef<Record<number, PinState>>({});
  const buttonStatesRef = useRef<Record<number, boolean>>({});

  const updateBoardState = useCallback(() => {
    const newState: BoardState = {
      pins: { ...pinStatesRef.current },
      running: true,
    };
    setBoardState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  const stop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    cpuRef.current = null;
    setIsRunning(false);
    setBoardState((prev) => ({ ...prev, running: false }));
  }, []);

  const start = useCallback(
    (hex: string) => {
      // Stop any existing simulation
      stop();

      try {
        // Parse HEX into program memory
        const program = parseHex(hex);
        const programWords = new Uint16Array(program.buffer);

        // Create CPU
        const cpu = new CPU(programWords);
        cpuRef.current = cpu;

        // Setup IO Ports
        const portB = new AVRIOPort(cpu, portBConfig);
        const portC = new AVRIOPort(cpu, portCConfig);
        const portD = new AVRIOPort(cpu, portDConfig);

        // Setup timers
        new AVRTimer(cpu, timer0Config);
        new AVRTimer(cpu, timer1Config);
        new AVRTimer(cpu, timer2Config);

        // Setup USART (Serial)
        const usart = new AVRUSART(cpu, usart0Config, clockSpeed);

        // Listen for serial output
        usart.onByteTransmit = (byte: number) => {
          const char = String.fromCharCode(byte);
          serialBufferRef.current += char;

          if (char === "\n") {
            const line = serialBufferRef.current.trimEnd();
            serialBufferRef.current = "";
            setSerialOutput((prev) => [...prev.slice(-500), line]); // Cap at 500 lines
            onSerialOutput?.(line);
          }
        };

        // Pin state listeners
        const handlePortWrite = (port: string) => (value: number, oldValue: number) => {
          for (let bit = 0; bit < 8; bit++) {
            const arduinoPin = portPinToArduinoPin(port, bit);
            if (arduinoPin === null) continue;

            const isHigh = (value & (1 << bit)) !== 0;
            const wasHigh = (oldValue & (1 << bit)) !== 0;

            if (isHigh !== wasHigh) {
              pinStatesRef.current[arduinoPin] = {
                mode: "output",
                value: isHigh ? 1 : 0,
              };
            }
          }
        };

        portB.addListener(handlePortWrite("B"));
        portC.addListener(handlePortWrite("C"));
        portD.addListener(handlePortWrite("D"));

        // Button input injection
        const setButtonState = (pin: number, pressed: boolean) => {
          buttonStatesRef.current[pin] = pressed;
          // For pull-up inputs, pressed = LOW
          if (pin >= 0 && pin <= 7) {
            // Port D
            const bit = pin;
            if (pressed) {
              portD.setPin(bit, false); // Active LOW
            } else {
              portD.setPin(bit, true); // Pull-up HIGH
            }
          }
        };

        // Store button handler
        (cpu as unknown as Record<string, unknown>)._setButton = setButtonState;

        // Reset pin states
        pinStatesRef.current = {};
        serialBufferRef.current = "";
        setSerialOutput([]);
        setIsRunning(true);

        // CPU execution loop
        const cyclesToRun = clockSpeed / 60; // ~16MHz / 60fps
        let lastUpdate = performance.now();

        const runFrame = () => {
          if (!cpuRef.current) return;

          const now = performance.now();
          const elapsed = now - lastUpdate;
          lastUpdate = now;

          // Run CPU cycles proportional to elapsed time
          const cycles = Math.min(
            Math.floor((elapsed / 1000) * clockSpeed),
            cyclesToRun * 2 // Cap at 2x to prevent spiral
          );

          for (let i = 0; i < cycles; i++) {
            avrInstruction(cpu);
            cpu.tick();
          }

          // Update board visualization
          updateBoardState();

          animFrameRef.current = requestAnimationFrame(runFrame);
        };

        animFrameRef.current = requestAnimationFrame(runFrame);
      } catch (err) {
        console.error("Simulator error:", err);
        stop();
      }
    },
    [stop, clockSpeed, onSerialOutput, updateBoardState]
  );

  const reset = useCallback(() => {
    const cpu = cpuRef.current;
    if (cpu) {
      // Re-init by restarting with same program
      stop();
      pinStatesRef.current = {};
      setSerialOutput([]);
      setBoardState(EMPTY_BOARD_STATE);
    }
  }, [stop]);

  const sendSerial = useCallback((data: string) => {
    const cpu = cpuRef.current;
    if (!cpu) return;

    // Write bytes to USART receive buffer
    for (const char of data) {
      const udr0 = 0xc6; // UDR0 register address
      cpu.writeData(udr0, char.charCodeAt(0));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Button press/release handlers (exposed via boardState for the board component)
  const handleButtonPress = useCallback((pin: number) => {
    const cpu = cpuRef.current;
    if (!cpu) return;
    const setButton = (cpu as unknown as Record<string, unknown>)._setButton as
      | ((pin: number, pressed: boolean) => void)
      | undefined;
    setButton?.(pin, true);
  }, []);

  const handleButtonRelease = useCallback((pin: number) => {
    const cpu = cpuRef.current;
    if (!cpu) return;
    const setButton = (cpu as unknown as Record<string, unknown>)._setButton as
      | ((pin: number, pressed: boolean) => void)
      | undefined;
    setButton?.(pin, false);
  }, []);

  return {
    start,
    stop,
    reset,
    sendSerial,
    isRunning,
    boardState: {
      ...boardState,
      running: isRunning,
    },
    serialOutput,
    // Expose button handlers
    handleButtonPress,
    handleButtonRelease,
  } as SimulatorControls & {
    handleButtonPress: (pin: number) => void;
    handleButtonRelease: (pin: number) => void;
  };
}
