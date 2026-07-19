"use client";

import React, { useState } from "react";
import { Plus, Trash2, CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import type { TaskQuestion, SubmissionAnswer } from "@/lib/types";

/* ── Question Form (hidden by default, toggled) ── */
export function QuestionForm({ onAdd }: { onAdd: (q: { type: string; text: string; options: string[]; correct_answer: string | null; points: number }) => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"mcq" | "coding" | "general">("mcq");
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState<number | null>(null);
  const [points, setPoints] = useState(10);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd({
      type,
      text: text.trim(),
      options: type === "mcq" ? options.filter(Boolean) : [],
      correct_answer: type === "mcq" && correct !== null ? String(correct) : null,
      points,
    });
    setText(""); setOptions(["", "", "", ""]); setCorrect(null); setPoints(10);
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full p-3 border-2 border-dashed rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        style={{ borderColor: "var(--border)", color: "var(--accent-primary)" }}>
        <Plus className="w-4 h-4" /> Add Question
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4 border" style={{ borderColor: "var(--accent-primary)" }}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
          <Plus className="w-4 h-4" style={{ color: "var(--accent-primary)" }} /> Add Question
        </h4>
        <button type="button" onClick={() => setOpen(false)} className="text-xs" style={{ color: "var(--text-muted)" }}>Cancel</button>
      </div>
      <div className="flex gap-2">
        {(["mcq", "coding", "general"] as const).map(t => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${type === t ? "bg-[#00629B] text-white" : ""}`}
            style={type !== t ? { background: "var(--bg-secondary)", color: "var(--text-secondary)" } : {}}>
            {t}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} required rows={3}
        className="input-field resize-none text-sm" placeholder={type === "coding" ? "Problem statement..." : "Question text..."} />
      {type === "mcq" && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Options (click radio to mark correct):</p>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} className="accent-[#00629B]" />
              <input type="text" value={opt} onChange={e => { const o = [...options]; o[i] = e.target.value; setOptions(o); }}
                className="input-field text-sm flex-1" placeholder={`Option ${i + 1}`} />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-4">
        <label className="text-xs" style={{ color: "var(--text-muted)" }}>Points:</label>
        <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} min={1} max={100} className="input-field w-24 text-sm" />
        <button type="submit" className="btn-primary text-sm ml-auto">Add Question</button>
      </div>
    </form>
  );
}

/* ── Question Card ── */
export function QuestionCard({ q, index, onApprove, onReject, onDelete }: {
  q: TaskQuestion; index: number;
  onApprove: () => void; onReject: () => void; onDelete: () => void;
}) {
  const statusStyles: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-700 border-yellow-300",
    approved: "bg-green-100 text-green-700 border-green-300",
    rejected: "bg-red-100 text-red-700 border-red-300",
  };
  const typeStyles: Record<string, string> = {
    mcq: "bg-blue-100 text-blue-700",
    coding: "bg-purple-100 text-purple-700",
    general: "bg-cyan-100 text-cyan-700",
  };

  return (
    <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Q{index + 1}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${typeStyles[q.type]}`}>{q.type}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${statusStyles[q.status]}`}>{q.status}</span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{q.points} pts</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {q.status !== "approved" && (
            <button onClick={onApprove} className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors" title="Approve">
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          {q.status !== "rejected" && (
            <button onClick={onReject} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="Reject">
              <XCircle className="w-4 h-4" />
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{q.text}</p>
      {q.type === "mcq" && q.options && Array.isArray(q.options) && (
        <div className="grid grid-cols-2 gap-1.5">
          {(q.options as string[]).map((opt: string, i: number) => (
            <div key={i} className={`text-xs px-3 py-1.5 rounded-lg border ${q.correct_answer === String(i) ? "border-green-400 bg-green-50 text-green-700" : "text-gray-500"}`}
              style={q.correct_answer !== String(i) ? { borderColor: "var(--border)" } : {}}>
              {String.fromCharCode(65 + i)}. {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Submission Review Card ── */
export function SubmissionReviewCard({ submission, questions, onUpdateAnswer }: {
  submission: any;
  questions: TaskQuestion[];
  onUpdateAnswer: (answerId: string, isCorrect: boolean, remarks: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const answers: SubmissionAnswer[] = submission.submission_answers || [];

  // Per-question status counts
  const correct = answers.filter(a => a.is_correct === true).length;
  const wrong = answers.filter(a => a.is_correct === false).length;
  const pending = answers.filter(a => a.is_correct === null || a.is_correct === undefined).length;

  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
            {(submission.user?.name || "?")[0].toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{submission.user?.name || "Unknown"}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{submission.user?.email}</p>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{new Date(submission.submitted_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Per-question status badges */}
          {correct > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">✓ {correct}</span>}
          {wrong > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">✗ {wrong}</span>}
          {pending > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">⏳ {pending}</span>}
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{answers.length} answer{answers.length !== 1 ? "s" : ""}</span>
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
        </div>
      </button>
      {expanded && (
        <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          {answers.map(ans => {
            const q = questions.find(qq => qq.id === ans.question_id);
            return <AnswerReviewRow key={ans.id} answer={ans} question={q} onUpdate={onUpdateAnswer} />;
          })}
          {answers.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No answers recorded yet.</p>}
        </div>
      )}
    </div>
  );
}

function AnswerReviewRow({ answer, question, onUpdate }: {
  answer: SubmissionAnswer; question?: TaskQuestion;
  onUpdate: (id: string, correct: boolean, remarks: string) => void;
}) {
  const [remarks, setRemarks] = useState(answer.admin_remarks || "");
  const [saved, setSaved] = useState(false);

  function save(correct: boolean) {
    onUpdate(answer.id, correct, remarks);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-3 rounded-lg space-y-2" style={{ background: "var(--bg-secondary)" }}>
      <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{question?.text || "Question"} <span style={{ color: "var(--text-muted)" }}>({question?.type})</span></p>
      <div className="p-2 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <p className="text-sm whitespace-pre-wrap font-mono" style={{ color: "var(--text-primary)" }}>
          {answer.answer_text || (answer.selected_option !== null && question?.options ? `Option ${String.fromCharCode(65 + answer.selected_option)}: ${(question.options as string[])[answer.selected_option]}` : "No answer")}
        </p>
        {answer.image_url && (
          <div className="mt-2 border rounded-lg overflow-hidden max-w-md bg-black/5">
            <a href={answer.image_url} target="_blank" rel="noopener noreferrer" className="block p-1 bg-white/50 hover:bg-white transition-colors">
              <img src={answer.image_url} alt="Answer attachment proof" className="max-h-60 object-contain mx-auto rounded" />
            </a>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Admin remarks..."
          className="input-field text-xs flex-1 py-1.5" />
        <button onClick={() => save(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Correct
        </button>
        <button onClick={() => save(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors flex items-center gap-1">
          <XCircle className="w-3 h-3" /> Wrong
        </button>
        {saved && <span className="text-[10px] text-green-600">Saved!</span>}
      </div>
      {answer.is_correct !== null && (
        <p className={`text-[10px] ${answer.is_correct ? "text-green-600" : "text-red-600"}`}>
          Previously marked: {answer.is_correct ? "✓ Correct" : "✗ Wrong"}{answer.admin_remarks ? ` — "${answer.admin_remarks}"` : ""}
        </p>
      )}
    </div>
  );
}
