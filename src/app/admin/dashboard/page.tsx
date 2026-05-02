"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Download, Users, Activity, CalendarDays, TrendingUp, Award } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";

// Dynamic import for Recharts to optimize bundle size
const ResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer), { ssr: false });
const BarChart = dynamic(() => import("recharts").then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(m => m.Tooltip), { ssr: false });
const Cell = dynamic(() => import("recharts").then(m => m.Cell), { ssr: false });

interface Stats {
  totalUsers: number;
  totalSocieties: number;
  totalEvents: number;
  pendingRequests: number;
}

interface SocietyPoints {
  name: string;
  abbreviation: string;
  points: number;
}

export default function AdminDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalSocieties: 0, totalEvents: 0, pendingRequests: 0 });
  const [chartData, setChartData] = useState<SocietyPoints[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch counts
        const [usersRes, societiesRes, eventsRes, pendingRes] = await Promise.all([
          supabase.from("users").select("*", { count: "exact", head: true }),
          supabase.from("societies").select("*", { count: "exact", head: true }),
          supabase.from("events").select("*", { count: "exact", head: true }),
          supabase.from("events").select("*", { count: "exact", head: true }).eq("status", "pending"),
        ]);

        setStats({
          totalUsers: usersRes.count || 0,
          totalSocieties: societiesRes.count || 0,
          totalEvents: eventsRes.count || 0,
          pendingRequests: pendingRes.count || 0,
        });

        // Fetch society points for chart using the optimized view
        const { data: societyStats } = await supabase
          .from("view_society_stats")
          .select("name, abbreviation, total_points")
          .order("total_points", { ascending: false });

        if (societyStats) {
          setChartData(societyStats.map(s => ({
            name: s.name,
            abbreviation: s.abbreviation || s.name.substring(0, 4),
            points: s.total_points
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleExport = async () => {
    toast.info("Generating export...");
    try {
      const { data: users } = await supabase
        .from("users")
        .select("name, email, role, department, activity_points, society:societies(name)");
      
      if (!users) return;

      const csvContent = [
        "Name,Email,Role,Department,Activity Points,Society",
        ...users.map((u: any) => 
          `"${u.name || ""}","${u.email}","${u.role}","${u.department || ""}","${u.activity_points}","${u.society?.name || ""}"`
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ieee_hub_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded!");
    } catch {
      toast.error("Export failed");
    }
  };

  const COLORS = ['#00629B', '#00bfff', '#0099cc', '#004d7a', '#33cfff', '#006699', '#0077b6', '#0096c7', '#00b4d8', '#48cae4', '#90e0ef'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 glass-card animate-pulse" />
          ))}
        </div>
        <div className="h-96 glass-card animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-heading tracking-wide mb-2">Platform Overview</h1>
          <p className="text-gray-400">Welcome to the Admin Dashboard</p>
        </div>
        <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" />
          Export All Data
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-6 h-6" />} title="Total Users" value={stats.totalUsers} color="from-blue-500/20 to-cyan-500/10" />
        <StatCard icon={<Activity className="w-6 h-6" />} title="Societies" value={stats.totalSocieties} color="from-purple-500/20 to-pink-500/10" />
        <StatCard icon={<CalendarDays className="w-6 h-6" />} title="Total Events" value={stats.totalEvents} color="from-green-500/20 to-emerald-500/10" />
        <StatCard icon={<TrendingUp className="w-6 h-6" />} title="Pending Requests" value={stats.pendingRequests} color="from-amber-500/20 to-orange-500/10" />
      </div>

      {/* Activity Points Chart */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Award className="w-5 h-5 text-[#00bfff]" />
          <h2 className="text-xl font-heading tracking-wide">Activity Points by Society</h2>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="abbreviation" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#132240',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                }}
              />
              <Bar dataKey="points" radius={[6, 6, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color }: { icon: React.ReactNode; title: string; value: number; color: string }) {
  return (
    <div className="glass-card p-5 flex items-center gap-4 stat-glow">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-[#00bfff]`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
      </div>
    </div>
  );
}
