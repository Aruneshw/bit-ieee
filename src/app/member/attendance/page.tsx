"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSessionProfile } from "@/components/session-profile-provider";
import { QrScanModal } from "@/components/qr-scan-modal";
import QRCode from "react-qr-code";
import {
  AlertCircle,
  CalendarX2,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  ScanLine,
  Send,
} from "lucide-react";
import { toast } from "sonner";

type ActiveBooking = any;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function MarkAttendancePage() {
  const supabase = createClient();
  const { profile } = useSessionProfile();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveBooking[]>([]);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<{ bookingId: string; type: "start" | "end" } | null>(null);

  const [otpInputs, setOtpInputs] = useState<Record<string, { start: string; end: string }>>({});
  const [submitting, setSubmitting] = useState<Record<string, { start: boolean; end: boolean }>>({});

  const [endPush, setEndPush] = useState<Record<string, { otp: string; expires_at: string }>>({});

  const fetchActive = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const today = todayISO();
      const { data, error } = await supabase
        .from("event_bookings")
        .select(
          "id, event_id, attended_start, attended_end, event:events(id, name, venue, event_date, start_time, end_time, status, attendance_type)"
        )
        .eq("user_id", profile.id)
        .in("event.status", ["approved", "ongoing"])
        .eq("event.event_date", today);

      if (error) throw error;

      const now = new Date();
      const cur = now.toTimeString().slice(0, 5);
      const activeNow =
        (data || []).filter((b: any) => {
          const st = b.event?.start_time?.slice(0, 5);
          const et = b.event?.end_time?.slice(0, 5);
          if (!st || !et) return false;
          return cur >= st && cur <= et;
        }) || [];

      setActive(activeNow);
    } catch (e: any) {
      setError(e.message || "Failed to load active events");
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  // Subscribe to end OTP pushes (only allowed if attended_start=true due to RLS).
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel("member-end-otp-pushes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "otp_pushes" },
        (payload) => {
          const row = payload.new as any;
          setEndPush((prev) => ({ ...prev, [row.event_id]: { otp: row.otp_code, expires_at: row.expires_at } }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function submitOtp(eventId: string, bookingId: string, type: "start" | "end", otp: string) {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a 6-digit OTP");
      return;
    }

    setSubmitting((p) => ({ ...p, [bookingId]: { start: p[bookingId]?.start || false, end: p[bookingId]?.end || false, [type]: true } as any }));
    try {
      const { data, error } = await supabase.rpc("validate_and_mark_attendance", {
        p_event_id: eventId,
        p_otp_code: otp,
        p_otp_type: type,
      });
      if (error) throw error;
      if (data?.ok === false) {
        toast.error(data.error || "Invalid or expired OTP");
        return;
      }
      toast.success(data?.message || "✓ Attendance marked successfully!");
      await fetchActive();
    } catch (e: any) {
      toast.error(e.message || "Attendance failed");
    } finally {
      setSubmitting((p) => ({
        ...p,
        [bookingId]: {
          ...(p[bookingId] || { start: false, end: false }),
          [type]: false,
        } as any,
      }));
    }
  }

  function openScan(bookingId: string, type: "start" | "end") {
    setScanTarget({ bookingId, type });
    setScanOpen(true);
  }

  async function handleScanned(decodedText: string) {
    setScanOpen(false);
    const target = scanTarget;
    if (!target) return;

    // Accept either full URL (.../attend?event_id=...&otp=...&type=...) or just the OTP code.
    try {
      let otp = decodedText.trim();
      let eventId: string | null = null;
      let type: "start" | "end" | null = null;

      if (otp.startsWith("http")) {
        const u = new URL(otp);
        eventId = u.searchParams.get("event_id");
        const t = u.searchParams.get("type");
        type = t === "start" || t === "end" ? t : null;
        otp = u.searchParams.get("otp") || "";
      }

      const booking = active.find((b: any) => b.id === target.bookingId);
      if (!booking) return;

      const finalEventId = eventId || booking.event_id;
      const finalType = type || target.type;

      setOtpInputs((p) => ({ ...p, [target.bookingId]: { ...(p[target.bookingId] || { start: "", end: "" }), [finalType]: otp } }));
      await submitOtp(finalEventId, target.bookingId, finalType, otp);
    } catch {
      toast.error("Invalid QR code");
    }
  }

  const empty = !loading && !error && active.length === 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 rounded-lg animate-pulse" style={{ background: "color-mix(in srgb, var(--text-muted) 14%, transparent)" }} />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="h-6 w-2/3 rounded" style={{ background: "color-mix(in srgb, var(--text-muted) 14%, transparent)" }} />
            <div className="h-4 w-1/2 rounded mt-3" style={{ background: "color-mix(in srgb, var(--text-muted) 10%, transparent)" }} />
            <div className="h-24 w-full rounded mt-5" style={{ background: "color-mix(in srgb, var(--text-muted) 10%, transparent)" }} />
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
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Couldn’t load active events</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{error}</p>
          </div>
        </div>
        <button type="button" onClick={fetchActive} className="btn-secondary text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-4xl">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Mark Attendance</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Enter the OTP (or scan QR) for events that are live right now.
        </p>
      </div>

      {empty ? (
        <div className="glass-card p-12 text-center">
          <CalendarX2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <h3 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            No active booked events right now
          </h3>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
            This section appears only during the event time window.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {active.map((b: any) => {
            const startLocked = false;
            const endLocked = !b.attended_start;
            const pushed = endPush[b.event_id];
            const showEndQr = !!pushed && b.attended_start && !b.attended_end;
            return (
              <div key={b.id} className="glass-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                      {b.event?.name || "Event"}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        {b.event?.start_time?.slice(0, 5)}–{b.event?.end_time?.slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        {b.event?.venue || "Venue TBD"}
                      </span>
                    </div>
                  </div>

                  {(b.attended_start || b.attended_end) && (
                    <div className="flex items-center gap-2 text-sm">
                      {b.attended_start && (
                        <span className="flex items-center gap-1" style={{ color: "var(--success)" }}>
                          <CheckCircle2 className="w-4 h-4" /> Start marked
                        </span>
                      )}
                      {b.attended_end && (
                        <span className="flex items-center gap-1" style={{ color: "var(--success)" }}>
                          <CheckCircle2 className="w-4 h-4" /> End marked
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start OTP */}
                  <OtpBox
                    title="Start OTP"
                    disabled={startLocked || b.attended_start}
                    value={otpInputs[b.id]?.start || ""}
                    onChange={(v) => setOtpInputs((p) => ({ ...p, [b.id]: { ...(p[b.id] || { start: "", end: "" }), start: v } }))}
                    onSubmit={() => submitOtp(b.event_id, b.id, "start", otpInputs[b.id]?.start || "")}
                    onScan={() => openScan(b.id, "start")}
                    loading={submitting[b.id]?.start || false}
                    helper={b.attended_start ? "Start attendance already marked." : "You can submit Start OTP anytime during the event."}
                  />

                  {/* End OTP */}
                  <OtpBox
                    title="End OTP"
                    disabled={endLocked || b.attended_end}
                    value={otpInputs[b.id]?.end || ""}
                    onChange={(v) => setOtpInputs((p) => ({ ...p, [b.id]: { ...(p[b.id] || { start: "", end: "" }), end: v } }))}
                    onSubmit={() => submitOtp(b.event_id, b.id, "end", otpInputs[b.id]?.end || "")}
                    onScan={() => openScan(b.id, "end")}
                    loading={submitting[b.id]?.end || false}
                    helper={
                      b.attended_end
                        ? "End attendance already marked."
                        : endLocked
                          ? "Submit Start OTP to unlock End OTP."
                          : "End OTP unlocks after Start OTP."
                    }
                  />
                </div>

                {showEndQr && (
                  <div className="mt-5 glass-card p-4">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      End OTP QR (pushed to your screen)
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                      Scan this QR to submit End OTP instantly.
                    </p>
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="p-3 rounded-xl border w-fit" style={{ borderColor: "var(--border)", background: "#fff" }}>
                        <QRCode
                          value={`${window.location.origin}/attend?event_id=${encodeURIComponent(b.event_id)}&otp=${encodeURIComponent(pushed.otp)}&type=end`}
                          size={220}
                        />
                      </div>
                      <Countdown expiresAt={pushed.expires_at} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <QrScanModal
        open={scanOpen}
        title={scanTarget?.type === "start" ? "Scan Start OTP" : "Scan End OTP"}
        onClose={() => setScanOpen(false)}
        onScanned={handleScanned}
      />
    </div>
  );
}

function OtpBox({
  title,
  disabled,
  value,
  onChange,
  onSubmit,
  onScan,
  loading,
  helper,
}: {
  title: string;
  disabled: boolean;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onScan: () => void;
  loading: boolean;
  helper: string;
}) {
  return (
    <div
      className="p-4 rounded-xl border"
      style={{
        borderColor: "var(--border)",
        background: disabled ? "color-mix(in srgb, var(--bg-secondary) 70%, transparent)" : "var(--bg-card)",
        opacity: disabled ? 0.75 : 1,
      }}
    >
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{helper}</p>

      <div className="mt-3 flex items-center gap-2">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="input-field text-center font-bold tracking-[0.35em]"
          placeholder="••••••"
          disabled={disabled}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onScan}
          disabled={disabled}
          className="btn-secondary text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ScanLine className="w-4 h-4" /> Scan QR
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || loading}
          className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          {loading ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState<number>(() => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });

  useEffect(() => {
    const id = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setLeft(Math.max(0, Math.floor(ms / 1000)));
    }, 500);
    return () => clearInterval(id);
  }, [expiresAt]);

  const danger = left <= 5;
  return (
    <div className="flex-1">
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Time remaining
      </p>
      <div className="mt-2">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "color-mix(in srgb, var(--border) 70%, transparent)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, (left / 90) * 100)}%`,
              background: danger ? "var(--danger)" : "var(--accent-primary)",
              transition: "width 0.2s ease",
            }}
          />
        </div>
        <p className="text-sm mt-2 font-bold" style={{ color: danger ? "var(--danger)" : "var(--text-secondary)" }}>
          {left}s
        </p>
      </div>
    </div>
  );
}

