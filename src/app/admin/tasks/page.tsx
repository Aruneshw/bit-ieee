"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Send, Eye, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TaskQuestion } from "@/lib/types";
import { QuestionForm, QuestionCard, SubmissionReviewCard } from "./components";

export default function AdminTaskPanel() {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [task, setTask] = useState<any | null>(null);
  const [questions, setQuestions] = useState<TaskQuestion[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"questions" | "submissions">("questions");

  // Load approved events
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("events")
        .select("id, name, society:societies(abbreviation)")
        .eq("status", "approved").order("created_at", { ascending: false });
      setEvents(data || []);
      setLoading(false);
    })();
  }, []);

  // When event is selected, find or create its task
  async function selectEvent(eventId: string) {
    setSelectedEventId(eventId);
    if (!eventId) { setTask(null); setQuestions([]); setSubmissions([]); return; }

    // Check if task already exists for this event
    const { data: existing } = await supabase.from("tasks")
      .select("*").eq("event_id", eventId).limit(1).single();

    if (existing) {
      setTask(existing);
      await loadQuestions(existing.id);
      await loadSubmissions(existing.id);
    } else {
      // Auto-create a task for this event
      const { data: { user } } = await supabase.auth.getUser();
      const ev = events.find(e => e.id === eventId);
      const { data: newTask, error } = await supabase.from("tasks").insert({
        event_id: eventId,
        title: ev?.name || "Task",
        type: "general",
        status: "draft",
        questions: [],
        created_by: user?.id,
      }).select().single();
      if (error) { toast.error(error.message); return; }
      setTask(newTask);
      setQuestions([]);
      setSubmissions([]);
    }
    setTab("questions");
  }

  async function loadQuestions(taskId: string) {
    const { data } = await supabase.from("task_questions")
      .select("*").eq("task_id", taskId).order("sort_order");
    setQuestions((data || []) as TaskQuestion[]);
  }

  async function loadSubmissions(taskId: string) {
    const { data } = await supabase.from("task_submissions")
      .select("*, user:users(name, email), submission_answers(*)")
      .eq("task_id", taskId).order("submitted_at", { ascending: false });
    setSubmissions(data || []);
  }

  async function addQuestion(q: any) {
    if (!task) return;
    const { error } = await supabase.from("task_questions").insert({
      task_id: task.id, type: q.type, text: q.text,
      options: q.options, correct_answer: q.correct_answer,
      points: q.points, sort_order: questions.length, status: "draft",
    });
    if (error) toast.error(error.message);
    else { toast.success("Question added!"); await loadQuestions(task.id); }
  }

  async function updateQuestionStatus(id: string, status: string) {
    const { error } = await supabase.from("task_questions").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Question ${status}!`); await loadQuestions(task.id); }
  }

  async function deleteQuestion(id: string) {
    const { error } = await supabase.from("task_questions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted!"); await loadQuestions(task.id); }
  }

  async function publishTask() {
    if (!task) return;
    const approved = questions.filter(q => q.status === "approved");
    if (approved.length === 0) {
      toast.error("Approve at least one question before publishing!"); return;
    }
    const { error } = await supabase.from("tasks").update({ status: "approved" }).eq("id", task.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Published! Members can now see this task.");
      setTask({ ...task, status: "approved" });
    }
  }

  async function unpublishTask() {
    if (!task) return;
    const { error } = await supabase.from("tasks").update({ status: "draft" }).eq("id", task.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Task unpublished. Members can no longer see it.");
      setTask({ ...task, status: "draft" });
    }
  }

  async function deleteTask() {
    if (!task) return;
    if (!confirm("Delete this task and ALL questions? This cannot be undone.")) return;
    await supabase.from("task_questions").delete().eq("task_id", task.id);
    const subIds = (await supabase.from("task_submissions").select("id").eq("task_id", task.id)).data?.map(s => s.id) || [];
    if (subIds.length) await supabase.from("submission_answers").delete().in("submission_id", subIds);
    await supabase.from("task_submissions").delete().eq("task_id", task.id);
    await supabase.from("tasks").delete().eq("id", task.id);
    toast.success("Task deleted!");
    setTask(null); setQuestions([]); setSubmissions([]); setSelectedEventId("");
  }

  async function updateAnswer(answerId: string, isCorrect: boolean, remarks: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("submission_answers").update({
      is_correct: isCorrect, admin_remarks: remarks || null,
      reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
    }).eq("id", answerId);
    if (error) toast.error(error.message);
    else toast.success("Answer reviewed!");
  }

  const selectedEvent = events.find(e => e.id === selectedEventId);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent-primary)" }} /></div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Task Management</h1>
        <p style={{ color: "var(--text-secondary)" }}>Select an event to manage its questions.</p>
      </div>

      {/* Event Selector */}
      <div className="glass-card p-5">
        <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Choose Event</label>
        <select value={selectedEventId} onChange={e => selectEvent(e.target.value)}
          className="input-field text-sm w-full max-w-md">
          <option value="">— Select an event —</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.name} {ev.society?.abbreviation ? `(${ev.society.abbreviation})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Task Panel — only shown when event is selected */}
      {task && selectedEvent && (
        <div className="glass-card p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{selectedEvent.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                {selectedEvent.society?.abbreviation && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">{selectedEvent.society.abbreviation}</span>
                )}
                <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${task.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {task.status === "approved" ? "Published" : "Draft"}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {task.status === "draft" ? (
                <button onClick={publishTask} className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4">
                  <Send className="w-3.5 h-3.5" /> Publish to Members
                </button>
              ) : (
                <button onClick={unpublishTask} className="px-4 py-2 text-xs font-bold rounded-lg border transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  Unpublish
                </button>
              )}
              <button onClick={deleteTask} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete Task">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
            <button onClick={() => setTab("questions")}
              className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${tab === "questions" ? "bg-[#00629B] text-white" : ""}`}
              style={tab !== "questions" ? { color: "var(--text-muted)" } : {}}>
              Questions ({questions.length})
            </button>
            <button onClick={() => { setTab("submissions"); loadSubmissions(task.id); }}
              className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${tab === "submissions" ? "bg-[#00629B] text-white" : ""}`}
              style={tab !== "submissions" ? { color: "var(--text-muted)" } : {}}>
              <Eye className="w-3 h-3 inline mr-1" /> Submissions ({submissions.length})
            </button>
          </div>

          {/* Questions Tab */}
          {tab === "questions" && (
            <div className="space-y-4">
              {/* Add Question Button/Form */}
              <QuestionForm onAdd={addQuestion} />

              {/* Questions List */}
              {questions.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
                  No questions yet. Click "+ Add Question" to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, i) => (
                    <QuestionCard key={q.id} q={q} index={i}
                      onApprove={() => updateQuestionStatus(q.id, "approved")}
                      onReject={() => updateQuestionStatus(q.id, "rejected")}
                      onDelete={() => deleteQuestion(q.id)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submissions Tab */}
          {tab === "submissions" && (
            <div className="space-y-3">
              {submissions.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
                  No submissions yet.
                </p>
              ) : submissions.map(sub => (
                <SubmissionReviewCard key={sub.id} submission={sub} questions={questions} onUpdateAnswer={updateAnswer} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
