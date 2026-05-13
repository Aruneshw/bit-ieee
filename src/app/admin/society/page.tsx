"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Users, ChevronDown, ChevronUp, CalendarDays, Award, TrendingUp } from "lucide-react";
import type { Society, UserProfile, Event } from "@/lib/types";

interface SocietyDetail extends Society {
  users?: UserProfile[];
  events?: Event[];
}

export default function AdminSocietyPage() {
  const supabase = createClient();
  const [societies, setSocieties] = useState<SocietyDetail[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSocieties() {
      const { data } = await supabase
        .from("societies")
        .select("*")
        .order("name");
      
      if (data) {
        // Enrich with member counts
        const enriched = await Promise.all(data.map(async (s) => {
          const { count } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("society_id", s.id);
          return { ...s, total_members: count || 0 };
        }));
        setSocieties(enriched);
      }
      setLoading(false);
    }
    fetchSocieties();
  }, []);

  async function toggleExpand(societyId: string) {
    if (expanded === societyId) {
      setExpanded(null);
      return;
    }

    // Fetch details for this society
    const [usersRes, eventsRes] = await Promise.all([
      supabase
        .from("users")
        .select("*")
        .eq("society_id", societyId)
        .in("role", ["leadership", "event_manager", "student_rep"])
        .order("activity_points", { ascending: false }),
      supabase
        .from("events")
        .select("*")
        .eq("society_id", societyId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    setSocieties(prev => prev.map(s => 
      s.id === societyId 
        ? { ...s, users: usersRes.data || [], events: eventsRes.data || [] }
        : s
    ));
    setExpanded(societyId);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse" />
        {[...Array(6)].map((_, i) => <div key={i} className="h-20 glass-card animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Societies</h1>
        <p className="text-gray-400">Manage all {societies.length} IEEE societies and their leadership.</p>
      </div>

      <div className="grid gap-4">
        {societies.map(society => (
          <div key={society.id} className="glass-card overflow-hidden">
            <button
              onClick={() => toggleExpand(society.id)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00629B]/30 to-[#00bfff]/10 flex items-center justify-center text-[#00bfff]">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{society.abbreviation || society.name}</h3>
                  <p className="text-sm text-gray-600">{society.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-sm text-gray-600">Members</p>
                  <p className="text-lg font-bold text-gray-900">{society.total_members}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm text-gray-600">Dept</p>
                  <p className="text-lg font-bold text-[#00bfff]">{society.department || "—"}</p>
                </div>
                {expanded === society.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>
            </button>

            {expanded === society.id && (
              <div className="border-t border-white/5 p-5 space-y-6 bg-black/10">
                {/* Leadership */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Award className="w-4 h-4" /> Leadership ({society.users?.length || 0})
                  </h4>
                  {society.users && society.users.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">Name</th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">Role</th>
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">Skills</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {society.users.map(u => (
                            <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                              <td className="py-2.5 px-3 font-medium text-gray-900">{u.name || u.email}</td>
                              <td className="py-2.5 px-3 text-gray-600 capitalize">{u.role.replace("_", " ")}</td>
                              <td className="py-2.5 px-3 text-gray-600">{u.primary_skills || "—"}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-[#00bfff]">{u.activity_points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No leadership assigned yet.</p>
                  )}
                </div>

                {/* Events */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Recent Events ({society.events?.length || 0})
                  </h4>
                  {society.events && society.events.length > 0 ? (
                    <div className="grid gap-2">
                      {society.events.map(e => (
                        <div key={e.id} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{e.name}</p>
                            <p className="text-xs text-gray-600">{e.event_type} • {e.date ? new Date(e.date).toLocaleDateString() : "TBD"}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                            e.status === "approved" ? "bg-green-500/20 text-green-400" :
                            e.status === "rejected" ? "bg-red-500/20 text-red-400" :
                            "bg-amber-500/20 text-amber-400"
                          }`}>
                            {e.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No events recorded yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
