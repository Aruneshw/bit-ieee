"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Award, Activity, Sparkles, X } from "lucide-react";
import { useSessionProfile } from "@/components/session-profile-provider";

export default function MemberDashboard() {
  const supabase = createClient();
  const [points, setPoints] = useState<any[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const { welcome } = useSessionProfile();
  const [showWelcome, setShowWelcome] = useState(true);

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

  useEffect(() => {
    if (!showWelcome) return;
    if (welcome.type !== "returning") return;
    const t = setTimeout(() => setShowWelcome(false), 5000);
    return () => clearTimeout(t);
  }, [welcome.type, showWelcome]);

  return (
    <div className="space-y-8 animate-slide-up max-w-4xl mx-auto">
      {showWelcome && welcome.type && (
        <div
          className="glass-card p-4 sm:p-5 flex items-start justify-between gap-4"
          style={{
            background:
              welcome.type === "returning"
                ? "color-mix(in srgb, var(--accent-primary) 12%, var(--bg-card))"
                : "color-mix(in srgb, var(--accent-gold) 14%, var(--bg-card))",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background:
                  welcome.type === "returning"
                    ? "color-mix(in srgb, var(--accent-primary) 25%, transparent)"
                    : "color-mix(in srgb, var(--accent-gold) 25%, transparent)",
                border: "1px solid var(--border)",
              }}
            >
              <Sparkles className="w-5 h-5" style={{ color: "var(--text-primary)" }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {welcome.type === "returning"
                  ? `Welcome back, ${welcome.fullName || "member"}!`
                  : `Welcome to IEEE Hub, ${welcome.fullName || "member"}!`}
              </p>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {welcome.type === "returning"
                  ? "Glad to see you again. Your dashboard is ready."
                  : "Start with Book Events, then mark attendance to earn activity points."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowWelcome(false)}
            className="p-2 rounded-lg"
            style={{ color: "var(--text-muted)" }}
            aria-label="Dismiss welcome message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Member Dashboard</h1>
        <p style={{ color: "var(--text-secondary)" }}>Track your activity points and event history.</p>
      </div>

      <div className="glass-card p-6 flex items-center gap-6 bg-gradient-to-r from-[#00629B]/20 to-[#00bfff]/5 stat-glow">
        <div className="w-16 h-16 bg-gradient-to-br from-[#00629B] to-[#00bfff] rounded-2xl flex items-center justify-center shadow-lg">
          <Award className="w-8 h-8 text-white" />
        </div>
        <div>
          <p className="font-medium" style={{ color: "var(--text-secondary)" }}>Total Activity Points</p>
          <p className="text-5xl font-bold" style={{ color: "var(--text-primary)" }}>{loading ? "—" : totalPoints}</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-xl font-medium mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5" style={{ color: "var(--accent-primary)" }} /> Points Breakdown
        </h2>
        {loading ? (
          <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
        ) : points.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-xl bg-black/20">
            <Activity className="w-8 h-8 mx-auto text-gray-500 mb-3" />
            <p style={{ color: "var(--text-secondary)" }}>No activity points yet. Attend events to earn!</p>
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
