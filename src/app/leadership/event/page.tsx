"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { Send, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

export default function EventRequestPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Not authenticated");
      const { data: profile } = await supabase.from("users").select("society_id, name").eq("email", user.email.toLowerCase()).single();

      const { error } = await supabase.from("events").insert({
        name: fd.get("name"),
        description: fd.get("description") || null,
        society_id: profile?.society_id,
        organiser_id: user.id,
        skill_type: fd.get("skillType"),
        selected_skill: fd.get("selectedSkill"),
        event_type: fd.get("eventType"),
        date: fd.get("date") ? new Date(fd.get("date") as string).toISOString() : null,
        status: "pending",
      });

      if (error) throw error;

      // Notify admins
      await supabase.from("notifications").insert({
        title: "New Event Request",
        message: `${profile?.name || user.email} has requested to conduct "${fd.get("name")}"`,
        type: "event_request",
        recipient_role: "admin_primary",
        sent_by: user.id,
      });

      toast.success("Event request submitted to Admin!");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-3xl">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Event Request</h1>
        <p className="text-gray-400">Submit an event proposal for admin approval.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
        <h3 className="text-xl font-medium flex items-center gap-2 border-b border-white/10 pb-4">
          <CalendarPlus className="w-5 h-5 text-[#00bfff]" /> Event Details
        </h3>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Event Name *</label>
          <input name="name" required className="input-field" placeholder="e.g. Intro to IoT" />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Description</label>
          <textarea name="description" rows={3} className="input-field resize-none" placeholder="Briefly describe the event..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Skill Type</label>
            <select name="skillType" className="input-field">
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Selected Skill</label>
            <input name="selectedSkill" className="input-field" placeholder="e.g. Machine Learning" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Event Type *</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-white bg-black/30 px-4 py-3 rounded-lg border border-white/10 cursor-pointer flex-1 justify-center hover:border-[#00bfff] transition-colors">
              <input type="radio" name="eventType" value="hardware" required className="accent-[#00bfff]" /> Hardware
            </label>
            <label className="flex items-center gap-2 text-white bg-black/30 px-4 py-3 rounded-lg border border-white/10 cursor-pointer flex-1 justify-center hover:border-[#00bfff] transition-colors">
              <input type="radio" name="eventType" value="software" required className="accent-[#00bfff]" /> Software
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Preferred Date</label>
          <input name="date" type="date" className="input-field" />
        </div>

        <button type="submit" disabled={loading} className="w-full btn-primary flex items-center justify-center gap-2 py-4">
          <Send className="w-5 h-5" /> {loading ? "Submitting..." : "Submit Event Request"}
        </button>
      </form>
    </div>
  );
}
