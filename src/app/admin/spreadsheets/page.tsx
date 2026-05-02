"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Table, Search, Download, BarChart3 } from "lucide-react";
import { Table, Search, Download, BarChart3 } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamic imports for Recharts
const ResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer), { ssr: false });
const BarChart = dynamic(() => import("recharts").then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(m => m.Tooltip), { ssr: false });
const Cell = dynamic(() => import("recharts").then(m => m.Cell), { ssr: false });

export default function SpreadsheetsPage() {
  const [activeTab, setActiveTab] = useState("activity");

  const tabs = [
    { id: "activity", label: "Activity Points" },
    { id: "performance", label: "Leadership Performance" },
    { id: "attendance", label: "Event Attendance" },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Spreadsheet Panel</h1>
        <p className="text-gray-400">Live auto-synced views from database.</p>
      </div>

      <div className="flex space-x-2 border-b border-white/10 pb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id ? "bg-[#00629B] text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "activity" && <ActivitySheet />}
      {activeTab === "performance" && <PerformanceSheet />}
      {activeTab === "attendance" && <AttendanceSheet />}
    </div>
  );
}

function ActivitySheet() {
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: users } = await supabase
        .from("users")
        .select("name, email, activity_points, society:societies(name, abbreviation)")
        .order("activity_points", { ascending: false });
      setData(users || []);
      setLoading(false);
    }
    fetch();
  }, []);

  const filtered = data.filter(u =>
    (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2"><Table className="w-5 h-5 text-[#00bfff]" /> Activity Points Sheet</h3>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 text-sm" placeholder="Search..." />
        </div>
      </div>
      <div className="overflow-x-auto border border-white/5 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] border-b border-white/5">
            <tr>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">#</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Gmail</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Society</th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium">Total Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}><td colSpan={5} className="py-3 px-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
              ))
            ) : filtered.map((u, i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                <td className="py-3 px-4 text-white font-medium">{u.name || "—"}</td>
                <td className="py-3 px-4 text-gray-400">{u.email}</td>
                <td className="py-3 px-4 text-gray-400">{u.society?.abbreviation || "—"}</td>
                <td className="py-3 px-4 text-right font-bold text-[#00bfff]">{u.activity_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PerformanceSheet() {
  const supabase = createClient();
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      // Fetch from optimized view to eliminate N+1 queries
      const { data } = await supabase
        .from("view_leader_performance")
        .select("*")
        .order("total_score", { ascending: false })
        .limit(20);

      if (data) {
        setLeaders(data.map(l => ({
          ...l,
          society: { abbreviation: l.society_abbreviation },
          score: l.total_score
        })));
      }
      setLoading(false);
    }
    fetch();
  }, []);

  const chartData = leaders.slice(0, 10).map(l => ({
    name: (l.name || l.email).split(" ")[0],
    points: l.activity_points || 0,
    events: l.events_conducted * 10,
    score: l.score || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#00bfff]" /> Performance Chart (Top 10)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ background: '#132240', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc' }} />
              <Bar dataKey="points" fill="#00629B" radius={[4, 4, 0, 0]} name="Points" />
              <Bar dataKey="events" fill="#00bfff" radius={[4, 4, 0, 0]} name="Events (×10)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="overflow-x-auto border border-white/5 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] border-b border-white/5">
              <tr>
                <th className="text-left py-3 px-4 text-gray-400">Rank</th>
                <th className="text-left py-3 px-4 text-gray-400">Name</th>
                <th className="text-left py-3 px-4 text-gray-400">Society</th>
                <th className="text-left py-3 px-4 text-gray-400">Skills</th>
                <th className="text-right py-3 px-4 text-gray-400">Events</th>
                <th className="text-right py-3 px-4 text-gray-400">Points</th>
                <th className="text-right py-3 px-4 text-gray-400">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leaders.map((l, i) => (
                <tr key={l.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 text-gray-500 font-bold">{i + 1}</td>
                  <td className="py-3 px-4 text-white font-medium">{l.name || l.email}</td>
                  <td className="py-3 px-4 text-gray-400">{l.society?.abbreviation || "—"}</td>
                  <td className="py-3 px-4 text-gray-400 max-w-[200px] truncate">{l.primary_skills || "—"}</td>
                  <td className="py-3 px-4 text-right text-gray-400">{l.events_conducted}</td>
                  <td className="py-3 px-4 text-right text-[#00bfff]">{l.activity_points}</td>
                  <td className="py-3 px-4 text-right font-bold text-green-400">{l.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AttendanceSheet() {
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: submissions } = await supabase
        .from("task_submissions")
        .select("score, completed, submitted_at, user:users(name, email, society:societies(abbreviation)), task:tasks(event:events(name))")
        .order("submitted_at", { ascending: false })
        .limit(100);
      setData(submissions || []);
      setLoading(false);
    }
    fetch();
  }, []);

  const filtered = data.filter(d =>
    (d.user?.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.user?.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2"><Table className="w-5 h-5 text-[#00bfff]" /> Event Attendance Sheet</h3>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 text-sm" placeholder="Search..." />
        </div>
      </div>
      <div className="overflow-x-auto border border-white/5 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] border-b border-white/5">
            <tr>
              <th className="text-left py-3 px-4 text-gray-400">Name</th>
              <th className="text-left py-3 px-4 text-gray-400">Gmail</th>
              <th className="text-left py-3 px-4 text-gray-400">Society</th>
              <th className="text-left py-3 px-4 text-gray-400">Event</th>
              <th className="text-right py-3 px-4 text-gray-400">Score</th>
              <th className="text-center py-3 px-4 text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((d, i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="py-3 px-4 text-white font-medium">{d.user?.name || "—"}</td>
                <td className="py-3 px-4 text-gray-400">{d.user?.email || "—"}</td>
                <td className="py-3 px-4 text-gray-400">{d.user?.society?.abbreviation || "—"}</td>
                <td className="py-3 px-4 text-gray-400">{d.task?.event?.name || "—"}</td>
                <td className="py-3 px-4 text-right font-bold text-[#00bfff]">{d.score}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${d.completed ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {d.completed ? "Complete" : "Incomplete"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
