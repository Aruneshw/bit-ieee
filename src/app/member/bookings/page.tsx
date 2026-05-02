"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { Calendar, MapPin, Clock, CheckCircle, Users, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function BookingsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  const fetchEvents = useCallback(async (sid: string, uid: string) => {
    const { data: eventsData } = await supabase
      .from("events")
      .select("*, society:societies(name, abbreviation), organiser:users(name)")
      .eq("society_id", sid)
      .eq("status", "approved")
      .eq("booking_enabled", true)
      .order("date", { ascending: true });

    const { data: bookings } = await supabase
      .from("event_bookings")
      .select("event_id")
      .eq("user_id", uid);

    const bookedIds = new Set(bookings?.map(b => b.event_id) || []);
    const now = new Date();
    const categorized = (eventsData || []).map(e => ({
      ...e,
      isPast: e.date ? new Date(e.date) < now : false,
      isBooked: bookedIds.has(e.id),
    }));

    setEvents(categorized);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("users")
        .select("society_id")
        .eq("email", user.email.toLowerCase())
        .single();

      if (profile?.society_id) {
        fetchEvents(profile.society_id, user.id);
      } else {
        setLoading(false);
      }
    }
    init();
  }, [fetchEvents]);

  async function handleBook(eventId: string, eventName: string) {
    const { error } = await supabase.from("event_bookings").insert({
      event_id: eventId,
      user_id: userId,
    });

    if (error) {
      if (error.code === "23505") {
        toast.info("You already booked this event");
      } else {
        toast.error("Failed to book event");
      }
      return;
    }

    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isBooked: true } : e));
    toast.success(`Booked "${eventName}" successfully!`);
  }

  async function handleCancel(eventId: string) {
    const { error } = await supabase
      .from("event_bookings")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);

    if (error) { toast.error("Failed to cancel booking"); return; }

    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isBooked: false } : e));
    toast.info("Booking cancelled");
  }

  const upcoming = events.filter(e => !e.isPast);
  const past = events.filter(e => e.isPast);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 glass-card animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-4xl mx-auto">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2 text-[var(--text-primary)]">Event Bookings</h1>
        <p className="text-[var(--text-secondary)]">Browse and book upcoming events in your society.</p>
      </div>

      {events.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-4" />
          <h3 className="text-xl font-medium text-[var(--text-secondary)]">No Events Available</h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">Approved events with booking enabled will appear here.</p>
        </div>
      ) : (
        <>
          {/* Upcoming Events */}
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-[#00bfff] mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" /> Upcoming Events ({upcoming.length})
              </h3>
              <div className="grid gap-4">
                {upcoming.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isBooked={event.isBooked}
                    onBook={() => handleBook(event.id, event.name)}
                    onCancel={() => handleCancel(event.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past Events */}
          {past.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-400 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Past Events ({past.length})
              </h3>
              <div className="grid gap-4 opacity-70">
                {past.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isBooked={event.isBooked}
                    isPast
                    onBook={() => handleBook(event.id, event.name)}
                    onCancel={() => handleCancel(event.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventCard({ event, isBooked, isPast, onBook, onCancel }: any) {
  return (
    <div className={`glass-card p-5 ${isPast ? 'border-gray-700/30' : isBooked ? 'border-green-500/20' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{event.name}</h3>
            {isBooked && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Booked
              </span>
            )}
            {isPast && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                Completed
              </span>
            )}
          </div>
          {event.description && (
            <p className="text-sm text-[var(--text-secondary)] mb-3">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
            {event.date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {new Date(event.date).toLocaleDateString()}
              </span>
            )}
            {event.venue && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {event.venue}
              </span>
            )}
            {event.organiser?.name && (
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {event.organiser.name}
              </span>
            )}
            <span>{event.event_type} • {event.skill_type}</span>
          </div>
          {event.selected_skill && (
            <p className="text-xs text-[#00bfff] mt-2">Skill: {event.selected_skill}</p>
          )}
        </div>
        <div className="shrink-0">
          {isBooked ? (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={onBook}
              className="btn-primary flex items-center gap-2 text-sm"
              disabled={isPast}
            >
              <BookOpen className="w-4 h-4" /> Book Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
