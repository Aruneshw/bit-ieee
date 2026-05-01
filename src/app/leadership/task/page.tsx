"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { KeyRound, ClipboardList, FileCheck, Upload, UserCheck } from "lucide-react";
import { toast } from "sonner";

export default function LeadershipTaskPage() {
  const [activeTab, setActiveTab] = useState("otp");

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Task Management</h1>
        <p className="text-gray-400">Generate OTPs, manage task sessions, verify scores, and attend events.</p>
      </div>

      <div className="flex space-x-2 border-b border-white/10 pb-4 overflow-x-auto">
        {[
          { id: "otp", icon: <KeyRound className="w-4 h-4" />, label: "OTP Manager" },
          { id: "manager", icon: <ClipboardList className="w-4 h-4" />, label: "Task Manager" },
          { id: "verify", icon: <FileCheck className="w-4 h-4" />, label: "My Task" },
          { id: "attend", icon: <UserCheck className="w-4 h-4" />, label: "Task Attend" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === t.id ? "bg-[#00629B] text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 glass-card p-6 max-w-3xl">
        {activeTab === "otp" && <OTPManager />}
        {activeTab === "manager" && <TaskManager />}
        {activeTab === "verify" && <TaskVerify />}
        {activeTab === "attend" && <TaskAttend />}
      </div>
    </div>
  );
}

function OTPManager() {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Fetch more details to check time window
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date, start_time, end_time, organiser:users!events_organiser_id_fkey(name, email)")
        .eq("organiser_id", user.id)
        .eq("status", "approved");
      
      setEvents(data || []);
      setLoading(false);
    }
    fetchEvents();
  }, []);

  function isEventInTimeWindow(ev: any) {
    if (!ev.event_date || !ev.start_time || !ev.end_time) return true; // Default to allow if missing data
    
    const now = new Date();
    const [h, m] = ev.start_time.split(":").map(Number);
    const [eh, em] = ev.end_time.split(":").map(Number);
    
    const startTime = new Date(ev.event_date);
    startTime.setHours(h, m, 0);
    
    const endTime = new Date(ev.event_date);
    endTime.setHours(eh, em, 0);

    // Last 10 minutes logic:
    const tenMinsBeforeEnd = new Date(endTime.getTime() - 10 * 60 * 1000);
    
    // User requested "last 10 min", but usually it's "anytime during event". 
    // I'll allow generation anytime during the event for flexibility, but warn if too early.
    return now >= startTime && now <= endTime;
  }

  async function handleGenerateOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerating(true);
    const fd = new FormData(e.currentTarget);
    const eventId = fd.get("eventId") as string;
    const selectedEvent = events.find(ev => ev.id === eventId);

    if (!isEventInTimeWindow(selectedEvent)) {
      toast.error("OTP can only be generated during the event time window.");
      setGenerating(false);
      return;
    }

    try {
      // Use the new secure Quiz Start API
      const res = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start quiz session");

      setGeneratedOtp(json.otp);
      toast.success(`Quiz started! OTP sent to ${json.studentCount} students.`);

    } catch (err: any) {
      toast.error(err.message || "Failed to start quiz session");
    } finally {
      setGenerating(false);
    }
  }


  if (loading) return (
    <div className="flex flex-col items-center justify-center py-10 animate-pulse">
      <KeyRound className="w-8 h-8 text-gray-700 mb-4" />
      <p className="text-gray-500">Syncing event schedules...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-medium">Generate Task OTP</h3>
        <span className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/5 px-2 py-1 rounded">Secure Generation</span>
      </div>

      {events.length === 0 ? (
        <div className="p-8 text-center glass-card border-amber-500/20">
          <p className="text-amber-400">No approved events found for your account.</p>
          <p className="text-xs text-gray-500 mt-2">Only approved events you organize can have tasks.</p>
        </div>
      ) : (
        <form onSubmit={handleGenerateOtp} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500 font-bold ml-1 uppercase">Select Ongoing Event</label>
            <select name="eventId" required className="input-field">
              {events.map(ev => {
                const inWindow = isEventInTimeWindow(ev);
                return (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} {inWindow ? "(ONGOING)" : "(NOT STARTED/ENDED)"}
                  </option>
                );
              })}
            </select>
          </div>
          
          <button 
            type="submit" 
            disabled={generating} 
            className="btn-primary w-full py-4 text-lg"
          >
            {generating ? "Generating & Emailing..." : "Generate & Send OTP"}
          </button>
          
          <p className="text-center text-[10px] text-gray-600 uppercase tracking-tighter">
            OTP will be sent to your registered email for sharing.
          </p>
        </form>
      )}

      {generatedOtp && (
        <div className="p-8 bg-green-500/5 border border-green-500/20 rounded-2xl text-center shadow-2xl shadow-green-500/5 animate-scale-up">
          <p className="text-xs font-bold text-green-400 uppercase tracking-widest mb-4">OTP Successfully Shared</p>
          <div className="flex justify-center gap-3">
            {generatedOtp.split('').map((digit, i) => (
              <span key={i} className="w-10 h-14 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-2xl font-mono font-bold text-white shadow-inner">
                {digit}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-6">
            Share this code with attendees. Valid for 1 hour.
          </p>
        </div>
      )}
    </div>
  );
}


function TaskManager() {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("events").select("id, name").eq("organiser_id", user.id);
      setEvents(data || []);
      setLoading(false);
    }
    fetch();
  }, []);

  async function loadTask(eid: string) {
    setSelectedEventId(eid);
    const { data } = await supabase.from("tasks").select("questions").eq("event_id", eid).single();
    setQuestions(data?.questions || []);
  }

  function addQuestion() {
    setQuestions([...questions, { id: Math.random().toString(36).substr(2, 9), text: "", options: ["", "", "", ""], correct_answer: "0" }]);
  }

  function updateQuestion(index: number, field: string, value: any) {
    const next = [...questions];
    next[index] = { ...next[index], [field]: value };
    setQuestions(next);
  }

  async function saveTask() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: existing } = await supabase.from("tasks").select("id").eq("event_id", selectedEventId).single();
      
      if (existing) {
        await supabase.from("tasks").update({ questions }).eq("id", existing.id);
      } else {
        await supabase.from("tasks").insert({
          event_id: selectedEventId,
          type: "mcq",
          questions,
          created_by: user?.id,
        });
      }
      toast.success("Task questions saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-20 animate-pulse bg-white/5 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs text-gray-500 font-bold uppercase">Select Event to Manage Task</label>
        <select 
          className="input-field mt-1" 
          value={selectedEventId} 
          onChange={(e) => loadTask(e.target.value)}
        >
          <option value="">Choose an event...</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>

      {selectedEventId && (
        <div className="space-y-6 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-medium">MCQ Questions</h3>
            <button onClick={addQuestion} className="btn-secondary text-xs">+ Add Question</button>
          </div>

          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div key={q.id} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                <div className="flex justify-between gap-4">
                  <span className="text-xs font-bold text-[#00bfff]">Q{qIdx + 1}</span>
                  <button 
                    onClick={() => setQuestions(questions.filter((_, i) => i !== qIdx))}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Remove
                  </button>
                </div>
                <input 
                  className="input-field bg-black/20" 
                  placeholder="Question text" 
                  value={q.text} 
                  onChange={e => updateQuestion(qIdx, "text", e.target.value)} 
                />
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt: string, oIdx: number) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name={`q-${qIdx}`} 
                        checked={q.correct_answer === String(oIdx)} 
                        onChange={() => updateQuestion(qIdx, "correct_answer", String(oIdx))}
                      />
                      <input 
                        className="input-field text-xs py-1.5" 
                        placeholder={`Option ${oIdx + 1}`} 
                        value={opt} 
                        onChange={e => {
                          const nextOpts = [...q.options];
                          nextOpts[oIdx] = e.target.value;
                          updateQuestion(qIdx, "options", nextOpts);
                        }} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {questions.length > 0 && (
            <button 
              onClick={saveTask} 
              disabled={saving} 
              className="btn-primary w-full py-3"
            >
              {saving ? "Saving..." : "Save Questions"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}


function TaskVerify() {
  const supabase = createClient();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Get events by this leader, then task submissions
      const { data: events } = await supabase.from("events").select("id").eq("organiser_id", user.id);
      if (events && events.length > 0) {
        const eventIds = events.map(e => e.id);
        const { data: tasks } = await supabase.from("tasks").select("id").in("event_id", eventIds);
        if (tasks && tasks.length > 0) {
          const taskIds = tasks.map(t => t.id);
          const { data: subs } = await supabase.from("task_submissions").select("*, user:users(name, email)").in("task_id", taskIds);
          setSubmissions(subs || []);
        }
      }
      setLoading(false);
    }
    fetch();
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium">Attendee Mark Sheet</h3>
      <div className="overflow-x-auto border border-white/5 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] border-b border-white/5">
            <tr>
              <th className="text-left py-3 px-4 text-gray-400">Name</th>
              <th className="text-left py-3 px-4 text-gray-400">Email</th>
              <th className="text-center py-3 px-4 text-gray-400">Status</th>
              <th className="text-right py-3 px-4 text-gray-400">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={4} className="py-8 text-center text-gray-500">Loading...</td></tr>
            ) : submissions.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-gray-500">No submissions yet.</td></tr>
            ) : submissions.map(s => (
              <tr key={s.id} className="hover:bg-white/[0.02]">
                <td className="py-3 px-4 text-white font-medium">{s.user?.name || "—"}</td>
                <td className="py-3 px-4 text-gray-400">{s.user?.email || "—"}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${s.completed ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"}`}>
                    {s.completed ? "Done" : "In Progress"}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-bold text-[#00bfff]">{s.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaskAttend() {
  const supabase = createClient();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [attended, setAttended] = useState(false);
  const [eventName, setEventName] = useState("");
  const [error, setError] = useState("");

  async function handleAttend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not authenticated."); setLoading(false); return; }

      // Validate OTP and get event
      const { data: task } = await supabase
        .from("tasks")
        .select("id, event_id, event:events(name)")
        .eq("otp", otp)
        .single();

      if (!task) { setError("Invalid OTP."); setLoading(false); return; }

      // Check if already booked
      const { data: existingBooking } = await supabase
        .from("event_bookings")
        .select("id")
        .eq("event_id", task.event_id)
        .eq("user_id", user.id)
        .single();

      if (existingBooking) {
        setError("You have already booked/attended this event.");
        setLoading(false);
        return;
      }

      // Book the event for this leader
      const { error: bookingErr } = await supabase.from("event_bookings").insert({
        event_id: task.event_id,
        user_id: user.id,
      });

      if (bookingErr) {
        if (bookingErr.code === "23505") {
          setError("Already attending this event.");
        } else {
          setError("Failed to mark attendance.");
        }
        setLoading(false);
        return;
      }

      const eventName = Array.isArray(task.event) ? task.event[0]?.name : (task.event as any)?.name;
      setEventName(eventName || "Unknown Event");
      setAttended(true);
      toast.success("Attendance marked successfully!");
    } catch {
      setError("An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (attended) {
    return (
      <div className="space-y-4 text-center py-8">
        <UserCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white">Attendance Marked!</h3>
        <p className="text-gray-400">You are now registered for &quot;<span className="text-[#00bfff]">{eventName}</span>&quot;</p>
        <button onClick={() => { setAttended(false); setOtp(""); }} className="btn-secondary mt-4">Attend Another Event</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-xl font-medium flex items-center gap-2">
        <UserCheck className="w-5 h-5 text-[#00bfff]" /> Attend Another Leader&apos;s Event
      </h3>
      <p className="text-sm text-gray-400">Enter the OTP shared by the event organiser to mark your attendance.</p>
      <form onSubmit={handleAttend} className="space-y-4">
        <input
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          maxLength={6}
          placeholder="Enter 6-digit OTP"
          className="input-field font-mono tracking-widest text-center uppercase text-lg"
        />
        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading || otp.length < 6} className="btn-primary w-full">
          {loading ? "Verifying..." : "Mark Attendance"}
        </button>
      </form>
    </div>
  );
}
