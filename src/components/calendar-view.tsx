"use client";

import { useEffect, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { createClient } from "@/lib/supabase/client";
import { Globe, GraduationCap, RefreshCw } from "lucide-react";
import { useSessionProfile } from "@/components/session-profile-provider";
import { toast } from "sonner";

// Setup date-fns localizer for react-big-calendar
const locales = {
  "en-US": require("date-fns/locale/en-US"),
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export function CalendarView() {
  const supabase = createClient();
  const { profile } = useSessionProfile();
  const [events, setEvents] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"hub" | "ieee">("hub");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("events")
      .select("*")
      .in("status", ["approved", "ongoing", "completed"]);

    if (data) {
      // Transform Supabase data into react-big-calendar format
      const calendarEvents = data.map((e) => {
        const startDate = new Date(e.event_date + "T" + (e.start_time || "00:00"));
        const endDate = e.end_time 
          ? new Date(e.event_date + "T" + e.end_time) 
          : new Date(startDate.getTime() + 60 * 60 * 1000); // default 1 hr

        return {
          id: e.id,
          title: e.name,
          start: startDate,
          end: endDate,
          is_ieee_official: e.is_ieee_official || false,
          desc: e.short_description || "",
          venue: e.venue || "Virtual",
        };
      });
      setEvents(calendarEvents);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync-ieee-events");
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message || "Sync successful");
        loadEvents();
      } else {
        toast.error(result.error || "Sync failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Filter events based on toggle
  const displayedEvents = events.filter((e) => 
    viewMode === "ieee" ? e.is_ieee_official : !e.is_ieee_official
  );

  return (
    <div className="space-y-6 animate-slide-up h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-4xl font-heading tracking-wide mb-2">Global Calendar</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            View and track all approved events occurring within the Hub or globally via IEEE.
          </p>
        </div>

        {/* Toggle between Hub and IEEE Events */}
        <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setViewMode("hub")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              viewMode === "hub" 
                ? "bg-[var(--accent-primary)] text-white shadow-md" 
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <GraduationCap className="w-4 h-4" /> Hub Events
          </button>
          <button
            onClick={() => setViewMode("ieee")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              viewMode === "ieee" 
                ? "bg-[var(--accent-primary)] text-white shadow-md" 
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Globe className="w-4 h-4" /> IEEE Official
          </button>
        </div>
        
        {/* Admin Manual Sync Button */}
        {profile?.role === "admin_primary" && viewMode === "ieee" && (
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-[var(--accent-primary)] text-white hover:brightness-110 shadow-md ml-auto sm:ml-0"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync IEEE Events"}
          </button>
        )}
      </div>

      <div className="glass-card p-5 flex-1 min-h-[600px] calendar-wrapper">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: "var(--accent-primary) transparent transparent transparent" }}></div>
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={displayedEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "100%" }}
            views={["month", "week", "day", "agenda"]}
            eventPropGetter={(event) => {
              return {
                style: {
                  backgroundColor: event.is_ieee_official ? "#00629B" : "var(--accent-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "2px 6px",
                  fontSize: "12px",
                  fontWeight: "600",
                }
              };
            }}
          />
        )}
      </div>
    </div>
  );
}
