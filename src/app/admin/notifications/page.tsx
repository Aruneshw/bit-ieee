"use client";

import { createClient } from "@/core/database/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { Bell, Check, X, Mail, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function AdminNotificationsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingEvents = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*, organiser:users!events_organiser_id_fkey(name, email), society:societies(name, abbreviation)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    
    setEvents(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPendingEvents();
  }, [fetchPendingEvents]);

  async function handleApprove(event: any) {
    const { error } = await supabase
      .from("events")
      .update({ status: "approved", booking_enabled: true })
      .eq("id", event.id);

    if (error) { toast.error("Failed to approve"); return; }

    await supabase.from("notifications").insert({
      recipient_id: event.organiser_id,
      title: "Event Approved",
      message: `Your event "${event.name}" has been approved! Booking is now enabled.`,
      type: "approval",
    });

    try {
      const organiserEmail = event.organiser?.email;
      if (organiserEmail) {
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: organiserEmail,
            subject: `IEEE Hub — Event "${event.name}" Approved`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #00629B;">Event Approved!</h2>
                <p>Dear ${event.organiser?.name || 'Leader'},</p>
                <p>Your event request has been <strong>approved</strong> by the IEEE Hub administration.</p>
                <div style="background: #f0f7ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p><strong>Event:</strong> ${event.name}</p>
                  <p><strong>Society:</strong> ${event.society?.abbreviation || event.society?.name || 'N/A'}</p>
                  <p><strong>Type:</strong> ${event.event_type || 'N/A'}</p>
                  <p><strong>Status:</strong> <span style="color: green;">Booking Enabled</span></p>
                </div>
                <p>Members of your society can now book this event. You can generate an OTP for the task session from your Leadership panel.</p>
                <p style="color: #666; font-size: 12px;">This is an automated email from IEEE BIT Hub. Please do not reply.</p>
              </div>
            `,
          }),
        });
      }
    } catch (err) {
      console.error("Failed to send approval email:", err);
    }

    toast.success(`Event "${event.name}" approved! Email sent to organiser.`);
    fetchPendingEvents();
  }

  async function handleReject(event: any) {
    const { error } = await supabase
      .from("events")
      .update({ status: "rejected" })
      .eq("id", event.id);

    if (error) { toast.error("Failed to reject"); return; }

    await supabase.from("notifications").insert({
      recipient_id: event.organiser_id,
      title: "Event Rejected",
      message: `Your event "${event.name}" has been rejected.`,
      type: "rejection",
    });

    toast.success(`Event "${event.name}" rejected`);
    fetchPendingEvents();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 glass-card animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Notification Panel</h1>
        <p className="text-gray-400">Review and manage event conduct requests from leadership.</p>
      </div>

      {events.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Bell className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-medium text-gray-400">No Pending Requests</h3>
          <p className="text-sm text-gray-500 mt-2">All event requests have been processed.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map(event => (
            <div key={event.id} className="glass-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      PENDING
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(event.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{event.name}</h3>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {event.organiser?.name || event.organiser?.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {event.society?.abbreviation || "N/A"}
                    </span>
                    <span>{event.event_type || "N/A"} • {event.skill_type || "N/A"}</span>
                  </div>
                  {event.description && (
                    <p className="text-sm text-gray-500 mt-2">{event.description}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(event)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/25 transition-colors text-sm font-medium"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(event)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition-colors text-sm font-medium"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
