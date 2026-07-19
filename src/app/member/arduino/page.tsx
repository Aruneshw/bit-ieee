"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useArduinoSimulator } from "@/components/member/arduino/arduino-simulator";
import SerialMonitor from "@/components/member/arduino/serial-monitor";
import { exampleSketches, type ExampleSketch } from "@/components/member/arduino/example-sketches";

// Dynamic imports for heavy components
const ArduinoEditor = dynamic(
  () => import("@/components/member/arduino/arduino-editor"),
  {
    ssr: false,
    loading: () => (
      <div className="arduino-editor-loading">
        <div className="arduino-editor-loading-spinner" />
        <span>Loading Editor...</span>
      </div>
    ),
  }
);

const ArduinoBoard = dynamic(
  () => import("@/components/member/arduino/arduino-board"),
  {
    ssr: false,
    loading: () => (
      <div className="arduino-board-loading">
        <div className="arduino-editor-loading-spinner" />
        <span>Loading Board...</span>
      </div>
    ),
  }
);

type BoardType = "uno" | "mega";

export default function ArduinoIDEPage() {
  const [code, setCode] = useState(exampleSketches[0].code);
  const [board, setBoard] = useState<BoardType>("uno");
  const [compilerOutput, setCompilerOutput] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [activeExample, setActiveExample] = useState<string>(exampleSketches[0].id);
  const [splitPos, setSplitPos] = useState(50); // percentage
  const splitDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const simulator = useArduinoSimulator({
    onSerialOutput: (line) => {
      console.log("[Serial]", line);
    },
  });

  const { start, stop, isRunning, boardState, serialOutput } = simulator;
  const handleButtonPress = (simulator as unknown as { handleButtonPress: (pin: number) => void }).handleButtonPress;
  const handleButtonRelease = (simulator as unknown as { handleButtonRelease: (pin: number) => void }).handleButtonRelease;

  // Compile & Run
  const handleCompileAndRun = useCallback(async () => {
    setIsCompiling(true);
    setCompilerOutput("Compiling sketch...\n");

    // First, try to find a pre-compiled example
    const example = exampleSketches.find((s) => s.code.trim() === code.trim());
    if (example) {
      setCompilerOutput(
        `Using pre-compiled example: ${example.title}\n` +
        `Board: Arduino ${board === "uno" ? "Uno" : "Mega"}\n` +
        `Binary size: ${Math.round(example.hex.length / 3)} bytes\n` +
        `Done! Starting simulation...\n`
      );
      setIsCompiling(false);
      start(example.hex);
      return;
    }

    // Try server compilation
    try {
      const res = await fetch("/api/arduino/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, board }),
      });

      const data = await res.json();

      if (data.success && data.hex) {
        setCompilerOutput(
          `Compilation successful!\n` +
          `Board: Arduino ${board === "uno" ? "Uno" : "Mega"}\n` +
          `${data.output}\n` +
          `Starting simulation...\n`
        );
        start(data.hex);
      } else {
        setCompilerOutput(
          `Compilation failed:\n${data.output}\n` +
          (data.errors ? `\nErrors:\n${data.errors.join("\n")}` : "")
        );
      }
    } catch (err) {
      setCompilerOutput(
        `Could not reach compilation server.\n` +
        `Error: ${err instanceof Error ? err.message : "Unknown"}\n\n` +
        `Tip: Use the example sketches (📋) which include pre-compiled binaries.`
      );
    }

    setIsCompiling(false);
  }, [code, board, start]);

  // Stop simulation
  const handleStop = useCallback(() => {
    stop();
    setCompilerOutput((prev) => prev + "\nSimulation stopped.");
  }, [stop]);

  // Load example sketch
  const loadExample = useCallback(
    (example: ExampleSketch) => {
      setCode(example.code);
      setActiveExample(example.id);
      setShowExamples(false);
      setCompilerOutput("");
      stop();
    },
    [stop]
  );

  // Split pane drag handler
  const handleSplitMouseDown = useCallback(() => {
    splitDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pos = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPos(Math.max(25, Math.min(75, pos)));
    };

    const handleMouseUp = () => {
      splitDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  return (
    <div className="arduino-ide">
      {/* Header Bar */}
      <div className="arduino-ide-header">
        <div className="arduino-ide-title">
          <div className="arduino-ide-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <line x1="9" y1="1" x2="9" y2="4" />
              <line x1="15" y1="1" x2="15" y2="4" />
              <line x1="9" y1="20" x2="9" y2="23" />
              <line x1="15" y1="20" x2="15" y2="23" />
              <line x1="20" y1="9" x2="23" y2="9" />
              <line x1="20" y1="14" x2="23" y2="14" />
              <line x1="1" y1="9" x2="4" y2="9" />
              <line x1="1" y1="14" x2="4" y2="14" />
            </svg>
          </div>
          <div>
            <h1 className="arduino-ide-h1">Arduino IDE</h1>
            <p className="arduino-ide-subtitle">Simulate • Compile • Learn</p>
          </div>
        </div>

        <div className="arduino-ide-header-actions">
          {/* Board Selector */}
          <div className="arduino-board-selector">
            <label>Board:</label>
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value as BoardType)}
              className="arduino-board-select"
            >
              <option value="uno">Arduino Uno</option>
              <option value="mega">Arduino Mega</option>
            </select>
          </div>

          {/* Status Badge */}
          <div className={`arduino-status-badge ${isRunning ? "running" : isCompiling ? "compiling" : "idle"}`}>
            <span className="arduino-status-dot" />
            {isRunning ? "Running" : isCompiling ? "Compiling..." : "Ready"}
          </div>
        </div>
      </div>

      {/* Main Split Pane */}
      <div className="arduino-ide-main" ref={containerRef}>
        {/* Left Panel — Editor */}
        <div className="arduino-ide-editor-panel" style={{ width: `${splitPos}%` }}>
          <ArduinoEditor code={code} onChange={setCode} />
        </div>

        {/* Split Divider */}
        <div className="arduino-split-divider" onMouseDown={handleSplitMouseDown}>
          <div className="arduino-split-handle" />
        </div>

        {/* Right Panel — Board Simulation */}
        <div className="arduino-ide-board-panel" style={{ width: `${100 - splitPos}%` }}>
          <ArduinoBoard
            boardState={boardState}
            onButtonPress={handleButtonPress}
            onButtonRelease={handleButtonRelease}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="arduino-toolbar">
        <div className="arduino-toolbar-left">
          <button
            className={`arduino-btn arduino-btn-compile ${isCompiling ? "compiling" : ""}`}
            onClick={handleCompileAndRun}
            disabled={isCompiling || isRunning}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            {isCompiling ? "Compiling..." : "Compile & Run"}
          </button>

          <button
            className="arduino-btn arduino-btn-stop"
            onClick={handleStop}
            disabled={!isRunning}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Stop
          </button>

          {/* Examples dropdown */}
          <div className="arduino-examples-container">
            <button
              className="arduino-btn arduino-btn-examples"
              onClick={() => setShowExamples(!showExamples)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
              Examples
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="6,9 12,15 18,9" />
              </svg>
            </button>

            {showExamples && (
              <div className="arduino-examples-dropdown">
                <div className="arduino-examples-header">Example Sketches</div>
                {exampleSketches.map((ex) => (
                  <button
                    key={ex.id}
                    className={`arduino-example-item ${activeExample === ex.id ? "active" : ""}`}
                    onClick={() => loadExample(ex)}
                  >
                    <div className="arduino-example-title">{ex.title}</div>
                    <div className="arduino-example-desc">{ex.description}</div>
                    <span className={`arduino-example-cat cat-${ex.category}`}>
                      {ex.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="arduino-toolbar-right">
          <span className="arduino-toolbar-info">
            {code.split("\n").length} lines
          </span>
        </div>
      </div>

      {/* Bottom Panel — Serial Monitor */}
      <SerialMonitor
        output={serialOutput}
        onSendInput={simulator.sendSerial}
        compilerOutput={compilerOutput}
        isRunning={isRunning}
      />
    </div>
  );
}
