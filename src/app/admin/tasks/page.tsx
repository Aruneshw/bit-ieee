"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Send, Eye, RefreshCw, Loader2, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TaskQuestion } from "@/lib/types";
import { QuestionForm, QuestionCard, SubmissionReviewCard } from "./components";

export default function AdminTaskPanel() {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<Record<string, TaskQuestion[]>>({});
  const [submissions, setSubmissions] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"mcq" | "coding" | "general">("mcq");
  const [newEventId, setNewEventId] = useState("");
  const [activeTab, setActiveTab] = useState<Record<string, "questions" | "submissions">>({});

  // Load everything on mount
  useEffect(() => {
    (async () => {
      const { data: evts } = await supabase.from("events")
        .select("id, name, society:societies(abbreviation)")
        .eq("status", "approved").order("created_at", { ascending: false });
      setEvents(evts || []);
      await loadAllTasks();
      setLoading(false);
    })();
  }, []);

  const loadAllTasks = useCallback(async () => {
    const { data } = await supabase.from("tasks")
      .select("*, event:events(name, society:societies(abbreviation))")
      .order("created_at", { ascending: false });
    const taskList = data || [];
    setTasks(taskList);

    // Load questions for each task
    const qMap: Record<string, TaskQuestion[]> = {};
    for (const t of taskList) {
      const { data: qs } = await supabase.from("task_questions")
        .select("*").eq("task_id", t.id).order("sort_order");
      qMap[t.id] = (qs || []) as TaskQuestion[];
    }
    setAllQuestions(qMap);
  }, []);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newEventId || !newTitle.trim()) return;
    // Prevent duplicate tasks per event
    const existing = tasks.find(t => t.event_id === newEventId);
    if (existing) {
      toast.error(`A task already exists for this event ("${existing.title}"). Add questions inside the existing task instead.`);
      return;
    }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("tasks").insert({
      event_id: newEventId, title: newTitle.trim(),
      description: newDesc.trim() || null, type: newType,
      status: "draft", questions: [], created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Task created! Now add questions below."); setNewTitle(""); setNewDesc(""); setNewEventId(""); await loadAllTasks(); }
    setCreating(false);
  }

  async function addQuestion(taskId: string, q: any) {
    const current = allQuestions[taskId] || [];
    const { error } = await supabase.from("task_questions").insert({
      task_id: taskId, type: q.type, text: q.text,
      options: q.options, correct_answer: q.correct_answer,
      points: q.points, sort_order: current.length, status: "draft",
    });
    if (error) toast.error(error.message);
    else { toast.success("Question added!"); await loadAllTasks(); }
  }

  async function updateQuestionStatus(id: string, status: string) {
    const { error } = await supabase.from("task_questions").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Question ${status}!`); await loadAllTasks(); }
  }

  async function deleteQuestion(id: string) {
    const { error } = await supabase.from("task_questions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted!"); await loadAllTasks(); }
  }

  async function publishTask(taskId: string) {
    const qs = allQuestions[taskId] || [];
    if (qs.filter(q => q.status === "approved").length === 0) {
      toast.error("Approve at least one question first!"); return;
    }
    const { error } = await supabase.from("tasks").update({ status: "approved" }).eq("id", taskId);
    if (error) toast.error(error.message);
    else { toast.success("Task published! Members can see it now."); await loadAllTasks(); }
  }

  async function deleteTask(taskId: string) {
    if (!confirm("Delete this task and all its questions? This cannot be undone.")) return;
    // Delete questions first, then task
    await supabase.from("task_questions").delete().eq("task_id", taskId);
    await supabase.from("submission_answers").delete().in("submission_id",
      (await supabase.from("task_submissions").select("id").eq("task_id", taskId)).data?.map(s => s.id) || []
    );
    await supabase.from("task_submissions").delete().eq("task_id", taskId);
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) toast.error(error.message);
    else { toast.success("Task deleted!"); await loadAllTasks(); }
  }

  async function loadSubmissions(taskId: string) {
    const { data } = await supabase.from("task_submissions")
      .select("*, user:users(name, email), submission_answers(*)")
      .eq("task_id", taskId).order("submitted_at", { ascending: false });
    setSubmissions(prev => ({ ...prev, [taskId]: data || [] }));
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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#00bfff]" /></div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-heading tracking-wide mb-2">Task Panel</h1>
          <p style={{ color: "var(--text-secondary)" }}>Create tasks for events, add questions, approve & review.</p>
        </div>
        <button onClick={loadAllTasks} className="btn-secondary text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Create New Task */}
      <form onSubmit={createTask} className="glass-card p-5 space-y-3 border-2" style={{ borderColor: "var(--accent-primary)" }}>
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}><Plus className="w-4 h-4" style={{ color: "var(--accent-primary)" }} /> Create New Task</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select value={newEventId} onChange={e => setNewEventId(e.target.value)} required className="input-field text-sm">
            <option value="">Select Event *</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} {ev.society?.abbreviation ? `(${ev.society.abbreviation})` : ""}</option>)}
          </select>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} required placeholder="Task title *" className="input-field text-sm" />
          <select value={newType} onChange={e => setNewType(e.target.value as any)} className="input-field text-sm">
            <option value="mcq">MCQ</option><option value="coding">Coding</option><option value="general">General</option>
          </select>
          <button type="submit" disabled={creating} className="btn-primary text-sm">{creating ? "Creating..." : "Create Task"}</button>
        </div>
        <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="input-field text-sm resize-none" />
      </form>

      {/* All Tasks — Open, Not Collapsed */}
      {tasks.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p style={{ color: "var(--text-muted)" }}>No tasks yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {tasks.map(task => {
            const qs = allQuestions[task.id] || [];
            const tab = activeTab[task.id] || "questions";
            const subs = submissions[task.id] || [];

            return (
              <div key={task.id} className="glass-card p-6 space-y-4" style={{ borderColor: "var(--border)" }}>
                {/* Task Header — always visible */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{task.title || "Untitled"}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${task.type === "mcq" ? "bg-blue-100 text-blue-700" : task.type === "coding" ? "bg-purple-100 text-purple-700" : "bg-cyan-100 text-cyan-700"}`}>{task.type}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${task.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{task.status}</span>
                    </div>
                    <p className="text-sm mt-1 flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                      <ChevronRight className="w-3 h-3" /> Event: <strong style={{ color: "var(--text-primary)" }}>{task.event?.name || "—"}</strong>
                      {task.event?.society?.abbreviation && <span className="ml-1" style={{ color: "var(--text-muted)" }}>({task.event.society.abbreviation})</span>}
                    </p>
                    {task.description && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{task.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === "draft" && (
                      <button onClick={() => publishTask(task.id)} className="btn-primary text-xs flex items-center gap-1.5 py-1.5">
                        <Send className="w-3 h-3" /> Publish
                      </button>
                    )}
                    <button onClick={() => deleteTask(task.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete Task">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
                  <button onClick={() => setActiveTab(p => ({ ...p, [task.id]: "questions" }))}
                    className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === "questions" ? "bg-[#00629B] text-white" : ""}`}
                    style={tab !== "questions" ? { color: "var(--text-muted)" } : {}}>
                    Questions ({qs.length})
                  </button>
                  <button onClick={() => { setActiveTab(p => ({ ...p, [task.id]: "submissions" })); loadSubmissions(task.id); }}
                    className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === "submissions" ? "bg-[#00629B] text-white" : ""}`}
                    style={tab !== "submissions" ? { color: "var(--text-muted)" } : {}}>
                    <Eye className="w-3 h-3 inline mr-1" /> Submissions
                  </button>
                </div>

                {/* Content */}
                {tab === "questions" ? (
                  <div className="space-y-4">
                    <QuestionForm onAdd={(q) => addQuestion(task.id, q)} />
                    {qs.length === 0 ? (
                      <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>No questions yet. Click "Add Question" above.</p>
                    ) : (
                      <div className="space-y-3">
                        {qs.map((q, i) => (
                          <QuestionCard key={q.id} q={q} index={i}
                            onApprove={() => updateQuestionStatus(q.id, "approved")}
                            onReject={() => updateQuestionStatus(q.id, "rejected")}
                            onDelete={() => deleteQuestion(q.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {subs.length === 0 ? (
                      <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>No submissions yet.</p>
                    ) : subs.map(sub => (
                      <SubmissionReviewCard key={sub.id} submission={sub} questions={qs} onUpdateAnswer={updateAnswer} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
