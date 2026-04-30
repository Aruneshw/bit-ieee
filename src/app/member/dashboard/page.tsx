"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Award, Activity } from "lucide-react";

export default function MemberDashboard() {
  const supabase = createClient();
  const [points, setPoints] = useState<any[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: profile } = await supabase.from("users").select("activity_points").eq("email", user.email.toLowerCase()).single();
      setTotalPoints(profile?.activity_points || 0);

      const { data: pts } = await supabase.from("activity_points").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setPoints(pts || []);
      setLoading(false);
    }
    fetch();
  }, []);

  return (
    <div className="space-y-8 animate-slide-up max-w-4xl mx-auto">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Member Dashboard</h1>
        <p className="text-gray-400">Track your activity points and event history.</p>
      </div>

      <div className="glass-card p-6 flex items-center gap-6 bg-gradient-to-r from-[#00629B]/20 to-[#00bfff]/5 stat-glow">
        <div className="w-16 h-16 bg-gradient-to-br from-[#00629B] to-[#00bfff] rounded-2xl flex items-center justify-center shadow-lg">
          <Award className="w-8 h-8 text-white" />
        </div>
        <div>
          <p className="text-gray-400 font-medium">Total Activity Points</p>
          <p className="text-5xl font-bold text-white">{loading ? "—" : totalPoints}</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-xl font-medium mb-6 flex items-center gap-2"><Activity className="w-5 h-5 text-[#00bfff]" /> Points Breakdown</h2>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : points.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-xl bg-black/20">
            <Activity className="w-8 h-8 mx-auto text-gray-500 mb-3" />
            <p className="text-gray-400">No activity points yet. Attend events to earn!</p>
          </div>
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
    </div>
  );
}
