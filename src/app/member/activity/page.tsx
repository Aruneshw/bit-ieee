"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSessionProfile } from "@/components/session-profile-provider";
import {
  Calendar, CalendarX2, ChevronDown, ChevronUp, Clock, MapPin, User, X,
  AlertCircle, RefreshCw, Loader2,
} from "lucide-react";
import { toast } from "sonner";

type ActivityView = "current" | "create";

type EventRow = any;

const SOCIETY_BADGE_COLORS: string[] = [
  "color-mix(in srgb, var(--accent-primary) 80%, transparent)",
  "color-mix(in srgb, #a855f7 75%, transparent)",
  "color-mix(in srgb, #22c55e 75%, transparent)",
  "color-mix(in srgb, #f97316 75%, transparent)",
  "color-mix(in srgb, #06b6d4 75%, transparent)",
  "color-mix(in srgb, #ef4444 75%, transparent)",
  "color-mix(in srgb, #eab308 75%, transparent)",
  "color-mix(in srgb, #14b8a6 75%, transparent)",
  "color-mix(in srgb, #64748b 75%, transparent)",
  "color-mix(in srgb, #0ea5e9 75%, transparent)",
  "color-mix(in srgb, #f59e0b 75%, transparent)",
  "color-mix(in srgb, #84cc16 75%, transparent)",
];

function formatDateTime(event: EventRow) {
  const dateStr: string | null = event.event_date ?? (event.date ? new Date(event.date).toISOString().slice(0, 10) : null);
  const start = event.start_time ?? null;
  const end = event.end_time ?? null;

  if (!dateStr) return "Date TBD";

  const d = new Date(dateStr + "T00:00:00");
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const day = d.toLocaleDateString(undefined, { day: "2-digit" });
  const month = d.toLocaleDateString(undefined, { month: "short" });
  const year = d.toLocaleDateString(undefined, { year: "numeric" });

  const fmtTime = (t: string) => {
    const [hh, mm] = t.split(":");
    const dt = new Date();
    dt.setHours(Number(hh), Number(mm || 0), 0, 0);
    return dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };

  if (start && end) return `${weekday}, ${day} ${month} ${year} · ${fmtTime(start)} – ${fmtTime(end)}`;
  return `${weekday}, ${day} ${month} ${year}`;
}

function truncate2Lines(text: string) {
  return text;
}

export default function MemberActivityPage() {
  const supabase = createClient();
  const { profile } = useSessionProfile();

  const [view, setView] = useState<ActivityView>("current");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [bookedEventIds, setBookedEventIds] = useState<Set<string>>(new Set());
  const [myRequestsOpen, setMyRequestsOpen] = useState(true);
  const [myRequests, setMyRequests] = useState<EventRow[]>([]);

  const [drawerEvent, setDrawerEvent] = useState<EventRow | null>(null);

  const channelRef = useRef<any>(null);

  const visibleApprovedEvents = useMemo(() => {
    const filtered = (events || [])
      .filter((e) => (e.status === "approved" || e.status === "ongoing"))
      .filter((e) => (e.current_bookings ?? 0) < (e.max_capacity ?? 70));

    filtered.sort((a, b) => {
      const ad = a.event_date ?? (a.date ? new Date(a.date).toISOString().slice(0, 10) : "9999-12-31");
      const bd = b.event_date ?? (b.date ? new Date(b.date).toISOString().slice(0, 10) : "9999-12-31");
      return ad.localeCompare(bd);
    });
    return filtered;
  }, [events]);

  async function fetchAll() {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);

    try {
      const [eventsRes, bookingsRes, myReqRes] = await Promise.all([
        supabase
          .from("events")
          .select("*, society:societies(id, name, abbreviation), organiser:users(id, full_name, name, department)")
          .in("status", ["approved", "ongoing"])
          .order("event_date", { ascending: true }),
        supabase.from("event_bookings").select("event_id").eq("user_id", profile.id),
        supabase
          .from("events")
          .select("id, name, short_description, status, admin_notes, created_at, event_date, start_time, end_time")
          .eq("organiser_id", profile.id)
          .in("status", ["pending", "rejected"])
          .order("created_at", { ascending: false }),
      ]);

      if (eventsRes.error) throw eventsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (myReqRes.error) throw myReqRes.error;

      setEvents(eventsRes.data || []);
      setMyRequests(myReqRes.data || []);
      setBookedEventIds(new Set((bookingsRes.data || []).map((b: any) => b.event_id)));
    } catch (e: any) {
      setError(e.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel("member-activity-events")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          // Re-fetch for correctness (status/capacity updates)
          fetchAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_bookings", filter: `user_id=eq.${profile.id}` },
        () => fetchAll()
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function handleBook(event: EventRow) {
    try {
      const { data, error } = await supabase.rpc("book_event", { p_event_id: event.id });
      if (error) throw error;
      if (data && data.ok === false) {
        toast.error(data.error || "Booking failed");
        return;
      }
      toast.success(`You're registered for ${event.name || "this event"}!`);
      setBookedEventIds((prev) => new Set(prev).add(event.id));
    } catch (e: any) {
      toast.error(e.message || "Booking failed");
    }
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-4xl font-heading tracking-wide mb-2">Activity</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Browse approved events and submit new activity requests.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border p-1 w-fit"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
        >
          <button
            type="button"
            onClick={() => setView("current")}
            className="px-3 py-2 text-sm font-semibold rounded-lg transition-colors"
            style={{
              background: view === "current" ? "var(--accent-primary)" : "transparent",
              color: view === "current" ? "#fff" : "var(--text-secondary)",
            }}
          >
            Current Events
          </button>
          <button
            type="button"
            onClick={() => setView("create")}
            className="px-3 py-2 text-sm font-semibold rounded-lg transition-colors"
            style={{
              background: view === "create" ? "var(--accent-primary)" : "transparent",
              color: view === "create" ? "#fff" : "var(--text-secondary)",
            }}
          >
            Create Activity
          </button>
        </div>
      </div>

      {view === "current" && (
        <>
          {loading ? (
            <CurrentEventsSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchAll} />
          ) : visibleApprovedEvents.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleApprovedEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  isBooked={bookedEventIds.has(e.id)}
                  onViewDetails={() => setDrawerEvent(e)}
                  onBook={() => handleBook(e)}
                />
              ))}
            </div>
          )}

          {/* My submitted requests */}
          <div className="glass-card p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setMyRequestsOpen((v) => !v)}
              className="w-full flex items-center justify-between p-5 hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <div className="text-left">
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  Your Submitted Requests
                </p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Pending and rejected events submitted by you.
                </p>
              </div>
              {myRequestsOpen ? (
                <ChevronUp className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
              ) : (
                <ChevronDown className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
              )}
            </button>

            {myRequestsOpen && (
              <div className="border-t p-5" style={{ borderColor: "var(--border)" }}>
                {myRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarX2 className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                    <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                      No pending or rejected requests
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                      When you submit an event, it will appear here until approved.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myRequests.map((r) => (
                      <div
                        key={r.id}
                        className="p-4 rounded-xl border"
                        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                              {r.name}
                            </p>
                            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                              {formatDateTime(r)}
                            </p>
                          </div>
                          <StatusBadge status={r.status} />
                        </div>
                        {r.status === "rejected" && r.admin_notes && (
                          <div
                            className="mt-3 p-3 rounded-lg"
                            style={{
                              background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                              border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                            }}
                          >
                            <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>
                              Rejection reason
                            </p>
                            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                              {r.admin_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Slide-in drawer */}
          <EventDrawer event={drawerEvent} onClose={() => setDrawerEvent(null)} />
        </>
      )}

      {view === "create" && <CreateActivityForm onSuccess={() => { setView("current"); fetchAll(); }} />}
    </div>
  );
}

function CurrentEventsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass-card p-5 animate-pulse">
          <div className="h-5 w-28 rounded" style={{ background: "color-mix(in srgb, var(--text-muted) 18%, transparent)" }} />
          <div className="h-6 w-3/4 rounded mt-4" style={{ background: "color-mix(in srgb, var(--text-muted) 18%, transparent)" }} />
          <div className="h-4 w-full rounded mt-3" style={{ background: "color-mix(in srgb, var(--text-muted) 14%, transparent)" }} />
          <div className="h-4 w-2/3 rounded mt-2" style={{ background: "color-mix(in srgb, var(--text-muted) 14%, transparent)" }} />
          <div className="h-10 w-full rounded mt-5" style={{ background: "color-mix(in srgb, var(--text-muted) 12%, transparent)" }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-card p-12 text-center">
      <CalendarX2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
      <h3 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
        No upcoming events right now. Check back soon!
      </h3>
      <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
        Newly approved events will appear instantly here.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
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
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
            Couldn’t load events
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {message}
          </p>
        </div>
      </div>
      <button type="button" onClick={onRetry} className="btn-secondary text-sm flex items-center gap-2">
        <RefreshCw className="w-4 h-4" />
        Retry
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status as string;
  const style =
    s === "pending"
      ? { background: "var(--warning)", color: "#111" }
      : s === "approved" || s === "ongoing"
        ? { background: "var(--success)", color: "#fff" }
        : s === "rejected"
          ? { background: "var(--danger)", color: "#fff" }
          : { background: "var(--text-muted)", color: "#fff" };

  return (
    <span className="px-3 py-1 text-xs font-bold" style={{ borderRadius: "var(--radius-badge)", ...style }}>
      {s.toUpperCase()}
    </span>
  );
}

function SocietyBadge({ event }: { event: EventRow }) {
  const society = event.society;
  const label = society?.abbreviation || society?.name || "IEEE";
  const idx = Math.abs(String(event.society_id || label).split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % SOCIETY_BADGE_COLORS.length;

  return (
    <span
      className="px-3 py-1 text-xs font-bold"
      style={{
        borderRadius: "var(--radius-badge)",
        background: SOCIETY_BADGE_COLORS[idx],
        color: "#fff",
      }}
    >
      {label}
    </span>
  );
}

function EventCard({
  event,
  isBooked,
  onViewDetails,
  onBook,
}: {
  event: EventRow;
  isBooked: boolean;
  onViewDetails: () => void;
  onBook: () => void;
}) {
  const short = event.short_description ?? event.description ?? "";
  const venue = event.venue ?? "Venue TBD";
  const organizer = event.organiser?.full_name ?? event.organiser?.name ?? event.organizer_name ?? "Organizer";

  return (
    <div className="glass-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <SocietyBadge event={event} />
        {isBooked && (
          <span
            className="px-3 py-1 text-xs font-bold"
            style={{ borderRadius: "var(--radius-badge)", background: "var(--success)", color: "#fff" }}
          >
            Booked ✓
          </span>
        )}
      </div>

      <h3 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        {event.name}
      </h3>

      <p
        className="mt-2 text-sm"
        style={{
          color: "var(--text-secondary)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
        title={short}
      >
        {truncate2Lines(short)}
      </p>

      <div className="mt-4 space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <span>{formatDateTime(event)}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <span>{venue}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <span>{organizer}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onViewDetails} className="btn-secondary text-sm">
          View Details
        </button>
        <button
          type="button"
          onClick={onBook}
          disabled={isBooked}
          className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Book Event
        </button>
      </div>
    </div>
  );
}

function EventDrawer({ event, onClose }: { event: EventRow | null; onClose: () => void }) {
  const open = !!event;
  const supabase = createClient();
  const [team, setTeam] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!event?.id) return;
      const { data } = await supabase
        .from("event_team")
        .select("role, member:users(full_name, name, roll_number, department)")
        .eq("event_id", event.id);
      if (!mounted) return;
      setTeam(data || []);
    }
    setTeam([]);
    load();
    return () => { mounted = false; };
  }, [event?.id]);

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
      aria-hidden={!open}
    >
      {/* overlay */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          background: "rgba(0,0,0,0.35)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* panel */}
      <div
        className="absolute top-0 right-0 h-full w-full sm:w-[520px] transition-transform duration-200 pointer-events-auto"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          background: "var(--bg-card)",
          borderLeft: `1px solid var(--border)`,
          boxShadow: open ? `-8px 0 24px var(--shadow)` : `none`,
        }}
      >
        <div className="p-5 border-b flex items-start justify-between gap-3" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: "var(--text-muted)" }}>
              EVENT DETAILS
            </p>
            <h3 className="text-xl font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
              {event?.name || "—"}
            </h3>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {event ? formatDateTime(event) : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
            <X className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto h-[calc(100%-74px)]">
          <div className="glass-card p-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Description
            </p>
            <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
              {event?.detailed_description || event?.description || event?.short_description || "—"}
            </p>
          </div>

          <div className="glass-card p-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Venue & Organizer
            </p>
            <div className="mt-3 space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <span>{event?.venue || "Venue TBD"}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <span>{event?.organiser?.full_name ?? event?.organiser?.name ?? event?.organizer_name ?? "Organizer"}</span>
              </div>
              {event?.organizer_department && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <span>{event.organizer_department}</span>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Attendance Method
            </p>
            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              {event?.attendance_type || "otp"}
            </p>
          </div>

          <div className="glass-card p-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Event Team
            </p>
            {team.length === 0 ? (
              <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
                Team not assigned yet.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {team.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border flex items-start justify-between gap-3"
                    style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {(t.member?.full_name || t.member?.name) || "—"}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        {t.member?.roll_number || "—"} · {t.member?.department || "—"}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1" style={{ borderRadius: "var(--radius-badge)", background: "color-mix(in srgb, var(--accent-primary) 18%, transparent)", color: "var(--accent-primary)", border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)" }}>
                      {t.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateActivityForm({ onSuccess }: { onSuccess: () => void }) {
  const supabase = createClient();
  const { profile } = useSessionProfile();

  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptMode, setDeptMode] = useState<"select" | "free">("select");

  const [form, setForm] = useState({
    title: "",
    department: "",
    departmentFree: "",
    event_date: "",
    start_time: "",
    end_time: "",
    short_description: "",
    detailed_description: "",
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const shortCount = form.short_description.length;
  const shortCounterColor = shortCount > 180 ? "var(--danger)" : "var(--text-muted)";

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (touched.title && !form.title.trim()) e.title = "Event title is required";

    const deptValue = deptMode === "select" ? form.department : form.departmentFree;
    if (touched.department && !deptValue?.trim()) e.department = "Department is required";

    if (touched.event_date && !form.event_date) e.event_date = "Date is required";

    const today = new Date();
    const selectedDate = form.event_date ? new Date(form.event_date + "T00:00:00") : null;
    if (form.event_date && selectedDate) {
      const todayDate = new Date(today.toISOString().slice(0, 10) + "T00:00:00");
      if (selectedDate < todayDate) e.event_date = "Past dates are not allowed";
    }

    if (touched.start_time && !form.start_time) e.start_time = "Start time is required";
    if (touched.end_time && !form.end_time) e.end_time = "End time is required";

    if (form.start_time && form.end_time) {
      if (form.end_time <= form.start_time) e.end_time = "End time must be after start time";
    }

    if (touched.short_description && !form.short_description.trim()) e.short_description = "Short description is required";
    if (form.short_description.length > 200) e.short_description = "Max 200 characters";

    if (touched.detailed_description && !form.detailed_description.trim()) e.detailed_description = "Detailed description is required";
    return e;
  }, [form, touched, deptMode]);

  const canSubmit = Object.keys(errors).length === 0
    && form.title.trim()
    && (deptMode === "select" ? form.department.trim() : form.departmentFree.trim())
    && form.event_date
    && form.start_time
    && form.end_time
    && form.short_description.trim()
    && form.detailed_description.trim();

  useEffect(() => {
    async function loadDepartments() {
      // Use existing departments in DB as source-of-truth.
      const { data, error } = await supabase
        .from("users")
        .select("department")
        .not("department", "is", null);

      if (error) return;
      const unique = Array.from(new Set((data || []).map((r: any) => String(r.department).trim()).filter(Boolean)));
      unique.sort((a, b) => a.localeCompare(b));
      setDepartments(unique);
    }
    loadDepartments();
  }, []);

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setTouched({
      title: true,
      department: true,
      event_date: true,
      start_time: true,
      end_time: true,
      short_description: true,
      detailed_description: true,
    });

    if (!profile?.id || !canSubmit) return;

    setSubmitting(true);
    try {
      const deptValue = deptMode === "select" ? form.department : form.departmentFree;
      const organizerName = (profile as any).full_name ?? (profile as any).name ?? "";

      const payload: any = {
        // Legacy compatibility
        name: form.title.trim(),
        description: form.short_description.trim(),
        society_id: (profile as any).society_id ?? null,
        organiser_id: profile.id,
        status: "pending",
        date: new Date(form.event_date + "T00:00:00").toISOString(),

        // New schema fields
        organizer_name: organizerName,
        organizer_department: deptValue.trim(),
        short_description: form.short_description.trim(),
        detailed_description: form.detailed_description.trim(),
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time,
        current_bookings: 0,
        max_capacity: 70,
      };

      const { error } = await supabase.from("events").insert(payload);
      if (error) throw error;

      toast.success("Event submitted! It will appear in Current Events once an admin approves it.");
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit event");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-card p-6 max-w-3xl">
      <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
        Create Activity
      </h2>
      <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
        Submit an event request. An admin will review and approve it.
      </p>

      <div className="mt-6 space-y-5">
        {/* Title */}
        <Field label="Event Title" error={errors.title}>
          <input
            className="input-field"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, title: true }))}
            placeholder="e.g. Machine Learning Bootcamp"
          />
        </Field>

        {/* Your Name (read-only) */}
        <Field label="Your Name">
          <input
            className="input-field opacity-60 cursor-not-allowed"
            value={(profile as any)?.full_name ?? (profile as any)?.name ?? ""}
            readOnly
          />
        </Field>

        {/* Department */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Department <span style={{ color: "var(--danger)" }}>*</span>
            </p>
            <button
              type="button"
              className="text-sm"
              style={{ color: "var(--accent-primary)" }}
              onClick={() => setDeptMode((m) => (m === "select" ? "free" : "select"))}
            >
              {deptMode === "select" ? "Can’t find yours? Type it" : "Pick from list"}
            </button>
          </div>

          {deptMode === "select" ? (
            <>
              <select
                className="input-field"
                value={form.department}
                onChange={(e) => setField("department", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, department: true }))}
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {errors.department && <InlineError message={errors.department} />}
            </>
          ) : (
            <>
              <input
                className="input-field"
                value={form.departmentFree}
                onChange={(e) => setField("departmentFree", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, department: true }))}
                placeholder="Type your department name"
              />
              {errors.department && <InlineError message={errors.department} />}
            </>
          )}
        </div>

        {/* Date/Time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Date" error={errors.event_date}>
            <input
              type="date"
              className="input-field"
              value={form.event_date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setField("event_date", e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, event_date: true }))}
            />
          </Field>
          <Field label="Start Time" error={errors.start_time}>
            <input
              type="time"
              className="input-field"
              value={form.start_time}
              onChange={(e) => setField("start_time", e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, start_time: true }))}
            />
          </Field>
          <Field label="End Time" error={errors.end_time}>
            <input
              type="time"
              className="input-field"
              value={form.end_time}
              onChange={(e) => setField("end_time", e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, end_time: true }))}
            />
          </Field>
        </div>

        {/* Short description with counter */}
        <div>
          <Field label="Short Description" error={errors.short_description}>
            <div className="relative">
              <textarea
                rows={4}
                className="input-field resize-none pr-20"
                value={form.short_description}
                onChange={(e) => setField("short_description", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, short_description: true }))}
                placeholder="Max 200 characters"
              />
              <span
                className="absolute bottom-2 right-3 text-xs font-semibold"
                style={{ color: shortCounterColor }}
              >
                {shortCount} / 200
              </span>
            </div>
          </Field>
        </div>

        {/* Detailed description */}
        <Field label="Detailed Description" error={errors.detailed_description}>
          <textarea
            rows={8}
            className="input-field resize-none"
            value={form.detailed_description}
            onChange={(e) => setField("detailed_description", e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, detailed_description: true }))}
            placeholder="Write the full details of the event..."
          />
        </Field>

        <button
          type="button"
          onClick={submit}
          disabled={submitting || !canSubmit}
          className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {submitting ? "Submitting..." : "Submit Event"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label} <span style={{ color: "var(--danger)" }}>*</span>
      </p>
      {children}
      {error && <InlineError message={error} />}
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--danger)" }}>
      <AlertCircle className="w-3 h-3" /> {message}
    </p>
  );
}

