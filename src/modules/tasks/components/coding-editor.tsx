"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Play, Loader2 } from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-48 border rounded-lg bg-[#0d1117] text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin text-[#00629B]" />
      <span className="text-xs mt-2">Loading Code Editor...</span>
    </div>
  ),
});

interface CodingQuestionEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export default function CodingQuestionEditor({
  value,
  onChange,
  placeholder = "// Write your C program here...\n#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}\n",
}: CodingQuestionEditorProps) {
  const [output, setOutput] = useState("");
  const [errors, setErrors] = useState("");
  const [running, setRunning] = useState(false);

  const initialCode = value || placeholder;

  const handleCompile = async () => {
    setRunning(true);
    setOutput("Compiling and executing...");
    setErrors("");

    try {
      const res = await fetch("/api/compile/c", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value || initialCode }),
      });

      const data = await res.json();
      if (data.success) {
        setOutput(data.output || "Program executed successfully with no stdout output.");
        setErrors(data.errors || "");
      } else {
        setOutput(data.output || "Execution failed.");
        setErrors(data.errors || "Compilation/Run error.");
      }
    } catch (err: any) {
      setOutput("Error connecting to server.");
      setErrors(err.message || "Unknown error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="h-64 border rounded-lg overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <MonacoEditor
          height="100%"
          language="c"
          value={value || initialCode}
          onChange={(val) => onChange(val || "")}
          theme="vs-dark"
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
            tabSize: 4,
          }}
        />
      </div>

      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={handleCompile}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          Compile & Run (GCC)
        </button>
      </div>

      {(output || errors) && (
        <div className="p-3 bg-[#0d1117] rounded-lg border border-gray-800 font-mono text-xs text-gray-300 space-y-1">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-800 pb-1 mb-1">
            Console Output
          </div>
          {output && (
            <pre className="whitespace-pre-wrap text-green-400">{output}</pre>
          )}
          {errors && (
            <pre className="whitespace-pre-wrap text-red-400 mt-1">{errors}</pre>
          )}
        </div>
      )}
    </div>
  );
}
