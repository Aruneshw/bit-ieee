"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, Download, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";

type EventOpt = { id: string; name: string; status: string; event_date: string | null };
type Row = any;

export default function AdminAttendancePage() {
  const supabase = createClient();
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [pointCfg, setPointCfg] = useState({ full: 10, partial: 5 });

  async function loadEvents() {
    const { data } = await supabase
      .from("events")
      .select("id, name, status, event_date")
      .in("status", ["ongoing", "completed", "approved"])
      .order("event_date", { ascending: false });
    setEvents(data || []);
    if (!eventId && data?.[0]?.id) setEventId(data[0].id);
  }

  async function loadAttendance(eid: string) {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("event_bookings")
        .select("user_id, attended_start, attended_end, member:users(full_name, name, roll_number, department, society_id)")
        .eq("event_id", eid);
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (eventId) loadAttendance(eventId);
  }, [eventId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const start = rows.filter((r) => r.attended_start).length;
    const end = rows.filter((r) => r.attended_end).length;
    const full = rows.filter((r) => r.attended_start && r.attended_end).length;
    const pct = total ? Math.round((full / total) * 100) : 0;
    return { total, start, end, full, pct };
  }, [rows]);

  async function exportCsv() {
    if (!eventId) return;
    const e = events.find((x) => x.id === eventId);
    const header = ["Name", "Roll Number", "Department", "Society", "Start Attendance", "End Attendance", "Full Attendance"];
    const lines = [
      header.join(","),
      ...rows.map((r) => {
        const name = r.member?.full_name || r.member?.name || "";
        const roll = r.member?.roll_number || "";
        const dept = r.member?.department || "";
        const soc = r.member?.society_id || "";
        const s = r.attended_start ? "Yes" : "No";
        const en = r.attended_end ? "Yes" : "No";
        const full = r.attended_start && r.attended_end ? "Yes" : "No";
        return `"${name}","${roll}","${dept}","${soc}","${s}","${en}","${full}"`;
      }),
    ].join("\n");

    const blob = new Blob([lines], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${e?.name || eventId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  async function allocatePoints() {
    if (!eventId) return;
    const ev = events.find((x) => x.id === eventId);
    const ok = window.confirm(
      `Allocate activity points for "${ev?.name || "this event"}"?\n\nFull attendance: ${pointCfg.full}\nStart only: ${pointCfg.partial}\n\nThis will INSERT new activity point rows (run once).`
    );
    if (!ok) return;
    setAllocating(true);
    try {
      const { data: eRow } = await supabase
        .from("events")
        .select("name, organizer_name")
        .eq("id", eventId)
        .single();

      const inserts: any[] = [];
      for (const r of rows) {
        const full = r.attended_start && r.attended_end;
        const partial = r.attended_start && !r.attended_end;
        const points = full ? pointCfg.full : partial ? pointCfg.partial : 0;
        if (points <= 0) continue;
        inserts.push({
          user_id: r.user_id,
          event_id: eventId,
          points,
          event_name: eRow?.name || "Event",
          organised_by: eRow?.organizer_name || "Organizer",
          date: new Date().toISOString(),
        });
      }

      if (inserts.length === 0) {
        toast.info("No eligible attendees to award points.");
        return;
      }

      // Chunk inserts to avoid timeouts with 5000+ students
      const chunkSize = 100;
      let successCount = 0;
      for (let i = 0; i < inserts.length; i += chunkSize) {
        const chunk = inserts.slice(i, i + chunkSize);
        const { error } = await supabase.from("activity_points").insert(chunk);
        if (error) throw error;
        successCount += chunk.length;
      }

      toast.success(`Successfully allocated points to ${successCount} attendees.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to allocate points");
    } finally {
      setAllocating(false);
    }

  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-4xl font-heading tracking-wide mb-2">Attendance</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Attendance reports for approved/ongoing/completed events.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => eventId && loadAttendance(eventId)} className="btn-secondary text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            type="button"
            onClick={allocatePoints}
            disabled={allocating || !eventId || rows.length === 0}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trophy className="w-4 h-4" /> {allocating ? "Allocating..." : "Allocate Points"}
          </button>
          <button type="button" onClick={exportCsv} className="btn-secondary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="glass-card p-5 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="w-full md:max-w-lg">
          <p className="text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Select event</p>
          <select className="input-field" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.event_date ? `${e.event_date} · ` : ""}{e.name} ({e.status})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Stat label="Total booked" value={stats.total} />
          <Stat label="Marked start" value={stats.start} />
          <Stat label="Marked end" value={stats.end} />
          <Stat label="Full attendance" value={stats.full} />
          <Stat label="Attendance %" value={`${stats.pct}%`} />
        </div>
      </div>

      <div className="glass-card p-5">
        <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>POINTS CONFIG</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Full attendance points</p>
            <input
              type="number"
              className="input-field"
              value={pointCfg.full}
              onChange={(e) => setPointCfg((p) => ({ ...p, full: Number(e.target.value) }))}
            />
          </div>
          <div>
            <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Start-only points</p>
            <input
              type="number"
              className="input-field"
              value={pointCfg.partial}
              onChange={(e) => setPointCfg((p) => ({ ...p, partial: Number(e.target.value) }))}
            />
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Tip: allocate once per event to avoid duplicates.
        </p>
      </div>

      {error ? (
        <div
          className="glass-card p-6 flex items-start gap-3"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 35%, var(--border))",
            background: "color-mix(in srgb, var(--danger) 10%, var(--bg-card))",
          }}
        >
          <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: "var(--danger)" }} />
          <div>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Couldn’t load attendance</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{error}</p>
          </div>
        </div>
      ) : loading ? (
        <div className="glass-card p-6 animate-pulse h-64" />
      ) : (
        <div className="glass-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg-secondary) 75%, transparent)" }}>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Name</th>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Roll Number</th>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Department</th>
                  <th className="text-center py-3 px-4" style={{ color: "var(--text-muted)" }}>Start</th>
                  <th className="text-center py-3 px-4" style={{ color: "var(--text-muted)" }}>End</th>
                  <th className="text-center py-3 px-4" style={{ color: "var(--text-muted)" }}>Full</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const name = r.member?.full_name || r.member?.name || "—";
                  const roll = r.member?.roll_number || "—";
                  const dept = r.member?.department || "—";
                  const start = !!r.attended_start;
                  const end = !!r.attended_end;
                  const full = start && end;
                  return (
                    <tr key={i} className="border-b hover:bg-[var(--bg-secondary)] transition-colors" style={{ borderColor: "var(--border)" }}>
                      <td className="py-3 px-4 font-semibold" style={{ color: "var(--text-primary)" }}>{name}</td>
                      <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{roll}</td>
                      <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{dept}</td>
                      <td className="py-3 px-4 text-center" style={{ color: start ? "var(--success)" : "var(--text-muted)" }}>{start ? "✓" : "✗"}</td>
                      <td className="py-3 px-4 text-center" style={{ color: end ? "var(--success)" : "var(--text-muted)" }}>{end ? "✓" : "✗"}</td>
                      <td className="py-3 px-4 text-center" style={{ color: full ? "var(--success)" : "var(--text-muted)" }}>{full ? "Yes" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="px-3 py-2 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <p className="text-[10px] font-bold tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

