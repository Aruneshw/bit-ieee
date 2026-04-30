"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { CheckSquare, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdminTaskPanel() {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      const { data } = await supabase
        .from("events")
        .select("*, society:societies(name, abbreviation)")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      setEvents(data || []);
      setLoading(false);
    }
    fetchEvents();
  }, []);

  if (loading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-16 glass-card animate-pulse" />)}</div>;
  }

  async function selectEvent(eventId: string) {
    setSelected(eventId);
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setTasks(data || []);
  }

  async function addTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();

    const questionsRaw = fd.get("questions") as string;
    let questions = [];
    try {
      questions = JSON.parse(questionsRaw);
    } catch {
      // Simple format: one question per line
      questions = questionsRaw.split("\n").filter(Boolean).map((q, i) => ({
        id: `q${i + 1}`,
        text: q.trim(),
        options: [],
        points: 10,
      }));
    }

    const { error } = await supabase.from("tasks").insert({
      event_id: selected,
      type: fd.get("type"),
      questions,
      created_by: user?.id,
    });

    if (error) { toast.error(error.message); return; }
    toast.success("Task added!");
    selectEvent(selected);
    (e.target as HTMLFormElement).reset();
  }

  if (loading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-16 glass-card animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Task Panel</h1>
        <p className="text-gray-400">Add MCQ or Coding tasks to approved events.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event List */}
        <div className="glass-card p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Approved Events</h3>
          {events.length === 0 ? (
            <p className="text-gray-500 text-sm px-2">No approved events</p>
          ) : events.map(ev => (
            <button
              key={ev.id}
              onClick={() => selectEvent(ev.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selected === ev.id ? "bg-[#00629B]/20 border border-[#00629B]/30 text-[#00bfff]" : "hover:bg-white/5 text-gray-300"
              }`}
            >
              <p className="font-medium text-sm">{ev.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{ev.society?.abbreviation} • {ev.event_type}</p>
            </button>
          ))}
        </div>

        {/* Task Management */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              {/* Add Task Form */}
              <form onSubmit={addTask} className="glass-card p-5 space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#00bfff]" /> New Task
                </h3>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select name="type" required className="input-field">
                    <option value="mcq">MCQ</option>
                    <option value="coding">Coding</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Questions (one per line, or JSON array)</label>
                  <textarea name="questions" required rows={5} className="input-field resize-none font-mono text-sm" placeholder="What does IEEE stand for?&#10;Write a function to sort an array.&#10;..." />
                </div>
                <button type="submit" className="btn-primary text-sm">Add Task</button>
              </form>

              {/* Existing Tasks */}
              <div className="glass-card p-5">
                <h3 className="text-lg font-medium mb-4">Existing Tasks ({tasks.length})</h3>
                {tasks.length === 0 ? (
                  <p className="text-gray-500 text-sm">No tasks yet for this event.</p>
                ) : (
                  <div className="space-y-3">
                    {tasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                        <div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${task.type === "mcq" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                            {task.type.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-400 ml-3">
                            {Array.isArray(task.questions) ? task.questions.length : 0} questions
                          </span>
                          {task.otp && (
                            <span className="text-xs text-green-400 ml-3 font-mono">OTP: {task.otp}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{new Date(task.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
