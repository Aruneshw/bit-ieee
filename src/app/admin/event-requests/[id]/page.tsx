"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Save,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type EventRow = any;
type TeamRow = { member_id: string; role: string; label?: string };

const TEAM_ROLES = ["Host", "Staff", "Intern", "Volunteer", "Coordinator"] as const;
const ATTENDANCE_TYPES = [
  { id: "otp", label: "🔢 OTP Only" },
  { id: "otp_qr", label: "📱 OTP + QR Code" },
  { id: "manual", label: "📋 Manual Roll Call" },
  { id: "none", label: "🚫 No Attendance Tracking" },
] as const;

export default function AdminReviewEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [profilesCache, setProfilesCache] = useState<Record<string, any>>({});

  const [venue, setVenue] = useState("");
  const [venueStatus, setVenueStatus] = useState<"idle" | "ok" | "conflict">("idle");
  const [venueConflict, setVenueConflict] = useState<string | null>(null);

  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [eventRes, teamRes] = await Promise.all([
        supabase
          .from("events")
          .select("*, organiser:users(id, full_name, name, roll_number, department, society_id)")
          .eq("id", id)
          .single(),
        supabase.from("event_team").select("member_id, role").eq("event_id", id),
      ]);

      if (eventRes.error) throw eventRes.error;
      if (teamRes.error) throw teamRes.error;

      setEvent(eventRes.data);
      setVenue(eventRes.data?.venue || "");
      setTeam((teamRes.data || []).map((r: any) => ({ member_id: r.member_id, role: r.role })));
    } catch (e: any) {
      toast.error(e.message || "Failed to load event");
      router.replace("/admin/event-requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canApprove = venue.trim().length > 0;

  const attendanceType = (event?.attendance_type as string) || "otp";

  async function runVenueConflictCheck(nextVenue: string) {
    if (!event?.event_date || !event?.start_time || !event?.end_time) {
      setVenueStatus("idle");
      setVenueConflict(null);
      return;
    }
    if (!nextVenue.trim()) {
      setVenueStatus("idle");
      setVenueConflict(null);
      return;
    }

    const { data, error } = await supabase
      .from("events")
      .select("id, name, start_time, end_time")
      .eq("venue", nextVenue.trim())
      .eq("event_date", event.event_date)
      .eq("status", "approved")
      .neq("id", event.id);

    if (error) return;

    const conflict = (data || []).find((ex: any) => {
      return event.start_time < ex.end_time && event.end_time > ex.start_time;
    });

    if (conflict) {
      setVenueStatus("conflict");
      setVenueConflict(
        `⚠️ Venue conflict detected: ${nextVenue} is already booked for '${conflict.name}' from ${conflict.start_time}–${conflict.end_time} on this date. Please assign a different venue or adjust the time.`
      );
    } else {
      setVenueStatus("ok");
      setVenueConflict(null);
    }
  }

  async function saveChanges() {
    if (!event) return;
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
        })
        .eq("id", event.id);
      if (error) throw error;

      // Save team: replace (simple & safe)
      await supabase.from("event_team").delete().eq("event_id", event.id);
      if (team.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("event_team").insert(
          team
            .filter((t) => t.member_id && t.role)
            .map((t) => ({
              event_id: event.id,
              member_id: t.member_id,
              role: t.role,
              assigned_by: user?.id,
            }))
        );
      }

      toast.success("Changes saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!event) return;
    if (!venue.trim()) return;
    const ok = window.confirm("Approve this event? It will immediately become visible to all members.");
    if (!ok) return;
    setSaving(true);
    try {
      await saveChanges();
      const { error } = await supabase
        .from("events")
        .update({ status: "approved", venue: venue.trim() })
        .eq("id", event.id);
      if (error) throw error;
      toast.success("Event approved");
      router.replace("/admin/event-requests");
    } catch (e: any) {
      toast.error(e.message || "Failed to approve");
    } finally {
      setSaving(false);
    }
  }

  async function reject() {
    if (!event) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({ status: "rejected", admin_notes: rejectReason.trim() || null })
        .eq("id", event.id);
      if (error) throw error;
      toast.success("Event rejected");
      router.replace("/admin/event-requests");
    } catch (e: any) {
      toast.error(e.message || "Failed to reject");
    } finally {
      setSaving(false);
    }
  }

  async function searchProfiles(q: string) {
    setSearch(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from("users")
      .select("id, full_name, name, roll_number, department")
      .or(`full_name.ilike.%${q}%,name.ilike.%${q}%,roll_number.ilike.%${q}%`)
      .limit(8);
    setSearchResults(data || []);
  }

  function setTeamMember(idx: number, member: any) {
    setProfilesCache((p) => ({ ...p, [member.id]: member }));
    setTeam((prev) => prev.map((t, i) => (i === idx ? { ...t, member_id: member.id } : t)));
    setSearch("");
    setSearchResults([]);
  }

  const teamDisplay = useMemo(() => {
    return team.map((t) => {
      const p = profilesCache[t.member_id];
      const label = p
        ? `${p.full_name || p.name || "—"} · ${p.roll_number || "—"} · ${p.department || "—"}`
        : t.member_id;
      return { ...t, label };
    });
  }, [team, profilesCache]);

  if (loading || !event) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent-primary)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-5xl">
      <button type="button" onClick={() => router.back()} className="btn-secondary text-sm inline-flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: "var(--text-muted)" }}>
              REVIEW EVENT REQUEST
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
              {event.name}
            </h1>
            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              Organizer: {(event.organiser?.full_name ?? event.organiser?.name) || event.organizer_name || "—"} ·{" "}
              {(event.organiser?.roll_number || "—")}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Department: {event.organiser?.department || event.organizer_department || "—"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveChanges} disabled={saving} className="btn-secondary text-sm inline-flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
            <button
              type="button"
              onClick={approve}
              disabled={saving || !canApprove}
              className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!canApprove ? "Please assign a venue first" : undefined}
            >
              <CheckCircle2 className="w-4 h-4" /> Approve
            </button>
            <button
              type="button"
              onClick={() => setRejecting((v) => !v)}
              disabled={saving}
              className="text-sm font-semibold px-4 py-2 rounded-lg border transition-colors"
              style={{
                borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)",
                background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                color: "var(--danger)",
              }}
            >
              <ShieldAlert className="w-4 h-4 inline mr-2" />
              Reject
            </button>
          </div>
        </div>
      </div>

      {/* Edit section */}
      <div className="glass-card p-6 space-y-5">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Edit</h2>

        <Field label="Title">
          <input className="input-field" value={event.name || ""} onChange={(e) => setEvent({ ...event, name: e.target.value })} />
        </Field>
        <Field label="Short Description">
          <textarea className="input-field resize-none" rows={4} value={event.short_description || ""} onChange={(e) => setEvent({ ...event, short_description: e.target.value })} />
        </Field>
        <Field label="Detailed Description">
          <textarea className="input-field resize-none" rows={8} value={event.detailed_description || ""} onChange={(e) => setEvent({ ...event, detailed_description: e.target.value })} />
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

        {/* Venue */}
        <div>
          <Field label="Assign Venue">
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                className="input-field pl-10"
                value={venue}
                onChange={(e) => {
                  setVenue(e.target.value);
                  setVenueStatus("idle");
                  setVenueConflict(null);
                }}
                onBlur={() => runVenueConflictCheck(venue)}
                placeholder="e.g. Seminar Hall A"
              />
              {venueStatus === "ok" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: "var(--success)" }}>
                  ✓ Venue is available
                </span>
              )}
            </div>
          </Field>

          {venueStatus === "conflict" && venueConflict && (
            <div
              className="mt-3 p-4 rounded-xl border"
              style={{
                background: "color-mix(in srgb, var(--warning) 14%, transparent)",
                borderColor: "color-mix(in srgb, var(--warning) 35%, transparent)",
              }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {venueConflict}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                You can still approve if you want to override.
              </p>
            </div>
          )}
        </div>

        {/* Attendance type */}
        <div>
          <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Attendance Method
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ATTENDANCE_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setEvent({ ...event, attendance_type: t.id })}
                className="px-4 py-3 rounded-xl border text-left transition-colors"
                style={{
                  borderColor: t.id === attendanceType ? "color-mix(in srgb, var(--accent-primary) 40%, transparent)" : "var(--border)",
                  background: t.id === attendanceType ? "color-mix(in srgb, var(--accent-primary) 14%, transparent)" : "var(--bg-card)",
                  color: "var(--text-primary)",
                }}
              >
                <p className="font-semibold">{t.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Event team */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Assign Event Team</h2>

        <div className="grid gap-3">
          {teamDisplay.map((t, idx) => (
            <div key={idx} className="grid grid-cols-1 lg:grid-cols-[1fr_220px_40px] gap-2 items-start">
              <div className="relative">
                <input
                  className="input-field"
                  value={t.label || ""}
                  onChange={(e) => searchProfiles(e.target.value)}
                  placeholder="Search by name or roll number..."
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border overflow-hidden"
                    style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
                  >
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => setTeamMember(idx, p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {(p.full_name || p.name) || "—"} · {p.roll_number || "—"} · {p.department || "—"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <select
                className="input-field"
                value={t.role}
                onChange={(e) => setTeam((prev) => prev.map((x, i) => (i === idx ? { ...x, role: e.target.value } : x)))}
              >
                <option value="">Select role</option>
                {TEAM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>

              <button
                type="button"
                onClick={() => setTeam((prev) => prev.filter((_, i) => i !== idx))}
                className="p-2 rounded-lg border hover:bg-[var(--bg-secondary)] transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--danger)" }}
                aria-label="Remove team member"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setTeam((prev) => [...prev, { member_id: "", role: "" }])}
          className="btn-secondary text-sm"
        >
          + Add Member
        </button>
      </div>

      {/* Reject panel */}
      {rejecting && (
        <div className="glass-card p-6 space-y-3">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Rejection reason (optional)
          </p>
          <textarea
            rows={3}
            className="input-field resize-none"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Add a reason to help the organizer fix and resubmit…"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reject}
              disabled={saving}
              className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: "var(--danger)", color: "#fff" }}
            >
              Confirm Reject
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

