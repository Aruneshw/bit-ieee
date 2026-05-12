"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { CheckSquare, Plus, Send, Eye, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { TaskQuestion } from "@/lib/types";
import { QuestionForm, QuestionCard, SubmissionReviewCard } from "./components";

type Tab = "questions" | "submissions";

export default function AdminTaskPanel() {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [questions, setQuestions] = useState<TaskQuestion[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("questions");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"mcq" | "coding" | "general">("mcq");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("events")
        .select("*, society:societies(name, abbreviation)")
        .eq("status", "approved").order("created_at", { ascending: false });
      setEvents(data || []);
      setLoading(false);
    })();
  }, []);

  const loadTasks = useCallback(async (eventId: string) => {
    setSelectedEvent(eventId);
    setSelectedTask(null);
    const { data } = await supabase.from("tasks").select("*")
      .eq("event_id", eventId).order("created_at", { ascending: false });
    setTasks(data || []);
  }, []);

  const loadQuestions = useCallback(async (task: any) => {
    setSelectedTask(task);
    setTab("questions");
    const { data } = await supabase.from("task_questions").select("*")
      .eq("task_id", task.id).order("sort_order");
    setQuestions((data || []) as TaskQuestion[]);
  }, []);

  const loadSubmissions = useCallback(async (taskId: string) => {
    const { data } = await supabase.from("task_submissions")
      .select("*, user:users(name, email), submission_answers(*)")
      .eq("task_id", taskId).order("submitted_at", { ascending: false });
    setSubmissions(data || []);
  }, []);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent || !newTitle.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("tasks").insert({
      event_id: selectedEvent, title: newTitle.trim(),
      description: newDesc.trim() || null, type: newType,
      status: "draft", questions: [], created_by: user?.id,
    });
    if (error) { toast.error(error.message); }
    else { toast.success("Task created!"); setNewTitle(""); setNewDesc(""); loadTasks(selectedEvent); }
    setCreating(false);
  }

  async function addQuestion(q: { type: string; text: string; options: string[]; correct_answer: string | null; points: number }) {
    if (!selectedTask) return;
    const { error } = await supabase.from("task_questions").insert({
      task_id: selectedTask.id, type: q.type, text: q.text,
      options: q.options, correct_answer: q.correct_answer,
      points: q.points, sort_order: questions.length, status: "draft",
    });
    if (error) toast.error(error.message);
    else { toast.success("Question added!"); loadQuestions(selectedTask); }
  }

  async function updateQuestionStatus(id: string, status: string) {
    const { error } = await supabase.from("task_questions").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Question ${status}!`); if (selectedTask) loadQuestions(selectedTask); }
  }

  async function deleteQuestion(id: string) {
    const { error } = await supabase.from("task_questions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Question deleted!"); if (selectedTask) loadQuestions(selectedTask); }
  }

  async function publishTask() {
    if (!selectedTask) return;
    const approved = questions.filter(q => q.status === "approved");
    if (approved.length === 0) { toast.error("Approve at least one question first!"); return; }
    const { error } = await supabase.from("tasks").update({ status: "approved" }).eq("id", selectedTask.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Task published! Members can now see it.");
      setSelectedTask({ ...selectedTask, status: "approved" });
      if (selectedEvent) loadTasks(selectedEvent);
    }
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#00bfff]" /></div>;
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Task Panel</h1>
        <p className="text-gray-400">Create tasks, add questions, approve & review submissions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Col 1: Event List */}
        <div className="lg:col-span-3 glass-card p-4 space-y-2 max-h-[80vh] overflow-y-auto">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2 mb-2">Events</h3>
          {events.length === 0 ? (
            <p className="text-gray-500 text-sm px-2">No approved events</p>
          ) : events.map(ev => (
            <button key={ev.id} onClick={() => loadTasks(ev.id)}
              className={`w-full text-left p-3 rounded-lg transition-all text-sm ${selectedEvent === ev.id ? "bg-[#00629B]/20 border border-[#00629B]/30 text-[#00bfff]" : "hover:bg-white/5 text-gray-300"}`}>
              <p className="font-medium">{ev.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{ev.society?.abbreviation} • {ev.event_type}</p>
            </button>
          ))}
        </div>

        {/* Col 2: Tasks + Details */}
        <div className="lg:col-span-9 space-y-4">
          {selectedEvent ? (
            <>
              {/* Create Task */}
              <form onSubmit={createTask} className="glass-card p-5 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4 text-[#00bfff]" /> New Task</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} required placeholder="Task title" className="input-field text-sm sm:col-span-2" />
                  <select value={newType} onChange={e => setNewType(e.target.value as any)} className="input-field text-sm">
                    <option value="mcq">MCQ</option><option value="coding">Coding</option><option value="general">General</option>
                  </select>
                </div>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="input-field text-sm resize-none" />
                <button type="submit" disabled={creating} className="btn-primary text-sm">{creating ? "Creating..." : "Create Task"}</button>
              </form>

              {/* Task List */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-bold mb-3">Tasks ({tasks.length})</h3>
                {tasks.length === 0 ? (
                  <p className="text-gray-500 text-sm">No tasks yet.</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <button key={task.id} onClick={() => loadQuestions(task)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${selectedTask?.id === task.id ? "border-[#00bfff]/30 bg-[#00629B]/10" : "border-white/5 hover:bg-white/5"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-white">{task.title || "Untitled"}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${task.type === "mcq" ? "bg-blue-500/20 text-blue-400" : task.type === "coding" ? "bg-purple-500/20 text-purple-400" : "bg-cyan-500/20 text-cyan-400"}`}>{task.type}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${task.status === "approved" ? "bg-green-500/20 text-green-400" : task.status === "draft" ? "bg-yellow-500/20 text-yellow-400" : "bg-gray-500/20 text-gray-400"}`}>{task.status}</span>
                          </div>
                          <span className="text-xs text-gray-500">{new Date(task.created_at).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Task Detail */}
              {selectedTask && (
                <div className="glass-card p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">{selectedTask.title}</h3>
                      {selectedTask.description && <p className="text-sm text-gray-400 mt-1">{selectedTask.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedTask.status === "draft" && (
                        <button onClick={publishTask} className="btn-primary text-sm flex items-center gap-2">
                          <Send className="w-4 h-4" /> Publish Task
                        </button>
                      )}
                      <button onClick={() => { if (selectedTask) loadQuestions(selectedTask); }} className="p-2 rounded-lg hover:bg-white/5 text-gray-500" title="Refresh">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                    <button onClick={() => setTab("questions")} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === "questions" ? "bg-[#00629B] text-white" : "text-gray-500"}`}>
                      Questions ({questions.length})
                    </button>
                    <button onClick={() => { setTab("submissions"); loadSubmissions(selectedTask.id); }} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === "submissions" ? "bg-[#00629B] text-white" : "text-gray-500"}`}>
                      <Eye className="w-3 h-3 inline mr-1" /> Submissions
                    </button>
                  </div>

                  {tab === "questions" ? (
                    <div className="space-y-4">
                      <QuestionForm onAdd={addQuestion} />
                      <div className="space-y-3">
                        {questions.map((q, i) => (
                          <QuestionCard key={q.id} q={q} index={i}
                            onApprove={() => updateQuestionStatus(q.id, "approved")}
                            onReject={() => updateQuestionStatus(q.id, "rejected")}
                            onDelete={() => deleteQuestion(q.id)} />
                        ))}
                        {questions.length === 0 && <p className="text-gray-500 text-sm text-center py-6">No questions yet. Add one above.</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {submissions.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-6">No submissions yet.</p>
                      ) : submissions.map(sub => (
                        <SubmissionReviewCard key={sub.id} submission={sub} questions={questions} onUpdateAnswer={updateAnswer} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="glass-card p-12 text-center">
              <CheckSquare className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">Select an event to manage its tasks.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
