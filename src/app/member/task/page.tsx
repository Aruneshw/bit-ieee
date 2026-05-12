"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { ClipboardList, Code, FileText, HelpCircle, CheckCircle, Clock, Send, ArrowLeft, Loader2, MessageSquare, Calendar } from "lucide-react";
import { toast } from "sonner";
import type { TaskQuestion, SubmissionAnswer } from "@/lib/types";

type View = "events" | "questions" | "result";

export default function MemberTaskPage() {
  const supabase = createClient();
  const [view, setView] = useState<View>("events");
  const [bookedEvents, setBookedEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [questions, setQuestions] = useState<TaskQuestion[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, { text: string; option: number | null }>>({});
  const [existingSub, setExistingSub] = useState<any | null>(null);
  const [reviewAnswers, setReviewAnswers] = useState<SubmissionAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState("");

  // Load booked events
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      // Get booked event IDs
      const { data: bookings } = await supabase.from("event_bookings").select("event_id").eq("user_id", user.id);
      const bookedIds = (bookings || []).map(b => b.event_id);
      if (bookedIds.length === 0) { setLoading(false); return; }

      // Get event details
      const { data: evts } = await supabase.from("events")
        .select("id, name, description, date, venue, event_type, society:societies(abbreviation)")
        .in("id", bookedIds)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      // Check which events have approved tasks
      const { data: tasks } = await supabase.from("tasks")
        .select("id, event_id, title, type, status")
        .eq("status", "approved")
        .in("event_id", bookedIds);

      // Check submissions
      const { data: subs } = await supabase.from("task_submissions")
        .select("task_id, completed, review_status")
        .eq("user_id", user.id);

      const taskMap = new Map<string, any[]>();
      (tasks || []).forEach(t => {
        const list = taskMap.get(t.event_id) || [];
        list.push(t);
        taskMap.set(t.event_id, list);
      });

      const subMap = new Map((subs || []).map(s => [s.task_id, s]));

      const enriched = (evts || []).map(ev => ({
        ...ev,
        tasks: (taskMap.get(ev.id) || []).map(t => ({ ...t, submission: subMap.get(t.id) || null })),
        hasTask: taskMap.has(ev.id),
      }));

      setBookedEvents(enriched);
      setLoading(false);
    })();
  }, []);

  // Open event → load approved questions from all approved tasks for this event
  async function openEvent(event: any) {
    setSelectedEvent(event);
    const eventTasks = event.tasks || [];

    if (eventTasks.length === 0) {
      toast.info("No tasks available for this event yet.");
      return;
    }

    // Use first approved task
    const task = eventTasks[0];
    setTaskId(task.id);

    // Check existing submission
    const { data: sub } = await supabase.from("task_submissions")
      .select("*, submission_answers(*, question:task_questions(*))")
      .eq("task_id", task.id).eq("user_id", userId).single();

    if (sub?.completed) {
      setExistingSub(sub);
      setReviewAnswers((sub.submission_answers || []) as SubmissionAnswer[]);
      // Load questions for result view
      const { data: qs } = await supabase.from("task_questions").select("*")
        .eq("task_id", task.id).eq("status", "approved").order("sort_order");
      setQuestions((qs || []) as TaskQuestion[]);
      setView("result");
      return;
    }

    // Load approved questions
    const { data: qs } = await supabase.from("task_questions").select("*")
      .eq("task_id", task.id).eq("status", "approved").order("sort_order");
    setQuestions((qs || []) as TaskQuestion[]);

    // Init answers
    const init: Record<string, { text: string; option: number | null }> = {};
    (qs || []).forEach((q: any) => { init[q.id] = { text: "", option: null }; });
    setAnswers(init);
    setView("questions");
  }

  async function submitTask() {
    if (!taskId) return;
    setSubmitting(true);
    try {
      let score = 0;
      for (const q of questions) {
        const ans = answers[q.id];
        if (q.type === "mcq" && q.correct_answer !== null && ans?.option !== null) {
          if (String(ans.option) === q.correct_answer) score += q.points;
        }
      }

      const { data: submission, error: subErr } = await supabase.from("task_submissions").insert({
        task_id: taskId, user_id: userId,
        answers: Object.entries(answers).map(([qId, a]) => ({ question_id: qId, ...a })),
        score, completed: true, review_status: "pending",
      }).select().single();
      if (subErr) throw subErr;

      const answerRows = questions.map(q => ({
        submission_id: submission.id, question_id: q.id,
        answer_text: answers[q.id]?.text || null,
        selected_option: answers[q.id]?.option ?? null,
      }));
      if (answerRows.length > 0) {
        const { error: ansErr } = await supabase.from("submission_answers").insert(answerRows);
        if (ansErr) throw ansErr;
      }

      toast.success(`Submitted! Auto-scored MCQs: ${score} pts`);
      setView("events");
      // Update local state
      setBookedEvents(prev => prev.map(ev => ev.id === selectedEvent?.id ? {
        ...ev, tasks: ev.tasks.map((t: any) => t.id === taskId ? { ...t, submission: { completed: true, review_status: "pending" } } : t)
      } : ev));
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  function goBack() {
    setView("events");
    setSelectedEvent(null);
    setExistingSub(null);
    setQuestions([]);
  }

  // ── Result View ──
  if (view === "result" && selectedEvent) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
        <button onClick={goBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </button>
        <div>
          <h1 className="text-3xl font-heading tracking-wide">{selectedEvent.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 uppercase">Submitted</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${existingSub?.review_status === "reviewed" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>
              {existingSub?.review_status === "reviewed" ? "Reviewed" : "Pending Review"}
            </span>
            {existingSub?.score !== undefined && <span className="text-sm text-gray-400">Score: {existingSub.score}</span>}
          </div>
        </div>
        <div className="space-y-4">
          {reviewAnswers.map((ans, i) => {
            const q = ans.question || questions.find(qq => qq.id === ans.question_id);
            return (
              <div key={ans.id} className="glass-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-white">Q{i + 1}: {q?.text}</p>
                  {ans.is_correct !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${ans.is_correct ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {ans.is_correct ? "✓ Correct" : "✗ Wrong"}
                    </span>
                  )}
                </div>
                <div className="p-3 bg-black/30 rounded-lg">
                  <p className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                    {ans.answer_text || (ans.selected_option !== null && q?.options ? `${String.fromCharCode(65 + ans.selected_option)}: ${(q.options as string[])[ans.selected_option]}` : "No answer")}
                  </p>
                </div>
                {ans.admin_remarks && (
                  <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                    <MessageSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-300">{ans.admin_remarks}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Questions View (answer) ──
  if (view === "questions" && selectedEvent) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
        <button onClick={goBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </button>
        <div>
          <h1 className="text-3xl font-heading tracking-wide">{selectedEvent.name}</h1>
          <p className="text-xs text-gray-500 mt-2">{questions.length} question{questions.length !== 1 ? "s" : ""}</p>
        </div>

        {questions.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">No questions approved yet. Check back later.</p>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id} className="glass-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">Q{i + 1}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${q.type === "mcq" ? "bg-blue-500/20 text-blue-400" : q.type === "coding" ? "bg-purple-500/20 text-purple-400" : "bg-cyan-500/20 text-cyan-400"}`}>{q.type}</span>
                    <span className="text-[10px] text-gray-500">{q.points} pts</span>
                  </div>
                  <p className="text-white font-medium">{q.text}</p>

                  {q.type === "mcq" && q.options && Array.isArray(q.options) ? (
                    <div className="space-y-2">
                      {(q.options as string[]).map((opt: string, oIdx: number) => (
                        <label key={oIdx} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${answers[q.id]?.option === oIdx ? "bg-[#00629B]/20 border-[#00bfff]/40 text-[#00bfff]" : "border-white/10 hover:bg-white/5 text-gray-300"}`}>
                          <input type="radio" name={`q-${q.id}`} checked={answers[q.id]?.option === oIdx}
                            onChange={() => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], option: oIdx } }))}
                            className="accent-[#00bfff] w-4 h-4" />
                          <span className="text-sm">{String.fromCharCode(65 + oIdx)}. {opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : q.type === "coding" ? (
                    <textarea rows={10} value={answers[q.id]?.text || ""}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], text: e.target.value } }))}
                      className="w-full bg-[#0a1628] border border-white/10 rounded-lg p-4 font-mono text-green-400 focus:outline-none focus:border-[#00bfff] text-sm"
                      placeholder="Write your code here..." />
                  ) : (
                    <textarea rows={5} value={answers[q.id]?.text || ""}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], text: e.target.value } }))}
                      className="input-field resize-none text-sm" placeholder="Type your answer here..." />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end pb-8">
              <button onClick={submitTask} disabled={submitting} className="btn-primary px-8 py-3 text-lg flex items-center gap-2">
                {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : <><Send className="w-5 h-5" /> Submit</>}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Events List View ──
  const typeIcons: Record<string, React.ReactNode> = {
    mcq: <HelpCircle className="w-5 h-5" />, coding: <Code className="w-5 h-5" />, general: <FileText className="w-5 h-5" />,
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">My Tasks</h1>
        <p className="text-gray-400">Your booked events with available tasks.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-[#00bfff]" /></div>
      ) : bookedEvents.length === 0 ? (
        <div className="glass-card p-12 text-center border border-dashed border-white/10">
          <ClipboardList className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 font-medium">No booked events.</p>
          <p className="text-gray-500 text-sm mt-1">Book events first to see tasks here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookedEvents.map(event => {
            const eventTasks = event.tasks || [];
            const hasApproved = eventTasks.length > 0;
            const firstTask = eventTasks[0];
            const sub = firstTask?.submission;
            const statusLabel = !hasApproved ? "No Tasks Yet" : sub?.completed ? (sub.review_status === "reviewed" ? "Reviewed" : "Submitted") : "Start Task";
            const statusColor = !hasApproved ? "bg-gray-500/20 text-gray-400" : sub?.completed ? (sub.review_status === "reviewed" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400") : "bg-amber-500/20 text-amber-400";

            return (
              <button key={event.id} onClick={() => openEvent(event)} disabled={!hasApproved}
                className={`w-full text-left glass-card p-5 transition-all border border-white/5 group ${hasApproved ? "hover:border-[#00bfff]/20 cursor-pointer" : "opacity-60 cursor-not-allowed"}`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#00629B]/10 text-[#00bfff] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-white group-hover:text-[#00bfff] transition-colors">{event.name}</h3>
                      {event.society?.abbreviation && <span className="text-[10px] text-gray-500">({event.society.abbreviation})</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusColor}`}>{statusLabel}</span>
                    </div>
                    {event.description && <p className="text-sm text-gray-500 mt-1 truncate">{event.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {event.date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(event.date).toLocaleDateString()}</span>}
                      {hasApproved && <span>{eventTasks.length} task{eventTasks.length !== 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
