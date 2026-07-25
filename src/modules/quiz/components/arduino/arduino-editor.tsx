"use client";

import { useRef, useCallback } from "react";
import dynamic from "next/dynamic";

// Dynamically import Monaco to avoid SSR issues and reduce initial bundle
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="arduino-editor-loading">
      <div className="arduino-editor-loading-spinner" />
      <span>Loading Editor...</span>
    </div>
  ),
});

// Arduino-specific keyword definitions for syntax highlighting
const ARDUINO_KEYWORDS = [
  "setup", "loop", "pinMode", "digitalWrite", "digitalRead",
  "analogWrite", "analogRead", "delay", "delayMicroseconds",
  "millis", "micros", "Serial", "tone", "noTone",
  "HIGH", "LOW", "INPUT", "OUTPUT", "INPUT_PULLUP",
  "LED_BUILTIN", "A0", "A1", "A2", "A3", "A4", "A5",
  "true", "false", "NULL",
];

const ARDUINO_TYPES = [
  "void", "int", "long", "float", "double", "char", "byte",
  "boolean", "unsigned", "short", "size_t", "String",
  "uint8_t", "uint16_t", "uint32_t", "int8_t", "int16_t", "int32_t",
];

const ARDUINO_SNIPPETS = [
  {
    label: "setup",
    insertText: "void setup() {\n  ${1:// initialization}\n}",
    documentation: "Arduino setup function — runs once at startup",
  },
  {
    label: "loop",
    insertText: "void loop() {\n  ${1:// main code}\n}",
    documentation: "Arduino loop function — runs repeatedly",
  },
  {
    label: "pinMode",
    insertText: "pinMode(${1:pin}, ${2|OUTPUT,INPUT,INPUT_PULLUP|});",
    documentation: "Configure a digital pin as input or output",
  },
  {
    label: "digitalWrite",
    insertText: "digitalWrite(${1:pin}, ${2|HIGH,LOW|});",
    documentation: "Write HIGH or LOW to a digital pin",
  },
  {
    label: "digitalRead",
    insertText: "digitalRead(${1:pin})",
    documentation: "Read the value from a digital pin",
  },
  {
    label: "analogWrite",
    insertText: "analogWrite(${1:pin}, ${2:value});",
    documentation: "Write an analog (PWM) value to a pin (0-255)",
  },
  {
    label: "analogRead",
    insertText: "analogRead(${1|A0,A1,A2,A3,A4,A5|})",
    documentation: "Read the analog value from an analog input pin",
  },
  {
    label: "Serial.begin",
    insertText: "Serial.begin(${1|9600,115200,57600,38400,19200|});",
    documentation: "Initialize serial communication at a baud rate",
  },
  {
    label: "Serial.println",
    insertText: 'Serial.println(${1:"Hello World!"});',
    documentation: "Print data to the serial port followed by a newline",
  },
  {
    label: "delay",
    insertText: "delay(${1:1000});",
    documentation: "Pause the program for a number of milliseconds",
  },
];

interface CompilationError {
  line: number;
  column?: number;
  message: string;
  severity: "error" | "warning";
}

interface ArduinoEditorProps {
  code: string;
  onChange: (value: string) => void;
  errors?: CompilationError[];
  readOnly?: boolean;
}

export default function ArduinoEditor({ code, onChange, errors = [], readOnly = false }: ArduinoEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register Arduino language (extending C++)
    monaco.languages.register({ id: "arduino" });

    // Set token provider for Arduino syntax
    monaco.languages.setMonarchTokensProvider("arduino", {
      keywords: ARDUINO_KEYWORDS,
      typeKeywords: ARDUINO_TYPES,
      operators: [
        "=", ">", "<", "!", "~", "?", ":",
        "==", "<=", ">=", "!=", "&&", "||", "++", "--",
        "+", "-", "*", "/", "&", "|", "^", "%",
        "<<", ">>", "+=", "-=", "*=", "/=", "&=", "|=",
        "^=", "%=", "<<=", ">>=",
      ],
      symbols: /[=><!~?:&|+\-*/^%]+/,
      tokenizer: {
        root: [
          [/#\w+/, "keyword.directive"],
          [/[a-zA-Z_]\w*/, {
            cases: {
              "@typeKeywords": "type",
              "@keywords": "keyword",
              "@default": "identifier",
            },
          }],
          { include: "@whitespace" },
          [/[{}()[\]]/, "@brackets"],
          [/[<>](?!@symbols)/, "@brackets"],
          [/@symbols/, {
            cases: {
              "@operators": "operator",
              "@default": "",
            },
          }],
          [/\d*\.\d+([eE][-+]?\d+)?/, "number.float"],
          [/0[xX][0-9a-fA-F]+/, "number.hex"],
          [/0[bB][01]+/, "number.binary"],
          [/\d+/, "number"],
          [/[;,.]/, "delimiter"],
          [/"([^"\\]|\\.)*$/, "string.invalid"],
          [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],
          [/'[^\\']'/, "string"],
          [/'/, "string.invalid"],
        ],
        comment: [
          [/[^/*]+/, "comment"],
          [/\/\*/, "comment", "@push"],
          ["\\*/", "comment", "@pop"],
          [/[/*]/, "comment"],
        ],
        string: [
          [/[^\\"]+/, "string"],
          [/\\./, "string.escape"],
          [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
        ],
        whitespace: [
          [/[ \t\r\n]+/, "white"],
          [/\/\*/, "comment", "@comment"],
          [/\/\/.*$/, "comment"],
        ],
      },
    });

    // Register completion provider
    monaco.languages.registerCompletionItemProvider("arduino", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provideCompletionItems: (_model: any, _position: any) => {
        const suggestions = ARDUINO_SNIPPETS.map((snippet) => ({
          label: snippet.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: snippet.documentation,
        }));

        // Add keyword suggestions
        ARDUINO_KEYWORDS.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            insertTextRules: 0,
            documentation: `Arduino keyword: ${kw}`,
          });
        });

        return { suggestions };
      },
    });

    // Define custom Arduino dark theme
    monaco.editor.defineTheme("arduino-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "569CD6", fontStyle: "bold" },
        { token: "keyword.directive", foreground: "C586C0" },
        { token: "type", foreground: "4EC9B0" },
        { token: "identifier", foreground: "D4D4D4" },
        { token: "number", foreground: "B5CEA8" },
        { token: "number.float", foreground: "B5CEA8" },
        { token: "number.hex", foreground: "B5CEA8" },
        { token: "string", foreground: "CE9178" },
        { token: "comment", foreground: "6A9955", fontStyle: "italic" },
        { token: "operator", foreground: "D4D4D4" },
        { token: "delimiter", foreground: "D4D4D4" },
      ],
      colors: {
        "editor.background": "#0d1117",
        "editor.foreground": "#c9d1d9",
        "editor.lineHighlightBackground": "#161b22",
        "editor.selectionBackground": "#264f78",
        "editorCursor.foreground": "#00bfff",
        "editorLineNumber.foreground": "#484f58",
        "editorLineNumber.activeForeground": "#00bfff",
        "editor.inactiveSelectionBackground": "#1a2332",
        "editorIndentGuide.background1": "#1e2533",
        "editorGutter.background": "#0d1117",
      },
    });

    monaco.editor.setTheme("arduino-dark");

    // Set editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: "all",
      lineNumbers: "on",
      tabSize: 2,
      wordWrap: "on",
      automaticLayout: true,
      padding: { top: 12 },
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      bracketPairColorization: { enabled: true },
    });
  }, []);

  // Apply error markers when compilation errors change
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) onChange(value);
    },
    [onChange]
  );

  // Update error markers
  if (monacoRef.current && editorRef.current && errors.length > 0) {
    const model = editorRef.current.getModel();
    if (model) {
      const markers = errors.map((err) => ({
        severity:
          err.severity === "error"
            ? monacoRef.current.MarkerSeverity.Error
            : monacoRef.current.MarkerSeverity.Warning,
        startLineNumber: err.line,
        startColumn: err.column || 1,
        endLineNumber: err.line,
        endColumn: err.column ? err.column + 10 : 1000,
        message: err.message,
      }));
      monacoRef.current.editor.setModelMarkers(model, "arduino-compiler", markers);
    }
  }

  return (
    <div className="arduino-editor-container">
      <div className="arduino-editor-header">
        <div className="arduino-editor-tab">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
          </svg>
          <span>sketch.ino</span>
        </div>
        <div className="arduino-editor-actions">
          {errors.length > 0 && (
            <span className="arduino-error-badge">
              {errors.length} {errors.length === 1 ? "error" : "errors"}
            </span>
          )}
        </div>
      </div>
      <MonacoEditor
        height="100%"
        language="arduino"
        value={code}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="arduino-dark"
        options={{
          readOnly,
        }}
      />
    </div>
  );
}
