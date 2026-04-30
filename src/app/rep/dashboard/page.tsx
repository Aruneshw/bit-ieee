"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Users, CalendarDays, Award, TrendingUp } from "lucide-react";

export default function RepDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState({ members: 0, events: 0, totalPoints: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data: profile } = await supabase.from("users").select("society_id").eq("email", user.email.toLowerCase()).single();
      if (!profile?.society_id) { setLoading(false); return; }

      const [membersRes, eventsRes, usersRes] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }).eq("society_id", profile.society_id),
        supabase.from("events").select("*", { count: "exact", head: true }).eq("society_id", profile.society_id),
        supabase.from("users").select("activity_points").eq("society_id", profile.society_id),
      ]);

      const totalPoints = usersRes.data?.reduce((sum, u) => sum + (u.activity_points || 0), 0) || 0;
      setStats({ members: membersRes.count || 0, events: eventsRes.count || 0, totalPoints });
      setLoading(false);
    }
    fetch();
  }, []);

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Society Dashboard</h1>
        <p className="text-gray-400">Overview of your society's activity and members.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 flex items-center gap-4 stat-glow">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center text-[#00bfff]">
            <Users className="w-6 h-6" />
          </div>
          <div><p className="text-sm text-gray-400">Members</p><p className="text-2xl font-bold">{loading ? "—" : stats.members}</p></div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4 stat-glow">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center text-green-400">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div><p className="text-sm text-gray-400">Events</p><p className="text-2xl font-bold">{loading ? "—" : stats.events}</p></div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4 stat-glow">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center text-amber-400">
            <Award className="w-6 h-6" />
          </div>
          <div><p className="text-sm text-gray-400">Total Points</p><p className="text-2xl font-bold">{loading ? "—" : stats.totalPoints}</p></div>
        </div>
      </div>
    </div>
  );
}
