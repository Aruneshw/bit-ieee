"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, CalendarX2, Filter, RefreshCw, Search, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

type Row = any;

const STATUS_OPTIONS = ["all", "pending", "approved", "rejected", "ongoing", "completed"] as const;

export default function AdminAllEventsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [societies, setSocieties] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [societyId, setSocietyId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function fetchSocieties() {
    const { data } = await supabase.from("societies").select("id, name, abbreviation").order("name");
    setSocieties(data || []);
  }

  async function fetchRows() {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("events")
        .select("id, name, status, society_id, event_date, created_at, organizer_name, current_bookings, max_capacity, society:societies(name, abbreviation)")
        .order("created_at", { ascending: false });

      if (status !== "all") query = query.eq("status", status);
      if (societyId !== "all") query = query.eq("society_id", societyId);
      if (from) query = query.gte("event_date", from);
      if (to) query = query.lte("event_date", to);
      if (q.trim()) query = query.or(`name.ilike.%${q}%,organizer_name.ilike.%${q}%`);

      const { data, error } = await query;
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  async function createEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("events").insert({
        name: fd.get("name"),
        description: fd.get("description") || null,
        society_id: fd.get("society_id") || null,
        organiser_id: user.id,
        skill_type: fd.get("skillType") || null,
        selected_skill: fd.get("selectedSkill") || null,
        event_type: fd.get("eventType") || null,
        date: fd.get("date") ? new Date(fd.get("date") as string).toISOString() : null,
        venue: fd.get("venue") || null,
        status: "approved",
        booking_enabled: true,
      });

      if (error) throw error;
      toast.success("Event created & auto-approved!");
      (e.target as HTMLFormElement).reset();
      setShowCreate(false);
      fetchRows();
    } catch (err: any) {
      toast.error(err.message || "Failed to create event");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    fetchSocieties();
    fetchRows();
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const approved = rows.filter((r) => r.status === "approved" || r.status === "ongoing").length;
    const completed = rows.filter((r) => r.status === "completed").length;
    return { total, pending, approved, completed };
  }, [rows]);

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-4xl font-heading tracking-wide mb-2">All Events</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            View and manage events across all statuses.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm flex items-center gap-2 w-fit">
            <Plus className="w-4 h-4" /> Create Event
            {showCreate ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button type="button" onClick={fetchRows} className="btn-secondary text-sm flex items-center gap-2 w-fit">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Create Event Form */}
      {showCreate && (
        <form onSubmit={createEvent} className="glass-card p-6 space-y-4 border-2" style={{ borderColor: "var(--accent-primary)" }}>
          <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Plus className="w-5 h-5" style={{ color: "var(--accent-primary)" }} /> Create New Event (Auto-Approved)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Event Name *</label>
              <input name="name" required className="input-field" placeholder="e.g. Intro to IoT Workshop" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Society</label>
              <select name="society_id" className="input-field">
                <option value="">None (Global)</option>
                {societies.map(s => <option key={s.id} value={s.id}>{s.abbreviation || s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Event Date</label>
              <input name="date" type="date" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Venue</label>
              <input name="venue" className="input-field" placeholder="e.g. Seminar Hall A" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Event Type</label>
              <select name="eventType" className="input-field">
                <option value="">Select</option>
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Skill</label>
              <input name="selectedSkill" className="input-field" placeholder="e.g. Machine Learning" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Description</label>
            <textarea name="description" rows={2} className="input-field resize-none" placeholder="Brief description..." />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={creating} className="btn-primary text-sm">
              {creating ? "Creating..." : "Create & Approve Event"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Status</p>
            <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>

          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Society</p>
            <select className="input-field" value={societyId} onChange={(e) => setSocietyId(e.target.value)}>
              <option value="all">All</option>
              {societies.map((s) => (
                <option key={s.id} value={s.id}>{s.abbreviation || s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>From</p>
            <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>To</p>
            <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Search</p>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input className="input-field pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or organizer…" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={fetchRows} className="btn-primary text-sm">Apply</button>
          <button
            type="button"
            onClick={() => { setStatus("all"); setSocietyId("all"); setFrom(""); setTo(""); setQ(""); setTimeout(fetchRows, 0); }}
            className="btn-secondary text-sm"
          >
            Reset
          </button>
          <div className="ml-auto flex gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <span><b style={{ color: "var(--text-primary)" }}>{summary.total}</b> total</span>
            <span>· <b style={{ color: "var(--text-primary)" }}>{summary.pending}</b> pending</span>
            <span>· <b style={{ color: "var(--text-primary)" }}>{summary.approved}</b> approved/ongoing</span>
            <span>· <b style={{ color: "var(--text-primary)" }}>{summary.completed}</b> completed</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="glass-card p-6 animate-pulse h-64" />
      ) : error ? (
        <div
          className="glass-card p-6 flex items-start justify-between gap-4"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 35%, var(--border))",
            background: "color-mix(in srgb, var(--danger) 10%, var(--bg-card))",
          }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: "var(--danger)" }} />
            <div>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Couldn’t load events</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{error}</p>
            </div>
          </div>
          <button type="button" onClick={fetchRows} className="btn-secondary text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CalendarX2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <h3 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>No events found</h3>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="glass-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg-secondary) 75%, transparent)" }}>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Title</th>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Date</th>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Status</th>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Society</th>
                  <th className="text-right py-3 px-4" style={{ color: "var(--text-muted)" }}>Bookings</th>
                  <th className="text-right py-3 px-4" style={{ color: "var(--text-muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-[var(--bg-secondary)] transition-colors" style={{ borderColor: "var(--border)" }}>
                    <td className="py-3 px-4 font-semibold" style={{ color: "var(--text-primary)" }}>{r.name}</td>
                    <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{r.event_date || "—"}</td>
                    <td className="py-3 px-4">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{r.society?.abbreviation || r.society?.name || "—"}</td>
                    <td className="py-3 px-4 text-right font-bold" style={{ color: "var(--text-primary)" }}>
                      {(r.current_bookings ?? 0)}/{(r.max_capacity ?? 70)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/admin/events/${r.id}`} className="btn-secondary text-sm">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const style =
    status === "pending"
      ? { background: "var(--warning)", color: "#111" }
      : status === "approved" || status === "ongoing"
        ? { background: "var(--success)", color: "#fff" }
        : status === "rejected"
          ? { background: "var(--danger)", color: "#fff" }
          : { background: "var(--text-muted)", color: "#fff" };
  return (
    <span className="px-3 py-1 text-xs font-bold" style={{ borderRadius: "var(--radius-badge)", ...style }}>
      {status.toUpperCase()}
    </span>
  );
}

