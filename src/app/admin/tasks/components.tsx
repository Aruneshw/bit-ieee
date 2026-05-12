"use client";

import React, { useState } from "react";
import { Plus, Trash2, CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import type { TaskQuestion, SubmissionAnswer } from "@/lib/types";

/* ── Question Form ── */
export function QuestionForm({ onAdd }: { onAdd: (q: { type: string; text: string; options: string[]; correct_answer: string | null; points: number }) => void }) {
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
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4 border border-white/5">
      <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <Plus className="w-4 h-4 text-[#00bfff]" /> Add Question
      </h4>
      <div className="flex gap-2">
        {(["mcq", "coding", "general"] as const).map(t => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${type === t ? "bg-[#00629B] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
            {t}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} required rows={3}
        className="input-field resize-none text-sm" placeholder={type === "coding" ? "Problem statement..." : "Question text..."} />
      {type === "mcq" && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Options (click radio to mark correct):</p>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} className="accent-[#00bfff]" />
              <input type="text" value={opt} onChange={e => { const o = [...options]; o[i] = e.target.value; setOptions(o); }}
                className="input-field text-sm flex-1" placeholder={`Option ${i + 1}`} />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-4">
        <label className="text-xs text-gray-400">Points:</label>
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
  const statusColors: Record<string, string> = {
    draft: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    approved: "bg-green-500/20 text-green-400 border-green-500/30",
    rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  const typeColors: Record<string, string> = {
    mcq: "bg-blue-500/20 text-blue-400",
    coding: "bg-purple-500/20 text-purple-400",
    general: "bg-cyan-500/20 text-cyan-400",
  };

  return (
    <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-500">Q{index + 1}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${typeColors[q.type]}`}>{q.type}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${statusColors[q.status]}`}>{q.status}</span>
          <span className="text-[10px] text-gray-500">{q.points} pts</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {q.status !== "approved" && (
            <button onClick={onApprove} className="p-1.5 rounded-lg hover:bg-green-500/10 text-gray-500 hover:text-green-400 transition-colors" title="Approve">
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          {q.status !== "rejected" && (
            <button onClick={onReject} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors" title="Reject">
              <XCircle className="w-4 h-4" />
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-300 whitespace-pre-wrap">{q.text}</p>
      {q.type === "mcq" && q.options && Array.isArray(q.options) && (
        <div className="grid grid-cols-2 gap-1.5">
          {(q.options as string[]).map((opt: string, i: number) => (
            <div key={i} className={`text-xs px-3 py-1.5 rounded-lg border ${q.correct_answer === String(i) ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-white/5 text-gray-500"}`}>
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

  return (
    <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-gray-400">
            {(submission.user?.name || "?")[0].toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">{submission.user?.name || "Unknown"}</p>
            <p className="text-xs text-gray-500">{new Date(submission.submitted_at).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
            submission.review_status === "reviewed" ? "bg-green-500/20 text-green-400" :
            submission.review_status === "partial" ? "bg-yellow-500/20 text-yellow-400" :
            "bg-gray-500/20 text-gray-400"
          }`}>{submission.review_status}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
          {answers.map(ans => {
            const q = questions.find(qq => qq.id === ans.question_id);
            return (
              <AnswerReviewRow key={ans.id} answer={ans} question={q} onUpdate={onUpdateAnswer} />
            );
          })}
          {answers.length === 0 && <p className="text-xs text-gray-500">No answers recorded.</p>}
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
    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5 space-y-2">
      <p className="text-xs text-gray-400 font-medium">{question?.text || "Question"} <span className="text-gray-600">({question?.type})</span></p>
      <div className="p-2 bg-black/30 rounded-lg">
        <p className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
          {answer.answer_text || (answer.selected_option !== null && question?.options ? `Option ${String.fromCharCode(65 + answer.selected_option)}: ${(question.options as string[])[answer.selected_option]}` : "No answer")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Admin remarks..."
          className="input-field text-xs flex-1 py-1.5" />
        <button onClick={() => save(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Correct
        </button>
        <button onClick={() => save(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1">
          <XCircle className="w-3 h-3" /> Wrong
        </button>
        {saved && <span className="text-[10px] text-green-400">Saved!</span>}
      </div>
      {answer.is_correct !== null && (
        <p className={`text-[10px] ${answer.is_correct ? "text-green-400" : "text-red-400"}`}>
          Previously marked: {answer.is_correct ? "✓ Correct" : "✗ Wrong"}{answer.admin_remarks ? ` — "${answer.admin_remarks}"` : ""}
        </p>
      )}
    </div>
  );
}
