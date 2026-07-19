"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, CheckCircle, Clock, Send, ArrowLeft,
  Loader2, MessageSquare, Calendar, Lock,
  Image as ImageIcon, X
} from "lucide-react";
import { toast } from "sonner";
import type { TaskQuestion, SubmissionAnswer } from "@/lib/types";
import CodingQuestionEditor from "./coding-editor";

/**
 * Member Task Page
 *
 * Shows booked events with available tasks.
 * Members answer approved questions incrementally —
 * reviewed answers are locked; new questions are answerable.
 */
export default function MemberTaskPage() {
  const supabase = createClient();
  const [view, setView] = useState<"events" | "task">("events");
  const [bookedEvents, setBookedEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [questions, setQuestions] = useState<TaskQuestion[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [existingAnswers, setExistingAnswers] = useState<Record<string, SubmissionAnswer>>({});
  const [newAnswers, setNewAnswers] = useState<Record<string, { text: string; option: number | null; image_url?: string | null }>>({});
  const [imageUploading, setImageUploading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submittingQId, setSubmittingQId] = useState<string | null>(null);
  const [userId, setUserId] = useState("");

  const handleImageUpload = async (qId: string, file: File) => {
    setImageUploading(prev => ({ ...prev, [qId]: true }));
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${qId}-${Date.now()}.${fileExt}`;
      const filePath = `task-attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      setNewAnswers(prev => ({
        ...prev,
        [qId]: { ...prev[qId], image_url: publicUrl }
      }));
      toast.success("Image uploaded successfully!");
    } catch (err: any) {
      toast.error("Failed to upload image: " + err.message);
    } finally {
      setImageUploading(prev => ({ ...prev, [qId]: false }));
    }
  };

  /**
   * Load booked events + their task status on mount.
   * Uses batch queries to minimize DB round-trips.
   */
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setUserId(user.id);

        // Batch: bookings, events, tasks, submissions
        const { data: bookings } = await supabase
          .from("event_bookings")
          .select("event_id")
          .eq("user_id", user.id);
        const bookedIds = (bookings || []).map(b => b.event_id);
        if (bookedIds.length === 0) { setLoading(false); return; }

        const [evtRes, taskRes, subRes] = await Promise.all([
          supabase.from("events")
            .select("id, name, description, date, venue, event_type, society:societies(abbreviation)")
            .in("id", bookedIds)
            .eq("status", "approved")
            .order("date", { ascending: false }),
          supabase.from("tasks")
            .select("id, event_id, title, type, status, c_compiler_enabled")
            .in("event_id", bookedIds),
          supabase.from("task_submissions")
            .select("task_id, completed, review_status")
            .eq("user_id", user.id),
        ]);

        const taskMap = new Map<string, any[]>();
        (taskRes.data || []).forEach(t => {
          const list = taskMap.get(t.event_id) || [];
          list.push(t);
          taskMap.set(t.event_id, list);
        });
        const subMap = new Map((subRes.data || []).map(s => [s.task_id, s]));

        const enriched = (evtRes.data || []).map(ev => ({
          ...ev,
          tasks: (taskMap.get(ev.id) || []).map(t => ({
            ...t,
            submission: subMap.get(t.id) || null,
          })),
          hasTask: taskMap.has(ev.id),
        }));

        setBookedEvents(enriched);
      } catch (err: any) {
        toast.error("Failed to load events: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * Open an event's task — loads approved questions and existing answers.
   * Separates answered vs unanswered questions for the mixed view.
   */
  const openEvent = useCallback(async (event: any) => {
    setSelectedEvent(event);
    const eventTasks = event.tasks || [];
    if (eventTasks.length === 0) {
      toast.info("No tasks available for this event yet.");
      return;
    }

    const task = eventTasks[0];
    setTaskId(task.id);

    try {
      // Load approved questions
      const { data: qs, error: qErr } = await supabase
        .from("task_questions")
        .select("*")
        .eq("task_id", task.id)
        .eq("status", "approved")
        .order("sort_order");
      if (qErr) throw qErr;
      setQuestions((qs || []) as TaskQuestion[]);

      // Load existing submission + answers
      const { data: sub } = await supabase
        .from("task_submissions")
        .select("*, submission_answers(*)")
        .eq("task_id", task.id)
        .eq("user_id", userId)
        .maybeSingle();

      const answeredMap: Record<string, SubmissionAnswer> = {};
      if (sub) {
        setSubmissionId(sub.id);
        (sub.submission_answers || []).forEach((a: SubmissionAnswer) => {
          answeredMap[a.question_id] = a;
        });
      } else {
        setSubmissionId(null);
      }
      setExistingAnswers(answeredMap);

      // Init new answers only for unanswered questions
      const init: Record<string, { text: string; option: number | null }> = {};
      (qs || []).forEach((q: any) => {
        if (!answeredMap[q.id]) {
          init[q.id] = { text: "", option: null };
        }
      });
      setNewAnswers(init);
      setView("task");
    } catch (err: any) {
      toast.error("Failed to load task: " + err.message);
    }
  }, [userId]);

  /**
   * Submit answer for a single question.
   * Creates submission record if needed, then inserts the individual answer.
   */
  async function submitSingleAnswer(questionId: string) {
    if (!taskId) return;
    const ans = newAnswers[questionId];
    if (!ans) return;
    
    // Validate: must have some content
    const q = questions.find(qq => qq.id === questionId);
    if (q?.type === "mcq" && ans.option === null) {
      toast.error("Please select an option before submitting.");
      return;
    }
    if ((q?.type === "coding" || q?.type === "general") && !ans.text?.trim()) {
      toast.error("Please type your answer before submitting.");
      return;
    }

    setSubmittingQId(questionId);

    try {
      let subId = submissionId;

      // Create submission if none exists
      if (!subId) {
        const { data: newSub, error } = await supabase
          .from("task_submissions")
          .insert({
            task_id: taskId,
            user_id: userId,
            answers: [],
            score: 0,
            completed: true,
            review_status: "pending",
          })
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            const { data: existing } = await supabase
              .from("task_submissions")
              .select("id")
              .eq("task_id", taskId)
              .eq("user_id", userId)
              .single();
            if (existing) subId = existing.id;
            else throw error;
          } else {
            throw error;
          }
        } else {
          subId = newSub.id;
        }
        setSubmissionId(subId);
      }

      // Auto-score if MCQ
      let isAutoCorrect: boolean | null = null;
      if (q?.type === "mcq" && q.correct_answer !== null && ans.option !== null) {
        isAutoCorrect = String(ans.option) === q.correct_answer;
      }

      // Insert single answer
      const { error: ansErr } = await supabase
        .from("submission_answers")
        .insert({
          submission_id: subId!,
          question_id: questionId,
          answer_text: ans.text?.trim() || null,
          selected_option: ans.option ?? null,
          image_url: ans.image_url || null,
        });

      if (ansErr) {
        if (ansErr.code === "23505") {
          toast.error("You already answered this question.");
          return;
        }
        throw ansErr;
      }

      // Update submission
      await supabase
        .from("task_submissions")
        .update({ completed: true, review_status: "pending" })
        .eq("id", subId!);

      toast.success("Answer submitted!");

      // Move to existing answers
      setExistingAnswers(prev => ({
        ...prev,
        [questionId]: {
          question_id: questionId,
          answer_text: ans.text?.trim() || null,
          selected_option: ans.option ?? null,
          image_url: ans.image_url || null,
          is_correct: isAutoCorrect,
          admin_remarks: null,
        } as any,
      }));
      setNewAnswers(prev => {
        const copy = { ...prev };
        delete copy[questionId];
        return copy;
      });
    } catch (err: any) {
      toast.error(err.message || "Submission failed.");
    } finally {
      setSubmittingQId(null);
    }
  }

  /** Navigate back to events list */
  function goBack() {
    setView("events");
    setSelectedEvent(null);
    setQuestions([]);
    setExistingAnswers({});
    setNewAnswers({});
    setSubmissionId(null);
    setTaskId(null);
  }

  // ── Task View (mixed: reviewed + new questions) ──
  if (view === "task" && selectedEvent) {
    const unansweredCount = Object.keys(newAnswers).length;
    const allAnswered = unansweredCount === 0;

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </button>

        <div>
          <h1 className="text-3xl font-heading tracking-wide" style={{ color: "var(--text-primary)" }}>
            {selectedEvent.name}
          </h1>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            {questions.length} question{questions.length !== 1 ? "s" : ""}
            {unansweredCount > 0 && (
              <span style={{ color: "var(--accent-primary)" }}>
                {" · "}{unansweredCount} new to answer
              </span>
            )}
            {allAnswered && questions.length > 0 && " · All answered ✓"}
          </p>
        </div>

        {questions.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-secondary)" }}>
              No questions approved yet. Check back later.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              {questions.map((q, i) => {
                const existing = existingAnswers[q.id];
                const isNew = !existing;

                // ── Locked (already answered) ──
                if (!isNew) {
                  return (
                    <div key={q.id} className="glass-card p-5 space-y-3 opacity-90">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                        <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                          Q{i + 1}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          q.type === "mcq" ? "bg-blue-100 text-blue-700"
                          : q.type === "coding" ? "bg-purple-100 text-purple-700"
                          : "bg-cyan-100 text-cyan-700"
                        }`}>{q.type}</span>
                        {existing.is_correct !== null ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            existing.is_correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}>
                            {existing.is_correct ? "✓ Correct" : "✗ Wrong"}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
                            Pending Review
                          </span>
                        )}
                      </div>
                      <p className="font-medium whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{q.text}</p>
                      {q.image_url && (
                        <div className="mt-2 border rounded-lg overflow-hidden max-w-md bg-black/5 p-1">
                          <a href={q.image_url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90">
                            <img src={q.image_url} alt="Question Attachment" className="max-h-60 object-contain rounded" />
                          </a>
                        </div>
                      )}
                      <div className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                        <p className="text-sm font-mono whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
                          {existing.answer_text
                            || (existing.selected_option !== null && q.options
                              ? `${String.fromCharCode(65 + existing.selected_option)}: ${(q.options as string[])[existing.selected_option]}`
                              : "No answer")}
                        </p>
                      </div>
                      {existing.image_url && (
                        <div className="mt-2 border rounded-lg overflow-hidden max-w-md bg-black/5 p-1">
                          <a href={existing.image_url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90">
                            <img src={existing.image_url} alt="Attached image proof" className="max-h-48 object-contain rounded" />
                          </a>
                        </div>
                      )}
                      {existing.admin_remarks && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-700">{existing.admin_remarks}</p>
                        </div>
                      )}
                    </div>
                  );
                }

                // ── New (answerable) ──
                return (
                  <div key={q.id} className="glass-card p-5 space-y-4 border-2" style={{ borderColor: "var(--accent-primary)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: "var(--accent-primary)" }}>
                        Q{i + 1} — NEW
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        q.type === "mcq" ? "bg-blue-100 text-blue-700"
                        : q.type === "coding" ? "bg-purple-100 text-purple-700"
                        : "bg-cyan-100 text-cyan-700"
                      }`}>{q.type}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {q.points} pts
                      </span>
                    </div>
                    <p className="font-medium whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{q.text}</p>
                    {q.image_url && (
                      <div className="mt-2 border rounded-lg overflow-hidden max-w-md bg-black/5 p-1">
                        <a href={q.image_url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90">
                          <img src={q.image_url} alt="Question Attachment" className="max-h-60 object-contain rounded" />
                        </a>
                      </div>
                    )}

                    {q.type === "mcq" && q.options && Array.isArray(q.options) ? (
                      <div className="space-y-2">
                        {(q.options as string[]).map((opt: string, oIdx: number) => (
                          <label
                            key={oIdx}
                            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                              newAnswers[q.id]?.option === oIdx
                                ? "bg-blue-50 border-blue-400"
                                : "hover:bg-gray-50"
                            }`}
                            style={newAnswers[q.id]?.option !== oIdx
                              ? { borderColor: "var(--border)", color: "var(--text-primary)" }
                              : { color: "#00629B" }}
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              checked={newAnswers[q.id]?.option === oIdx}
                              onChange={() =>
                                setNewAnswers(prev => ({
                                  ...prev,
                                  [q.id]: { ...prev[q.id], option: oIdx },
                                }))
                              }
                              className="accent-[#00629B] w-4 h-4"
                            />
                            <div className="text-sm flex items-start gap-1">
                              <span className="font-bold shrink-0">{String.fromCharCode(65 + oIdx)}.</span>
                              {opt.startsWith('http') ? (
                                <div className="border rounded overflow-hidden bg-white/50 p-1 mt-0.5">
                                  <img src={opt} alt={`Option ${String.fromCharCode(65 + oIdx)}`} className="max-h-24 object-contain rounded" />
                                </div>
                              ) : (
                                <span className="break-words break-all">{opt}</span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : q.type === "coding" ? (
                      selectedEvent.tasks?.[0]?.c_compiler_enabled ? (
                        <CodingQuestionEditor
                          value={newAnswers[q.id]?.text || ""}
                          onChange={val =>
                            setNewAnswers(prev => ({
                              ...prev,
                              [q.id]: { ...prev[q.id], text: val },
                            }))
                          }
                        />
                      ) : (
                        <textarea
                          rows={10}
                          value={newAnswers[q.id]?.text || ""}
                          onChange={e =>
                            setNewAnswers(prev => ({
                              ...prev,
                              [q.id]: { ...prev[q.id], text: e.target.value },
                            }))
                          }
                          className="w-full rounded-lg p-4 font-mono text-sm focus:outline-none"
                          style={{
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--border)",
                            color: "var(--text-primary)",
                          }}
                          placeholder="Write your code here..."
                        />
                      )
                    ) : (
                      <textarea
                        rows={5}
                        value={newAnswers[q.id]?.text || ""}
                        onChange={e =>
                          setNewAnswers(prev => ({
                            ...prev,
                            [q.id]: { ...prev[q.id], text: e.target.value },
                          }))
                        }
                        className="input-field resize-none text-sm"
                        placeholder="Type your answer here..."
                      />
                    )}

                    {(q.type === "coding" || q.type === "general") && (
                      <div className="mt-2">
                        {newAnswers[q.id]?.image_url ? (
                          <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                            <img src={newAnswers[q.id].image_url!} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setNewAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], image_url: null } }))}
                              className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white hover:bg-black"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-700 cursor-pointer w-fit p-2 rounded bg-black/5 hover:bg-black/10 transition-colors">
                            {imageUploading[q.id] ? (
                              <><Loader2 className="w-4 h-4 animate-spin text-[#00629B]" /> Uploading...</>
                            ) : (
                              <>
                                <ImageIcon className="w-4 h-4 text-[#00629B]" /> Attach Image Proof (Optional)
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageUpload(q.id, file);
                                  }}
                                />
                              </>
                            )}
                          </label>
                        )}
                      </div>
                    )}

                    {/* Per-question submit button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => submitSingleAnswer(q.id)}
                        disabled={submittingQId === q.id}
                        className="btn-primary text-sm flex items-center gap-2 px-5 py-2"
                      >
                        {submittingQId === q.id ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                        ) : (
                          <><Send className="w-4 h-4" /> Submit Answer</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Spacer at bottom */}
            {unansweredCount > 0 && <div className="pb-4" />}
          </>
        )}
      </div>
    );
  }

  // ── Events List ──
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2" style={{ color: "var(--text-primary)" }}>
          My Tasks
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Your booked events with available tasks.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent-primary)" }} />
        </div>
      ) : bookedEvents.length === 0 ? (
        <div className="glass-card p-12 text-center border border-dashed" style={{ borderColor: "var(--border)" }}>
          <ClipboardList className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
            No booked events.
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Book events first to see tasks here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookedEvents.map(event => {
            const eventTasks = event.tasks || [];
            const hasApproved = eventTasks.length > 0;
            const firstTask = eventTasks[0];
            const sub = firstTask?.submission;

            const statusLabel = !hasApproved
              ? "No Tasks Yet"
              : sub?.completed
                ? sub.review_status === "reviewed" ? "Reviewed" : "Submitted"
                : "Start Task";

            const statusColor = !hasApproved
              ? "bg-gray-100 text-gray-500"
              : sub?.completed
                ? sub.review_status === "reviewed"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700";

            return (
              <button
                key={event.id}
                onClick={() => openEvent(event)}
                disabled={!hasApproved}
                className={`w-full text-left glass-card p-5 transition-all border group ${
                  hasApproved ? "cursor-pointer" : "opacity-60 cursor-not-allowed"
                }`}
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "var(--bg-secondary)", color: "var(--accent-primary)" }}
                  >
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {event.name}
                      </h3>
                      {event.society?.abbreviation && (
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          ({event.society.abbreviation})
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-sm mt-1 truncate" style={{ color: "var(--text-muted)" }}>
                        {event.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      {event.date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(event.date).toLocaleDateString()}
                        </span>
                      )}
                      {hasApproved && (
                        <span>
                          {eventTasks.length} task{eventTasks.length !== 1 ? "s" : ""}
                        </span>
                      )}
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
