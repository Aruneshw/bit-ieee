"use client";

import { useRef, useEffect, useState, useCallback } from "react";

/* ================================================================
 * SerialMonitor — Terminal-style serial output viewer
 * ================================================================ */

interface SerialMonitorProps {
  output: string[];
  onSendInput?: (data: string) => void;
  compilerOutput?: string;
  isRunning?: boolean;
}

type TabMode = "serial" | "compiler";

export default function SerialMonitor({
  output,
  onSendInput,
  compilerOutput,
  isRunning = false,
}: SerialMonitorProps) {
  const [tab, setTab] = useState<TabMode>("serial");
  const [input, setInput] = useState("");
  const [baudRate, setBaudRate] = useState(9600);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  // Reset start time when simulation starts
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now();
    }
  }, [isRunning]);

  // Switch to compiler tab when there's compiler output
  useEffect(() => {
    if (compilerOutput) {
      setTab("compiler");
    }
  }, [compilerOutput]);

  const handleSend = useCallback(() => {
    if (input.trim() && onSendInput) {
      onSendInput(input + "\n");
      setInput("");
    }
  }, [input, onSendInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const formatTimestamp = useCallback(
    (index: number) => {
      if (!showTimestamps) return "";
      const elapsed = ((index * 100) / (baudRate / 9600)).toFixed(0);
      return `[${elapsed}ms] `;
    },
    [showTimestamps, baudRate]
  );

  return (
    <div className="serial-monitor">
      {/* Tab Header */}
      <div className="serial-monitor-header">
        <div className="serial-monitor-tabs">
          <button
            className={`serial-tab ${tab === "serial" ? "active" : ""}`}
            onClick={() => setTab("serial")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4,17 10,11 4,5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            Serial Monitor
            {isRunning && output.length > 0 && (
              <span className="serial-tab-badge">{output.length}</span>
            )}
          </button>
          <button
            className={`serial-tab ${tab === "compiler" ? "active" : ""}`}
            onClick={() => setTab("compiler")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14,2 14,8 20,8" />
            </svg>
            Compiler Output
          </button>
        </div>

        <div className="serial-monitor-controls">
          {tab === "serial" && (
            <>
              {/* Baud rate selector */}
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(Number(e.target.value))}
                className="serial-baud-select"
              >
                <option value={300}>300 baud</option>
                <option value={1200}>1200 baud</option>
                <option value={2400}>2400 baud</option>
                <option value={4800}>4800 baud</option>
                <option value={9600}>9600 baud</option>
                <option value={19200}>19200 baud</option>
                <option value={38400}>38400 baud</option>
                <option value={57600}>57600 baud</option>
                <option value={115200}>115200 baud</option>
              </select>

              {/* Timestamp toggle */}
              <button
                className={`serial-ctrl-btn ${showTimestamps ? "active" : ""}`}
                onClick={() => setShowTimestamps(!showTimestamps)}
                title="Toggle timestamps"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
              </button>

              {/* Auto-scroll toggle */}
              <button
                className={`serial-ctrl-btn ${autoScroll ? "active" : ""}`}
                onClick={() => setAutoScroll(!autoScroll)}
                title="Toggle auto-scroll"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Output Area */}
      <div className="serial-output" ref={scrollRef}>
        {tab === "serial" ? (
          output.length === 0 ? (
            <div className="serial-empty">
              <span>
                {isRunning
                  ? "Waiting for serial output..."
                  : "Run a sketch to see serial output here"}
              </span>
            </div>
          ) : (
            output.map((line, i) => (
              <div key={i} className="serial-line">
                {showTimestamps && (
                  <span className="serial-timestamp">{formatTimestamp(i)}</span>
                )}
                <span className="serial-text">{line}</span>
              </div>
            ))
          )
        ) : (
          <div className="compiler-output">
            {compilerOutput ? (
              compilerOutput.split("\n").map((line, i) => (
                <div
                  key={i}
                  className={`compiler-line ${
                    line.toLowerCase().includes("error") ? "error" :
                    line.toLowerCase().includes("warning") ? "warning" :
                    line.includes("Done") || line.includes("Success") ? "success" : ""
                  }`}
                >
                  {line}
                </div>
              ))
            ) : (
              <div className="serial-empty">
                <span>Compile a sketch to see output here</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Serial Input (only in serial tab) */}
      {tab === "serial" && (
        <div className="serial-input-bar">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRunning ? "Send to Serial..." : "Start simulation first"}
            disabled={!isRunning}
            className="serial-input"
          />
          <button
            onClick={handleSend}
            disabled={!isRunning || !input.trim()}
            className="serial-send-btn"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
