"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Activity, Award, CalendarDays, TrendingUp } from "lucide-react";

export default function LeadershipDashboard() {
  const supabase = createClient();
  const [tab, setTab] = useState<"activity" | "attendance">("activity");
  const [events, setEvents] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      
      const { data: profile } = await supabase.from("users").select("activity_points").eq("email", user.email.toLowerCase()).single();
      setTotalPoints(profile?.activity_points || 0);

      const [eventsRes, pointsRes] = await Promise.all([
        supabase.from("events").select("*, society:societies(abbreviation)").eq("organiser_id", user.id).order("created_at", { ascending: false }),
        supabase.from("activity_points").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      setEvents(eventsRes.data || []);
      setPoints(pointsRes.data || []);
      setLoading(false);
    }
    fetch();
  }, []);

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Leadership Dashboard</h1>
        <p className="text-gray-400">Track your conducted events and earned activity points.</p>
      </div>

      <div className="glass-card p-6 flex items-center gap-6 bg-gradient-to-r from-[#00629B]/20 to-[#00bfff]/5 stat-glow">
        <div className="w-16 h-16 bg-gradient-to-br from-[#00629B] to-[#00bfff] rounded-2xl flex items-center justify-center shadow-lg">
          <Award className="w-8 h-8 text-white" />
        </div>
        <div>
          <p className="text-gray-400 font-medium">Your Total Activity Points</p>
          <p className="text-5xl font-bold text-white">{loading ? "—" : totalPoints}</p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-white/10 pb-4">
        <button onClick={() => setTab("activity")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "activity" ? "bg-[#00629B] text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
          Personal Activity
        </button>
        <button onClick={() => setTab("attendance")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "attendance" ? "bg-[#00629B] text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
          Attendance
        </button>
      </div>

      {tab === "activity" ? (
        <div className="glass-card p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[#00bfff]" /> Events You Conducted</h3>
          {events.length === 0 ? (
            <p className="text-gray-500">No events conducted yet.</p>
          ) : (
            <div className="overflow-x-auto border border-white/5 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] border-b border-white/5">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-400">Event</th>
                    <th className="text-left py-3 px-4 text-gray-400">Type</th>
                    <th className="text-left py-3 px-4 text-gray-400">Date</th>
                    <th className="text-center py-3 px-4 text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {events.map(ev => (
                    <tr key={ev.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-white font-medium">{ev.name}</td>
                      <td className="py-3 px-4 text-gray-400">{ev.event_type || "—"}</td>
                      <td className="py-3 px-4 text-gray-400">{ev.date ? new Date(ev.date).toLocaleDateString() : "TBD"}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${ev.status === "approved" ? "bg-green-500/20 text-green-400" : ev.status === "rejected" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>
                          {ev.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-[#00bfff]" /> Points Breakdown</h3>
          {points.length === 0 ? (
            <p className="text-gray-500">No activity points record yet.</p>
          ) : (
            <div className="overflow-x-auto border border-white/5 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] border-b border-white/5">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-400">Event</th>
                    <th className="text-left py-3 px-4 text-gray-400">Organised By</th>
                    <th className="text-left py-3 px-4 text-gray-400">Date</th>
                    <th className="text-right py-3 px-4 text-gray-400">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {points.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-white font-medium">{p.event_name || "—"}</td>
                      <td className="py-3 px-4 text-gray-400">{p.organised_by || "—"}</td>
                      <td className="py-3 px-4 text-gray-400">{p.date ? new Date(p.date).toLocaleDateString() : "—"}</td>
                      <td className="py-3 px-4 text-right font-bold text-[#00bfff]">+{p.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
