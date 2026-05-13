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

      const { data: bookings } = await supabase.from("event_bookings").select("event_id").eq("user_id", user.id);
      const bookedIds = (bookings || []).map(b => b.event_id);
      if (bookedIds.length === 0) { setLoading(false); return; }

      const { data: evts } = await supabase.from("events")
        .select("id, name, description, date, venue, event_type, society:societies(abbreviation)")
        .in("id", bookedIds)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      const { data: tasks } = await supabase.from("tasks")
        .select("id, event_id, title, type, status")
        .eq("status", "approved")
        .in("event_id", bookedIds);

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

  async function openEvent(event: any) {
    setSelectedEvent(event);
    const eventTasks = event.tasks || [];

    if (eventTasks.length === 0) {
      toast.info("No tasks available for this event yet.");
      return;
    }

    const task = eventTasks[0];
    setTaskId(task.id);

    // Load all approved questions
    const { data: qs } = await supabase.from("task_questions").select("*")
      .eq("task_id", task.id).eq("status", "approved").order("sort_order");
    setQuestions((qs || []) as TaskQuestion[]);

    // Check existing submission
    const { data: sub } = await supabase.from("task_submissions")
      .select("*, submission_answers(*, question:task_questions(*))")
      .eq("task_id", task.id).eq("user_id", userId).single();

    if (sub?.completed) {
      const answeredCount = (sub.submission_answers || []).length;
      const totalApproved = (qs || []).length;

      // If new questions were added after submission, let member re-answer
      if (totalApproved > answeredCount) {
        toast.info(`${totalApproved - answeredCount} new question(s) added! Please re-submit.`);
        // Delete old submission so they can start fresh
        await supabase.from("submission_answers").delete().eq("submission_id", sub.id);
        await supabase.from("task_submissions").delete().eq("id", sub.id);
        const init: Record<string, { text: string; option: number | null }> = {};
        (qs || []).forEach((q: any) => { init[q.id] = { text: "", option: null }; });
        setAnswers(init);
        setView("questions");
        return;
      }

      // Otherwise show results
      setExistingSub(sub);
      setReviewAnswers((sub.submission_answers || []) as SubmissionAnswer[]);
      setView("result");
      return;
    }

    // No submission yet — show questions
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
        <button onClick={goBack} className="flex items-center gap-2 text-sm transition-colors" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </button>
        <div>
          <h1 className="text-3xl font-heading tracking-wide" style={{ color: "var(--text-primary)" }}>{selectedEvent.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700 uppercase">Submitted</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${existingSub?.review_status === "reviewed" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
              {existingSub?.review_status === "reviewed" ? "Reviewed" : "Pending Review"}
            </span>
            {existingSub?.score !== undefined && <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Score: {existingSub.score}</span>}
          </div>
        </div>
        <div className="space-y-4">
          {reviewAnswers.map((ans, i) => {
            const q = ans.question || questions.find(qq => qq.id === ans.question_id);
            return (
              <div key={ans.id} className="glass-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Q{i + 1}: {q?.text}</p>
                  {ans.is_correct !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${ans.is_correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {ans.is_correct ? "✓ Correct" : "✗ Wrong"}
                    </span>
                  )}
                </div>
                <div className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                  <p className="text-sm font-mono whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
                    {ans.answer_text || (ans.selected_option !== null && q?.options ? `${String.fromCharCode(65 + ans.selected_option)}: ${(q.options as string[])[ans.selected_option]}` : "No answer")}
                  </p>
                </div>
                {ans.admin_remarks && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700">{ans.admin_remarks}</p>
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
        <button onClick={goBack} className="flex items-center gap-2 text-sm transition-colors" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </button>
        <div>
          <h1 className="text-3xl font-heading tracking-wide" style={{ color: "var(--text-primary)" }}>{selectedEvent.name}</h1>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{questions.length} question{questions.length !== 1 ? "s" : ""}</p>
        </div>

        {questions.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-secondary)" }}>No questions approved yet. Check back later.</p>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id} className="glass-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Q{i + 1}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${q.type === "mcq" ? "bg-blue-100 text-blue-700" : q.type === "coding" ? "bg-purple-100 text-purple-700" : "bg-cyan-100 text-cyan-700"}`}>{q.type}</span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{q.points} pts</span>
                  </div>
                  <p className="font-medium" style={{ color: "var(--text-primary)" }}>{q.text}</p>

                  {q.type === "mcq" && q.options && Array.isArray(q.options) ? (
                    <div className="space-y-2">
                      {(q.options as string[]).map((opt: string, oIdx: number) => (
                        <label key={oIdx} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${answers[q.id]?.option === oIdx ? "bg-blue-50 border-blue-400" : "hover:bg-gray-50"}`}
                          style={answers[q.id]?.option !== oIdx ? { borderColor: "var(--border)", color: "var(--text-primary)" } : { color: "#00629B" }}>
                          <input type="radio" name={`q-${q.id}`} checked={answers[q.id]?.option === oIdx}
                            onChange={() => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], option: oIdx } }))}
                            className="accent-[#00629B] w-4 h-4" />
                          <span className="text-sm">{String.fromCharCode(65 + oIdx)}. {opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : q.type === "coding" ? (
                    <textarea rows={10} value={answers[q.id]?.text || ""}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], text: e.target.value } }))}
                      className="w-full rounded-lg p-4 font-mono text-sm focus:outline-none"
                      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
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
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2" style={{ color: "var(--text-primary)" }}>My Tasks</h1>
        <p style={{ color: "var(--text-secondary)" }}>Your booked events with available tasks.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent-primary)" }} /></div>
      ) : bookedEvents.length === 0 ? (
        <div className="glass-card p-12 text-center border border-dashed" style={{ borderColor: "var(--border)" }}>
          <ClipboardList className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <p className="font-medium" style={{ color: "var(--text-secondary)" }}>No booked events.</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Book events first to see tasks here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookedEvents.map(event => {
            const eventTasks = event.tasks || [];
            const hasApproved = eventTasks.length > 0;
            const firstTask = eventTasks[0];
            const sub = firstTask?.submission;
            const statusLabel = !hasApproved ? "No Tasks Yet" : sub?.completed ? (sub.review_status === "reviewed" ? "Reviewed" : "Submitted") : "Start Task";
            const statusColor = !hasApproved ? "bg-gray-100 text-gray-500" : sub?.completed ? (sub.review_status === "reviewed" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700") : "bg-amber-100 text-amber-700";

            return (
              <button key={event.id} onClick={() => openEvent(event)} disabled={!hasApproved}
                className={`w-full text-left glass-card p-5 transition-all border group ${hasApproved ? "cursor-pointer" : "opacity-60 cursor-not-allowed"}`}
                style={{ borderColor: "var(--border)" }}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--bg-secondary)", color: "var(--accent-primary)" }}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>{event.name}</h3>
                      {event.society?.abbreviation && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>({event.society.abbreviation})</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusColor}`}>{statusLabel}</span>
                    </div>
                    {event.description && <p className="text-sm mt-1 truncate" style={{ color: "var(--text-muted)" }}>{event.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
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
