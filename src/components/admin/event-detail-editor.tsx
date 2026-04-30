"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import QRCode from "react-qr-code";
import { QrScanModal } from "@/components/qr-scan-modal";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const VALIDITY_OPTIONS = [30, 60, 90] as const;

export function AdminEventDetailEditor({ eventId, initialEvent }: { eventId: string; initialEvent: any }) {
  const supabase = createClient();
  const router = useRouter();

  const [event, setEvent] = useState<any>(initialEvent);
  const [venue, setVenue] = useState(initialEvent.venue || "");
  const [saving, setSaving] = useState(false);

  // OTP issuing (admin only here)
  const [validity, setValidity] = useState<(typeof VALIDITY_OPTIONS)[number]>(60);
  const [otpModal, setOtpModal] = useState<{ open: boolean; type: "start" | "end"; code: string; expiresAt: string } | null>(null);

  const now = Date.now();
  const endWindowOpen = useMemo(() => {
    if (!event?.event_date || !event?.end_time) return false;
    const dt = new Date(`${event.event_date}T${event.end_time}`);
    const windowStart = dt.getTime() - 10 * 60 * 1000;
    return now >= windowStart && now <= dt.getTime() + 5 * 60 * 1000;
  }, [event?.event_date, event?.end_time, now]);

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          name: event.name,
          short_description: event.short_description,
          detailed_description: event.detailed_description,
          event_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          venue: venue.trim() || null,
          attendance_type: event.attendance_type,
          status: event.status,
        })
        .eq("id", eventId);
      if (error) throw error;
      toast.success("Saved changes");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function generateOtp(type: "start" | "end") {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Not authenticated");

      // End OTP issuer restriction: must match start OTP issuer
      if (type === "end") {
        const { data: startOtp } = await supabase
          .from("otps")
          .select("issued_by")
          .eq("event_id", eventId)
          .eq("otp_type", "start")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (startOtp?.issued_by && startOtp.issued_by !== user.id) {
          toast.error("Only the Start OTP issuer can issue End OTP for this event.");
          return;
        }
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + validity * 1000).toISOString();

      const { error } = await supabase.from("otps").insert({
        event_id: eventId,
        otp_type: type,
        otp_code: otp,
        issued_by: user.id,
        valid_seconds: validity,
        expires_at: expiresAt,
        is_active: true,
      });
      if (error) throw error;

      // Push End OTP QR to eligible members
      if (type === "end") {
        await supabase.from("otp_pushes").insert({
          event_id: eventId,
          otp_type: "end",
          otp_code: otp,
          expires_at: expiresAt,
        });
        // Mark completed (per spec after End OTP completes, but we set to completed at issuance end in UI later)
      }

      setOtpModal({ open: true, type, code: otp, expiresAt });
    } catch (e: any) {
      toast.error(e.message || "Failed to generate OTP");
    }
  }

  // Expire OTP when countdown ends
  useEffect(() => {
    if (!otpModal?.open) return;
    const id = setInterval(async () => {
      const leftMs = new Date(otpModal.expiresAt).getTime() - Date.now();
      if (leftMs <= 0) {
        clearInterval(id);
        // set inactive
        await supabase
          .from("otps")
          .update({ is_active: false })
          .eq("event_id", eventId)
          .eq("otp_type", otpModal.type)
          .eq("otp_code", otpModal.code);
      }
    }, 700);
    return () => clearInterval(id);
  }, [otpModal?.open, otpModal?.expiresAt, otpModal?.type, otpModal?.code]);

  return (
    <div className="space-y-6 animate-slide-up max-w-5xl">
      <button type="button" onClick={() => router.back()} className="btn-secondary text-sm inline-flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="glass-card p-6">
        <p className="text-xs font-bold tracking-widest" style={{ color: "var(--text-muted)" }}>
          EVENT DETAIL
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
          {event.name}
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          {(event.organiser?.full_name ?? event.organiser?.name) || event.organizer_name || "—"} ·{" "}
          {(event.organiser?.department || event.organizer_department) || "—"}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={saving} className="btn-secondary text-sm inline-flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
          <button type="button" onClick={() => generateOtp("start")} className="btn-primary text-sm inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Generate Start OTP
          </button>
          {endWindowOpen && (
            <button
              type="button"
              onClick={() => generateOtp("end")}
              className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: "var(--success)", color: "#fff" }}
            >
              <CheckCircle2 className="w-4 h-4 inline mr-2" /> Generate End OTP
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Validity</p>
          <div className="flex items-center gap-2">
            {VALIDITY_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValidity(s)}
                className="px-3 py-2 rounded-lg border text-sm font-semibold"
                style={{
                  borderColor: s === validity ? "color-mix(in srgb, var(--accent-primary) 40%, transparent)" : "var(--border)",
                  background: s === validity ? "color-mix(in srgb, var(--accent-primary) 14%, transparent)" : "transparent",
                  color: s === validity ? "var(--accent-primary)" : "var(--text-secondary)",
                }}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Edit</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Title">
            <input className="input-field" value={event.name || ""} onChange={(e) => setEvent({ ...event, name: e.target.value })} />
          </Field>
          <Field label="Status">
            <select 
              className="input-field" 
              value={event.status || "pending"} 
              onChange={(e) => setEvent({ ...event, status: e.target.value })}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected (Revoke)</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
        </div>
        <Field label="Short Description">
          <textarea rows={4} className="input-field resize-none" value={event.short_description || ""} onChange={(e) => setEvent({ ...event, short_description: e.target.value })} />
        </Field>
        <Field label="Detailed Description">
          <textarea rows={8} className="input-field resize-none" value={event.detailed_description || ""} onChange={(e) => setEvent({ ...event, detailed_description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Date">
            <input type="date" className="input-field" value={event.event_date || ""} onChange={(e) => setEvent({ ...event, event_date: e.target.value })} />
          </Field>
          <Field label="Start Time">
            <input type="time" className="input-field" value={event.start_time || ""} onChange={(e) => setEvent({ ...event, start_time: e.target.value })} />
          </Field>
          <Field label="End Time">
            <input type="time" className="input-field" value={event.end_time || ""} onChange={(e) => setEvent({ ...event, end_time: e.target.value })} />
          </Field>
        </div>
        <Field label="Venue">
          <div className="relative">
            <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input className="input-field pl-10" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Assign venue…" />
          </div>
        </Field>
      </div>

      {otpModal?.open && (
        <OtpFullscreen
          eventId={eventId}
          eventName={event.name}
          type={otpModal.type}
          otp={otpModal.code}
          expiresAt={otpModal.expiresAt}
          onClose={() => setOtpModal(null)}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</p>
      {children}
    </div>
  );
}

function OtpFullscreen({
  eventId,
  eventName,
  type,
  otp,
  expiresAt,
  onClose,
}: {
  eventId: string;
  eventName: string;
  type: "start" | "end";
  otp: string;
  expiresAt: string;
  onClose: () => void;
}) {
  const [left, setLeft] = useState(() => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));

  useEffect(() => {
    const id = setInterval(() => {
      setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [expiresAt]);

  const url = `${window.location.origin}/attend?event_id=${encodeURIComponent(eventId)}&otp=${encodeURIComponent(otp)}&type=${type}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div className="glass-card p-6 w-full max-w-3xl" style={{ background: "var(--bg-card)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: "var(--text-muted)" }}>
              {type.toUpperCase()} OTP
            </p>
            <h3 className="text-xl font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
              {eventName}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Close
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>OTP</p>
            <p className="mt-3 font-extrabold tracking-[0.25em]" style={{ fontSize: 96, color: "var(--text-primary)" }}>
              {otp}
            </p>
            <p className="text-sm mt-2" style={{ color: left <= 5 ? "var(--danger)" : "var(--text-secondary)" }}>
              Expires in <b>{left}s</b>
            </p>
          </div>

          <div className="flex flex-col items-center">
            <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>QR</p>
            <div className="mt-3 p-4 rounded-2xl border" style={{ borderColor: "var(--border)", background: "#fff" }}>
              <QRCode value={url} size={260} />
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Members can scan or type the OTP.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

