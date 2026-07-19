"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Send, Eye, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TaskQuestion } from "@/lib/types";
import { QuestionForm, QuestionCard, SubmissionReviewCard } from "./components";

/**
 * Admin Task Management Panel
 * 
 * Flow: Select event → auto-create task → add/approve questions → publish
 * One task per event (enforced by DB unique constraint + UI guard)
 */
export default function AdminTaskPanel() {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [task, setTask] = useState<any | null>(null);
  const [questions, setQuestions] = useState<TaskQuestion[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<"questions" | "submissions">("questions");

  /** Load all approved events on mount */
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("events")
          .select("id, name, society:societies(abbreviation)")
          .eq("status", "approved")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setEvents(data || []);
      } catch (err: any) {
        toast.error("Failed to load events: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Select event and find/create its associated task */
  const selectEvent = useCallback(async (eventId: string) => {
    setSelectedEventId(eventId);
    if (!eventId) {
      setTask(null);
      setQuestions([]);
      setSubmissions([]);
      return;
    }

    setActionLoading(true);
    try {
      // Find existing task for this event
      const { data: existing, error: findErr } = await supabase
        .from("tasks")
        .select("*")
        .eq("event_id", eventId)
        .limit(1)
        .maybeSingle();

      if (findErr) throw findErr;

      if (existing) {
        setTask(existing);
        await loadQuestions(existing.id);
        await loadSubmissions(existing.id);
      } else {
        // Auto-create task for this event
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const eventName = events.find(e => e.id === eventId)?.name || "Task";
        const { data: newTask, error: createErr } = await supabase
          .from("tasks")
          .insert({
            event_id: eventId,
            title: eventName,
            type: "general",
            status: "draft",
            questions: [],
            created_by: user.id,
          })
          .select()
          .single();

        if (createErr) {
          // Handle race condition: task was created by another admin
          if (createErr.code === "23505") {
            const { data: retry } = await supabase
              .from("tasks")
              .select("*")
              .eq("event_id", eventId)
              .single();
            if (retry) {
              setTask(retry);
              await loadQuestions(retry.id);
              await loadSubmissions(retry.id);
              return;
            }
          }
          throw createErr;
        }

        setTask(newTask);
        setQuestions([]);
        setSubmissions([]);
      }
      setTab("questions");
    } catch (err: any) {
      toast.error("Failed to load task: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }, [events]);

  /** Load questions for a task */
  async function loadQuestions(taskId: string) {
    const { data, error } = await supabase
      .from("task_questions")
      .select("*")
      .eq("task_id", taskId)
      .order("sort_order");
    if (error) {
      toast.error("Failed to load questions");
      return;
    }
    setQuestions((data || []) as TaskQuestion[]);
  }

  /** Load submissions for a task */
  async function loadSubmissions(taskId: string) {
    const { data, error } = await supabase
      .from("task_submissions")
      .select("*, user:users(name, email), submission_answers(*)")
      .eq("task_id", taskId)
      .order("submitted_at", { ascending: false });
    if (error) {
      toast.error("Failed to load submissions");
      return;
    }
    setSubmissions(data || []);
  }

  /** Add a new question to the current task */
  async function addQuestion(q: {
    type: string;
    text: string;
    options: string[];
    correct_answer: string | null;
    points: number;
    imageFile: File | null;
    optionFiles?: (File | null)[];
  }) {
    if (!task) return;
    setActionLoading(true);
    try {
      let image_url = null;
      if (q.imageFile) {
        const fileExt = q.imageFile.name.split('.').pop();
        const fileName = `admin-q-${Date.now()}.${fileExt}`;
        const filePath = `task-questions/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, q.imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);
        image_url = publicUrl;
      }

      const finalOptions = [...q.options];
      if (q.optionFiles && q.optionFiles.length > 0) {
        for (let i = 0; i < q.optionFiles.length; i++) {
          const file = q.optionFiles[i];
          if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `admin-opt-${Date.now()}-${i}.${fileExt}`;
            const filePath = `task-options/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
            finalOptions[i] = publicUrl;
          }
        }
      }

      const { error } = await supabase.from("task_questions").insert({
        task_id: task.id,
        type: q.type,
        text: q.text.trim(),
        options: finalOptions.length > 0 ? finalOptions : null,
        correct_answer: q.correct_answer,
        points: Math.max(1, Math.min(100, q.points)),
        sort_order: questions.length,
        status: "draft",
        image_url,
      });
      if (error) throw error;
      toast.success("Question added!");
      await loadQuestions(task.id);
    } catch (err: any) {
      toast.error("Failed to add question: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  /** Update question approval status */
  async function updateQuestionStatus(id: string, status: "approved" | "rejected") {
    if (!task) return;
    try {
      const { error } = await supabase
        .from("task_questions")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Question ${status}!`);
      await loadQuestions(task.id);
    } catch (err: any) {
      toast.error("Failed to update: " + err.message);
    }
  }

  /** Delete a question */
  async function deleteQuestion(id: string) {
    if (!task || !confirm("Delete this question?")) return;
    try {
      // Delete related answers first
      await supabase.from("submission_answers").delete().eq("question_id", id);
      const { error } = await supabase.from("task_questions").delete().eq("id", id);
      if (error) throw error;
      toast.success("Question deleted!");
      await loadQuestions(task.id);
    } catch (err: any) {
      toast.error("Failed to delete: " + err.message);
    }
  }

  /** Publish task — makes it visible to members */
  async function publishTask() {
    if (!task) return;
    const approved = questions.filter(q => q.status === "approved");
    if (approved.length === 0) {
      toast.error("Approve at least one question before publishing!");
      return;
    }
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "approved" })
        .eq("id", task.id);
      if (error) throw error;
      toast.success(`Published! ${approved.length} question(s) are now live.`);
      setTask({ ...task, status: "approved" });
    } catch (err: any) {
      toast.error("Failed to publish: " + err.message);
    }
  }

  /** Unpublish task — hides it from members */
  async function unpublishTask() {
    if (!task) return;
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "draft" })
        .eq("id", task.id);
      if (error) throw error;
      toast.success("Task unpublished.");
      setTask({ ...task, status: "draft" });
    } catch (err: any) {
      toast.error("Failed to unpublish: " + err.message);
    }
  }

  /** Toggle C compiler enabled/disabled */
  async function toggleCCompiler(enabled: boolean) {
    if (!task) return;
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ c_compiler_enabled: enabled })
        .eq("id", task.id);
      if (error) throw error;
      toast.success(`C Compiler ${enabled ? "enabled" : "disabled"} for this event.`);
      setTask({ ...task, c_compiler_enabled: enabled });
    } catch (err: any) {
      toast.error("Failed to update C Compiler setting: " + err.message);
    }
  }


  /** Delete task and all related data */
  async function deleteTask() {
    if (!task) return;
    if (!confirm("Delete this task and ALL questions/submissions? This cannot be undone.")) return;

    setActionLoading(true);
    try {
      // Cascade: answers → submissions → questions → task
      const { data: subs } = await supabase
        .from("task_submissions")
        .select("id")
        .eq("task_id", task.id);
      const subIds = (subs || []).map(s => s.id);

      if (subIds.length > 0) {
        await supabase.from("submission_answers").delete().in("submission_id", subIds);
      }
      await supabase.from("task_submissions").delete().eq("task_id", task.id);
      await supabase.from("task_questions").delete().eq("task_id", task.id);
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;

      toast.success("Task deleted!");
      setTask(null);
      setQuestions([]);
      setSubmissions([]);
      setSelectedEventId("");
    } catch (err: any) {
      toast.error("Failed to delete: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  /** Review a student's answer */
  async function updateAnswer(answerId: string, isCorrect: boolean, remarks: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("submission_answers")
        .update({
          is_correct: isCorrect,
          admin_remarks: remarks.trim() || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", answerId);
      if (error) throw error;
      toast.success("Answer reviewed!");
    } catch (err: any) {
      toast.error("Failed to save review: " + err.message);
    }
  }

  const selectedEvent = events.find(e => e.id === selectedEventId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent-primary)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Task Management</h1>
        <p style={{ color: "var(--text-secondary)" }}>Select an event to manage its questions.</p>
      </div>

      {/* Event Selector */}
      <div className="glass-card p-5">
        <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Choose Event
        </label>
        <select
          value={selectedEventId}
          onChange={e => selectEvent(e.target.value)}
          disabled={actionLoading}
          className="input-field text-sm w-full max-w-md"
        >
          <option value="">— Select an event —</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.name} {ev.society?.abbreviation ? `(${ev.society.abbreviation})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Loading indicator for event selection */}
      {actionLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent-primary)" }} />
        </div>
      )}

      {/* Task Panel */}
      {task && selectedEvent && !actionLoading && (
        <div className="glass-card p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {selectedEvent.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {selectedEvent.society?.abbreviation && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                    {selectedEvent.society.abbreviation}
                  </span>
                )}
                <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                  task.status === "approved"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {task.status === "approved" ? "Published" : "Draft"}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {questions.length} question{questions.length !== 1 ? "s" : ""}
                  {" · "}
                  {questions.filter(q => q.status === "approved").length} approved
                </span>
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={task.c_compiler_enabled || false}
                  onChange={(e) => toggleCCompiler(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-[#00629B]"
                />
                <span className="text-xs font-bold text-gray-700">
                  Enable C Compiler Editor for Coding Questions
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              {task.status === "draft" ? (
                <button
                  onClick={publishTask}
                  className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4"
                >
                  <Send className="w-3.5 h-3.5" /> Publish to Members
                </button>
              ) : (
                <button
                  onClick={unpublishTask}
                  className="px-4 py-2 text-xs font-bold rounded-lg border transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Unpublish
                </button>
              )}
              <button
                onClick={deleteTask}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
            <button
              onClick={() => setTab("questions")}
              className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                tab === "questions" ? "bg-[#00629B] text-white" : ""
              }`}
              style={tab !== "questions" ? { color: "var(--text-muted)" } : {}}
            >
              Questions ({questions.length})
            </button>
            <button
              onClick={() => { setTab("submissions"); loadSubmissions(task.id); }}
              className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                tab === "submissions" ? "bg-[#00629B] text-white" : ""
              }`}
              style={tab !== "submissions" ? { color: "var(--text-muted)" } : {}}
            >
              <Eye className="w-3 h-3 inline mr-1" /> Submissions ({submissions.length})
            </button>
          </div>

          {/* Questions Tab */}
          {tab === "questions" && (
            <div className="space-y-4">
              <QuestionForm onAdd={addQuestion} />
              {questions.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
                  No questions yet. Click &quot;+ Add Question&quot; to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, i) => (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      index={i}
                      onApprove={() => updateQuestionStatus(q.id, "approved")}
                      onReject={() => updateQuestionStatus(q.id, "rejected")}
                      onDelete={() => deleteQuestion(q.id)}
                    />
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
              ) : (
                submissions.map(sub => (
                  <SubmissionReviewCard
                    key={sub.id}
                    submission={sub}
                    questions={questions}
                    onUpdateAnswer={updateAnswer}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
