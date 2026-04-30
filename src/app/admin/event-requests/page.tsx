"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, ArrowUpDown, CalendarX2, Loader2, RefreshCw } from "lucide-react";

type Row = any;

export default function AdminEventRequestsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sortKey, setSortKey] = useState<"created_at" | "event_date">("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  async function fetchRows() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, organizer_name, organizer_department, society_id, created_at, event_date, start_time, end_time, status, society:societies(name, abbreviation)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load event requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, []);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = (a[sortKey] || "") as string;
      const bv = (b[sortKey] || "") as string;
      const cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortAsc]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="h-10 w-64 rounded-lg animate-pulse" style={{ background: "color-mix(in srgb, var(--text-muted) 14%, transparent)" }} />
          <div className="h-10 w-28 rounded-lg animate-pulse" style={{ background: "color-mix(in srgb, var(--text-muted) 12%, transparent)" }} />
        </div>
        <div className="glass-card p-5 animate-pulse h-64" />
      </div>
    );
  }

  if (error) {
    return (
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
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Couldn’t load requests</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{error}</p>
          </div>
        </div>
        <button type="button" onClick={fetchRows} className="btn-secondary text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-4xl font-heading tracking-wide mb-2">Event Requests</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Review and approve pending event submissions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchRows()}
          className="btn-secondary text-sm flex items-center gap-2 w-fit"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CalendarX2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <h3 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            No pending requests
          </h3>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
            New submissions will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="glass-card p-0 overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
            <SortButton
              active={sortKey === "created_at"}
              label="Submitted"
              onClick={() => { setSortKey("created_at"); setSortAsc((v) => sortKey === "created_at" ? !v : false); }}
            />
            <SortButton
              active={sortKey === "event_date"}
              label="Event Date"
              onClick={() => { setSortKey("event_date"); setSortAsc((v) => sortKey === "event_date" ? !v : true); }}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg-secondary) 75%, transparent)" }}>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Event Title</th>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Organizer</th>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Department</th>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Society</th>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Submitted</th>
                  <th className="text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>Event Date</th>
                  <th className="text-right py-3 px-4" style={{ color: "var(--text-muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-[var(--bg-secondary)] transition-colors" style={{ borderColor: "var(--border)" }}>
                    <td className="py-3 px-4 font-semibold" style={{ color: "var(--text-primary)" }}>{r.name}</td>
                    <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{r.organizer_name || "—"}</td>
                    <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{r.organizer_department || "—"}</td>
                    <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>
                      {r.society?.abbreviation || r.society?.name || "—"}
                    </td>
                    <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{r.event_date || "—"}</td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/admin/event-requests/${r.id}`} className="btn-secondary text-sm inline-flex items-center gap-2">
                        Review
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

function SortButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
      style={{
        background: active ? "color-mix(in srgb, var(--accent-primary) 16%, transparent)" : "transparent",
        border: `1px solid ${active ? "color-mix(in srgb, var(--accent-primary) 35%, transparent)" : "var(--border)"}`,
        color: active ? "var(--accent-primary)" : "var(--text-secondary)",
      }}
    >
      <ArrowUpDown className="w-4 h-4" />
      {label}
    </button>
  );
}

