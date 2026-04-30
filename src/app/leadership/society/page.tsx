"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Users, Award, CalendarDays, MessageCircle, Heart } from "lucide-react";

export default function LeadershipSocietyPage() {
  const supabase = createClient();
  const [leaders, setLeaders] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data: profile } = await supabase.from("users").select("society_id").eq("email", user.email.toLowerCase()).single();
      if (!profile?.society_id) { setLoading(false); return; }

      const [leadersRes, eventsRes, postsRes] = await Promise.all([
        supabase.from("users").select("*").eq("society_id", profile.society_id).in("role", ["leadership", "event_manager"]).order("activity_points", { ascending: false }),
        supabase.from("events").select("*").eq("society_id", profile.society_id).eq("status", "approved").order("date", { ascending: true }).limit(10),
        supabase.from("posts").select("*, author:users(name)").eq("society_id", profile.society_id).order("created_at", { ascending: false }).limit(5),
      ]);

      setLeaders(leadersRes.data || []);
      setEvents(eventsRes.data || []);
      setPosts(postsRes.data || []);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 glass-card animate-pulse" />)}</div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <h1 className="text-4xl font-heading tracking-wide mb-2">Society Hub</h1>

      {/* Leadership Rankings */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-[#00bfff]" /> Leadership Rankings</h3>
        <div className="overflow-x-auto border border-white/5 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] border-b border-white/5">
              <tr>
                <th className="text-left py-3 px-4 text-gray-400">#</th>
                <th className="text-left py-3 px-4 text-gray-400">Name</th>
                <th className="text-left py-3 px-4 text-gray-400">Skills</th>
                <th className="text-right py-3 px-4 text-gray-400">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leaders.map((l, i) => (
                <tr key={l.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-bold text-gray-500">{i + 1}</td>
                  <td className="py-3 px-4 text-white font-medium">{l.name || l.email}</td>
                  <td className="py-3 px-4 text-gray-400 max-w-[200px] truncate">{l.primary_skills || "—"}</td>
                  <td className="py-3 px-4 text-right font-bold text-[#00bfff]">{l.activity_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[#00bfff]" /> Upcoming Events</h3>
        {events.length === 0 ? <p className="text-gray-500">No upcoming events.</p> : (
          <div className="grid gap-2">
            {events.map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                <div><p className="font-medium text-white text-sm">{e.name}</p><p className="text-xs text-gray-500">{e.event_type} • {e.date ? new Date(e.date).toLocaleDateString() : "TBD"}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rep Posts Feed */}
      {posts.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-[#00bfff]" /> Society Updates</h3>
          <div className="space-y-3">
            {posts.map(p => (
              <div key={p.id} className="p-3 bg-white/[0.02] rounded-lg">
                <p className="text-sm text-gray-300">{p.content}</p>
                <p className="text-xs text-gray-500 mt-1">— {p.author?.name} • {new Date(p.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
