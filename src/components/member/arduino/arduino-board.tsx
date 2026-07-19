"use client";

import { memo, useMemo, useCallback, useRef, useEffect, useState } from "react";

/* ================================================================
 * ArduinoBoard — High-resolution interactive SVG Arduino Uno R3
 * ================================================================
 * Renders:
 *   • 14 digital pins (0–13) with LED indicators
 *   • 6 analog pins (A0–A5)
 *   • 2 pushbuttons on pins 2 & 3
 *   • 16×2 LCD display (pins 4–9 area)
 *   • Buzzer indicator on pin 11
 *   • Power rail (5V, 3.3V, GND)
 *   • USB & barrel jack connectors
 *   • ATmega328P chip outline
 * ================================================================ */

export interface PinState {
  mode: "input" | "output" | "pwm" | "unset";
  value: number; // 0 or 1 for digital, 0-255 for PWM
}

export interface BoardState {
  pins: Record<number, PinState>;
  lcdText?: [string, string]; // [row0, row1]
  buzzerFrequency?: number;
  running: boolean;
}

interface ArduinoBoardProps {
  boardState: BoardState;
  onButtonPress?: (pin: number) => void;
  onButtonRelease?: (pin: number) => void;
}

const DEFAULT_PIN: PinState = { mode: "unset", value: 0 };

function getPin(state: BoardState, pin: number): PinState {
  return state.pins[pin] || DEFAULT_PIN;
}

function getLedColor(pin: PinState, pinNum: number): string {
  if (pin.mode === "unset" || pin.value === 0) return "#1a2332";
  // Special colors for traffic light pins
  if (pinNum === 11) return "#ff4444"; // Red
  if (pinNum === 12) return "#ffaa00"; // Yellow
  if (pinNum === 13) return "#00ff88"; // Green (built-in LED)
  // PWM brightness
  if (pin.mode === "pwm") {
    const brightness = pin.value / 255;
    return `rgba(0, 191, 255, ${0.3 + brightness * 0.7})`;
  }
  return "#00bfff"; // Default blue
}

function getLedGlow(pin: PinState, pinNum: number): string {
  if (pin.mode === "unset" || pin.value === 0) return "none";
  const color = getLedColor(pin, pinNum);
  return `0 0 8px ${color}, 0 0 16px ${color}40`;
}

const ArduinoBoard = memo(function ArduinoBoard({
  boardState,
  onButtonPress,
  onButtonRelease,
}: ArduinoBoardProps) {
  const [btn2Pressed, setBtn2Pressed] = useState(false);
  const [btn3Pressed, setBtn3Pressed] = useState(false);
  const buzzerRef = useRef<OscillatorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Handle buzzer via Web Audio API
  useEffect(() => {
    const freq = boardState.buzzerFrequency;
    if (freq && freq > 0 && boardState.running) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      if (!buzzerRef.current) {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        gain.gain.value = 0.05;
        osc.type = "square";
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        buzzerRef.current = osc;
      }
      buzzerRef.current.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
    } else {
      if (buzzerRef.current) {
        buzzerRef.current.stop();
        buzzerRef.current = null;
      }
    }
    return () => {
      if (buzzerRef.current) {
        buzzerRef.current.stop();
        buzzerRef.current = null;
      }
    };
  }, [boardState.buzzerFrequency, boardState.running]);

  const handleButton = useCallback(
    (pin: number, pressed: boolean) => {
      if (pin === 2) setBtn2Pressed(pressed);
      if (pin === 3) setBtn3Pressed(pressed);
      if (pressed) onButtonPress?.(pin);
      else onButtonRelease?.(pin);
    },
    [onButtonPress, onButtonRelease]
  );

  // Memoize pin states for rendering
  const digitalPins = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({ num: i, state: getPin(boardState, i) })),
    [boardState]
  );

  const lcdRow0 = boardState.lcdText?.[0] || "";
  const lcdRow1 = boardState.lcdText?.[1] || "";

  return (
    <div className="arduino-board-wrapper">
      <svg
        viewBox="0 0 680 480"
        xmlns="http://www.w3.org/2000/svg"
        className="arduino-board-svg"
      >
        <defs>
          {/* Board shadow */}
          <filter id="boardShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.4" />
          </filter>
          {/* LED glow */}
          <filter id="ledGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Chip pattern */}
          <pattern id="chipPattern" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="#1a1a2e" />
            <rect width="1" height="1" x="1" y="1" fill="#222240" />
          </pattern>
          {/* Pin gradient */}
          <linearGradient id="pinGold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d4a844" />
            <stop offset="100%" stopColor="#a07830" />
          </linearGradient>
          {/* USB gradient */}
          <linearGradient id="usbGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c0c0c0" />
            <stop offset="100%" stopColor="#888" />
          </linearGradient>
          {/* Board gradient */}
          <linearGradient id="boardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#006b6b" />
            <stop offset="50%" stopColor="#005a5a" />
            <stop offset="100%" stopColor="#004949" />
          </linearGradient>
        </defs>

        {/* === PCB Board === */}
        <rect
          x="20" y="20" width="640" height="440" rx="12"
          fill="url(#boardGrad)" stroke="#00897a" strokeWidth="2"
          filter="url(#boardShadow)"
        />
        {/* PCB traces (decorative) */}
        <g opacity="0.08" stroke="#00ff88" strokeWidth="0.5" fill="none">
          <path d="M40,100 H200 V200 H350" />
          <path d="M40,150 H180 V250 H400" />
          <path d="M500,80 V180 H400" />
          <path d="M550,120 V220 H450" />
          <path d="M100,350 H300 V400" />
          <path d="M150,380 H350 V420" />
        </g>

        {/* === Mounting Holes === */}
        {[[40, 40], [630, 40], [40, 430], [630, 430]].map(([x, y], i) => (
          <g key={`hole-${i}`}>
            <circle cx={x} cy={y} r="6" fill="#003d3d" stroke="#00897a" strokeWidth="1" />
            <circle cx={x} cy={y} r="3" fill="#0d1117" />
          </g>
        ))}

        {/* === USB-B Connector === */}
        <rect x="20" y="180" width="45" height="60" rx="3"
          fill="url(#usbGrad)" stroke="#666" strokeWidth="1.5" />
        <rect x="25" y="190" width="30" height="40" rx="2"
          fill="#555" stroke="#777" strokeWidth="0.5" />
        <text x="42" y="243" textAnchor="middle" fontSize="7" fill="#888"
          fontFamily="monospace">USB</text>

        {/* === Barrel Jack === */}
        <rect x="20" y="310" width="38" height="32" rx="3"
          fill="#333" stroke="#555" strokeWidth="1" />
        <circle cx="39" cy="326" r="8" fill="#222" stroke="#444" strokeWidth="1" />
        <circle cx="39" cy="326" r="3" fill="#111" />
        <text x="39" y="352" textAnchor="middle" fontSize="6" fill="#555"
          fontFamily="monospace">DC</text>

        {/* === Reset Button === */}
        <rect x="80" y="50" width="20" height="12" rx="2"
          fill="#cc4444" stroke="#aa3333" strokeWidth="0.5" />
        <text x="90" y="75" textAnchor="middle" fontSize="6" fill="#cc6666"
          fontFamily="monospace">RESET</text>

        {/* === ATmega328P Chip === */}
        <rect x="220" y="180" width="120" height="120" rx="4"
          fill="url(#chipPattern)" stroke="#333" strokeWidth="1.5" />
        {/* Chip orientation notch */}
        <circle cx="235" cy="195" r="5" fill="none" stroke="#444" strokeWidth="0.5" />
        {/* Chip label */}
        <text x="280" y="235" textAnchor="middle" fontSize="9" fill="#667"
          fontFamily="monospace" fontWeight="bold">ATmega</text>
        <text x="280" y="248" textAnchor="middle" fontSize="8" fill="#556"
          fontFamily="monospace">328P-PU</text>
        {/* Chip pins (left side) */}
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={`chipL-${i}`} x="215" y={185 + i * 8} width="8" height="3" rx="0.5"
            fill="url(#pinGold)" />
        ))}
        {/* Chip pins (right side) */}
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={`chipR-${i}`} x="337" y={185 + i * 8} width="8" height="3" rx="0.5"
            fill="url(#pinGold)" />
        ))}

        {/* === Power Header === */}
        <text x="110" y="108" fontSize="7" fill="#00ff88" fontFamily="monospace" opacity="0.6">
          POWER
        </text>
        {["RESET", "3.3V", "5V", "GND", "GND", "Vin"].map((label, i) => (
          <g key={`pwr-${i}`}>
            <rect x={110 + i * 22} y={112} width="14" height="14" rx="2"
              fill="#1a2332" stroke="url(#pinGold)" strokeWidth="1" />
            <text x={117 + i * 22} y={138} textAnchor="middle" fontSize="5.5" fill="#6a9"
              fontFamily="monospace">{label}</text>
          </g>
        ))}

        {/* === Digital Pin Headers (0–13) === */}
        <text x="380" y="48" fontSize="7" fill="#00ff88" fontFamily="monospace" opacity="0.6">
          DIGITAL (PWM~)
        </text>
        {digitalPins.map(({ num, state }) => {
          const x = 380 + (13 - num) * 19;
          const color = getLedColor(state, num);
          const isOn = state.value > 0 && state.mode !== "unset";
          return (
            <g key={`dpin-${num}`}>
              {/* Pin header */}
              <rect x={x} y={55} width="13" height="13" rx="2"
                fill="#1a2332" stroke="url(#pinGold)" strokeWidth="1" />
              {/* Pin label */}
              <text x={x + 6.5} y={80} textAnchor="middle" fontSize="6" fill="#6a9"
                fontFamily="monospace">
                {num}
              </text>
              {/* PWM indicator */}
              {[3, 5, 6, 9, 10, 11].includes(num) && (
                <text x={x + 6.5} y={87} textAnchor="middle" fontSize="4" fill="#555"
                  fontFamily="monospace">~</text>
              )}
              {/* LED indicator */}
              <circle
                cx={x + 6.5} cy={97} r="4"
                fill={color}
                stroke={isOn ? color : "#2a3442"}
                strokeWidth="1"
                filter={isOn ? "url(#ledGlow)" : undefined}
                className={isOn ? "arduino-led-on" : "arduino-led-off"}
              />
            </g>
          );
        })}

        {/* === Analog Pin Headers (A0–A5) === */}
        <text x="110" y="380" fontSize="7" fill="#00ff88" fontFamily="monospace" opacity="0.6">
          ANALOG IN
        </text>
        {["A0", "A1", "A2", "A3", "A4", "A5"].map((label, i) => (
          <g key={`apin-${i}`}>
            <rect x={110 + i * 22} y={388} width="14" height="14" rx="2"
              fill="#1a2332" stroke="url(#pinGold)" strokeWidth="1" />
            <text x={117 + i * 22} y={414} textAnchor="middle" fontSize="5.5" fill="#6a9"
              fontFamily="monospace">{label}</text>
          </g>
        ))}

        {/* === Interactive Buttons (Pins 2 & 3) === */}
        <g className="arduino-button-group">
          {/* Button on pin 2 */}
          <g
            onMouseDown={() => handleButton(2, true)}
            onMouseUp={() => handleButton(2, false)}
            onMouseLeave={() => btn2Pressed && handleButton(2, false)}
            style={{ cursor: "pointer" }}
          >
            <rect x="400" y="140" width="40" height="30" rx="4"
              fill={btn2Pressed ? "#00629B" : "#2a3442"} stroke="#3a4452" strokeWidth="1.5"
              className="arduino-btn-body" />
            <rect x="408" y="148" width="24" height="14" rx="2"
              fill={btn2Pressed ? "#004d7a" : "#1a2332"} />
            <text x="420" y="180" textAnchor="middle" fontSize="7" fill="#00bfff"
              fontFamily="monospace">BTN 2</text>
          </g>

          {/* Button on pin 3 */}
          <g
            onMouseDown={() => handleButton(3, true)}
            onMouseUp={() => handleButton(3, false)}
            onMouseLeave={() => btn3Pressed && handleButton(3, false)}
            style={{ cursor: "pointer" }}
          >
            <rect x="460" y="140" width="40" height="30" rx="4"
              fill={btn3Pressed ? "#00629B" : "#2a3442"} stroke="#3a4452" strokeWidth="1.5"
              className="arduino-btn-body" />
            <rect x="468" y="148" width="24" height="14" rx="2"
              fill={btn3Pressed ? "#004d7a" : "#1a2332"} />
            <text x="480" y="180" textAnchor="middle" fontSize="7" fill="#00bfff"
              fontFamily="monospace">BTN 3</text>
          </g>
        </g>

        {/* === 16×2 LCD Display === */}
        <g>
          <rect x="390" y="200" width="230" height="90" rx="6"
            fill="#1a2332" stroke="#2a3442" strokeWidth="2" />
          <rect x="400" y="210" width="210" height="70" rx="4"
            fill="#1a3a1a" stroke="#2a4a2a" strokeWidth="1" />
          {/* LCD backlight glow */}
          <rect x="402" y="212" width="206" height="66" rx="3"
            fill="#0a2a0a" opacity="0.8" />
          {/* LCD Row 0 */}
          <text x="410" y="242" fontSize="18" fill="#33ff33" fontFamily="monospace"
            opacity={lcdRow0 ? 1 : 0.15}>
            {lcdRow0 || "________________"}
          </text>
          {/* LCD Row 1 */}
          <text x="410" y="268" fontSize="18" fill="#33ff33" fontFamily="monospace"
            opacity={lcdRow1 ? 1 : 0.15}>
            {lcdRow1 || "________________"}
          </text>
          <text x="505" y="298" textAnchor="middle" fontSize="6" fill="#4a5a4a"
            fontFamily="monospace">LCD 16×2</text>
        </g>

        {/* === Buzzer (Pin 11) === */}
        <g>
          <circle cx="550" y="370" cy="370" r="22" fill="#1a2332" stroke="#2a3442" strokeWidth="1.5" />
          <circle cx="550" cy="370" r="16" fill="#222"
            className={boardState.buzzerFrequency && boardState.running ? "arduino-buzzer-active" : ""} />
          <circle cx="550" cy="370" r="3" fill="#333" />
          <text x="550" y="400" textAnchor="middle" fontSize="7" fill="#888"
            fontFamily="monospace">BUZZER</text>
          <text x="550" y="409" textAnchor="middle" fontSize="5" fill="#555"
            fontFamily="monospace">Pin 11</text>
        </g>

        {/* === Board Labels === */}
        <text x="340" y="440" textAnchor="middle" fontSize="14" fill="#00bfff"
          fontFamily="monospace" fontWeight="bold" opacity="0.3">
          ARDUINO UNO R3
        </text>
        {/* TX/RX indicators */}
        <g>
          <circle cx="130" y="55" cy="55" r="3" fill={getPin(boardState, 1).value ? "#ff4444" : "#2a3442"} />
          <text x="138" y="58" fontSize="5" fill="#ff6666" fontFamily="monospace">TX</text>
          <circle cx="155" cy="55" r="3" fill={getPin(boardState, 0).value ? "#00ff88" : "#2a3442"} />
          <text x="163" y="58" fontSize="5" fill="#66ff88" fontFamily="monospace">RX</text>
        </g>

        {/* === Status Indicator === */}
        <circle cx="90" cy="430" r="4"
          fill={boardState.running ? "#00ff88" : "#ff4444"}
          className={boardState.running ? "arduino-status-pulse" : ""} />
        <text x="100" y="433" fontSize="6" fill="#888" fontFamily="monospace">
          {boardState.running ? "RUNNING" : "STOPPED"}
        </text>
      </svg>
    </div>
  );
});

ArduinoBoard.displayName = "ArduinoBoard";
export default ArduinoBoard;
