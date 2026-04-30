"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { Bell, Send } from "lucide-react";
import { toast } from "sonner";

export default function RepNotificationsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Not authenticated");

      const { data: profile } = await supabase.from("users").select("society_id").eq("email", user.email.toLowerCase()).single();

      const { error } = await supabase.from("notifications").insert({
        title: fd.get("title"),
        message: fd.get("message"),
        type: "info",
        society_id: profile?.society_id,
        sent_by: user?.id,
      });

      if (error) throw error;
      toast.success("Notification sent to all society members!");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-2xl">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Send Notification</h1>
        <p className="text-gray-400">Push notifications to all members in your society.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2 text-[#00bfff] bg-[#00bfff]/10 border border-[#00bfff]/20 rounded-lg px-4 py-3">
          <Bell className="w-5 h-5 shrink-0" />
          <p className="text-sm">This notification will be sent to all members of your society.</p>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Title *</label>
          <input name="title" required className="input-field" placeholder="Notification title" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Message *</label>
          <textarea name="message" required rows={4} className="input-field resize-none" placeholder="Write your message..." />
        </div>
        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
          <Send className="w-4 h-4" /> {loading ? "Sending..." : "Send Notification"}
        </button>
      </form>
    </div>
  );
}
