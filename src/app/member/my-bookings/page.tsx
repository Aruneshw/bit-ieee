"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSessionProfile } from "@/components/session-profile-provider";
import { CalendarX2, MapPin, Clock, Check, X as XIcon, Radio, RefreshCw, AlertCircle } from "lucide-react";

type BookingRow = any;

function isLiveNow(e: any) {
  if (!e?.event_date || !e?.start_time || !e?.end_time) return false;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (e.event_date !== today) return false;
  const cur = now.toTimeString().slice(0, 5);
  return cur >= e.start_time.slice(0, 5) && cur <= e.end_time.slice(0, 5);
}

export default function MyBookingsPage() {
  const supabase = createClient();
  const { profile } = useSessionProfile();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<BookingRow[]>([]);

  const fetchRows = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, event:events(id, name, venue, event_date, start_time, end_time, status)")
        .eq("member_id", profile.id)
        .order("booked_at", { ascending: false });

      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const anyLive = useMemo(() => rows.some((r) => isLiveNow(r.event)), [rows]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-56 rounded-lg animate-pulse" style={{ background: "color-mix(in srgb, var(--text-muted) 14%, transparent)" }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-5 animate-pulse">
            <div className="h-6 w-2/3 rounded" style={{ background: "color-mix(in srgb, var(--text-muted) 14%, transparent)" }} />
            <div className="h-4 w-1/2 rounded mt-3" style={{ background: "color-mix(in srgb, var(--text-muted) 10%, transparent)" }} />
            <div className="h-4 w-1/3 rounded mt-2" style={{ background: "color-mix(in srgb, var(--text-muted) 10%, transparent)" }} />
          </div>
        ))}
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
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Couldn’t load bookings</p>
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
    <div className="space-y-6 animate-slide-up max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-heading tracking-wide mb-2">My Bookings</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Events you’ve booked, with start/end attendance status.
          </p>
        </div>
        {anyLive && (
          <span
            className="px-3 py-1 text-xs font-bold"
            style={{
              borderRadius: "var(--radius-badge)",
              background: "color-mix(in srgb, var(--success) 18%, transparent)",
              border: "1px solid color-mix(in srgb, var(--success) 40%, transparent)",
              color: "var(--success)",
              animation: "pulse-glow 1.5s ease-in-out infinite",
            }}
          >
            <Radio className="w-3.5 h-3.5 inline mr-1" /> Live Now
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CalendarX2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <h3 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            No bookings yet
          </h3>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
            Book an event in Activity → Current Events to see it here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.map((b) => (
            <div key={b.id} className="glass-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {b.event?.name || "Event"}
                    </h3>
                    {isLiveNow(b.event) && (
                      <span
                        className="px-3 py-1 text-xs font-bold"
                        style={{
                          borderRadius: "var(--radius-badge)",
                          background: "var(--success)",
                          color: "#fff",
                          animation: "pulse-glow 1.5s ease-in-out infinite",
                        }}
                      >
                        Live Now
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                      {b.event?.event_date || "—"} {b.event?.start_time ? `· ${b.event.start_time}–${b.event.end_time}` : ""}
                    </span>
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                      {b.event?.venue || "Venue TBD"}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold tracking-widest" style={{ color: "var(--text-muted)" }}>
                    ATTENDANCE
                  </p>
                  <div className="mt-2 flex items-center justify-end gap-4 text-sm">
                    <span className="flex items-center gap-1" style={{ color: b.attended_start ? "var(--success)" : "var(--text-muted)" }}>
                      Start {b.attended_start ? <Check className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                    </span>
                    <span className="flex items-center gap-1" style={{ color: b.attended_end ? "var(--success)" : "var(--text-muted)" }}>
                      End {b.attended_end ? <Check className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

