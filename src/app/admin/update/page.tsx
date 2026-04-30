"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { Upload, Bell } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function UpdatePage() {
  const [activeTab, setActiveTab] = useState("points");

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-4xl font-heading tracking-wide mb-2">Update Center</h1>
        <p className="text-gray-400">Bulk update activity points and broadcast announcements.</p>
      </div>

      <div className="flex space-x-2 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab("points")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "points" ? "bg-[#00629B] text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
        >
          Activity Points (Bulk)
        </button>
        <button
          onClick={() => setActiveTab("announcements")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "announcements" ? "bg-[#00629B] text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
        >
          Announcements
        </button>
      </div>

      <div className="mt-6 glass-card p-6 max-w-3xl">
        {activeTab === "points" && <ActivityPointsForm />}
        {activeTab === "announcements" && <AnnouncementForm />}
      </div>
    </div>
  );
}

function ActivityPointsForm() {
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      let updated = 0;
      let errors = 0;
      for (const row of rows) {
        const eventName = row["Event Name"] || row["event_name"] || "";
        const organiserEmail = row["Organiser Email"] || row["Email"] || row["email"] || "";
        const points = parseInt(row["Activity Points"] || row["Points"] || "0");
        const organisedBy = row["Organised By"] || row["organised_by"] || "";
        const date = row["Date"] || row["date"] || null;

        if (!eventName || !points) { errors++; continue; }

        // Find the event by name and organiser email
        const { data: event } = await supabase
          .from("events")
          .select("id, name")
          .ilike("name", eventName)
          .limit(1)
          .single();

        if (!event) { errors++; continue; }

        // Get all attendees (bookings) for this event
        const { data: bookings } = await supabase
          .from("event_bookings")
          .select("user_id")
          .eq("event_id", event.id);

        if (!bookings || bookings.length === 0) { errors++; continue; }

        // Award points to each attendee
        const dateStr = date ? new Date(date).toISOString() : new Date().toISOString();
        for (const booking of bookings) {
          await supabase.from("activity_points").insert({
            user_id: booking.user_id,
            event_id: event.id,
            points,
            event_name: event.name,
            organised_by: organisedBy,
            organiser_email: organiserEmail,
            date: dateStr,
          });
          updated++;
        }
      }

      toast.success(`Activity points allocated to ${updated} attendees across ${rows.length} events`);
      if (errors > 0) toast.warning(`${errors} rows had errors (event not found or no attendees)`);
      setFile(null);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const points = parseInt(fd.get("points") as string);

    const { data: user } = await supabase.from("users").select("id").eq("email", email).single();
    if (!user) { toast.error("User not found"); return; }

    const { error } = await supabase.from("activity_points").insert({
      user_id: user.id,
      points,
      event_name: fd.get("event_name"),
      organised_by: fd.get("organised_by"),
      date: new Date().toISOString(),
    });

    if (error) { toast.error(error.message); return; }
    toast.success("Points allocated successfully");
    (e.target as HTMLFormElement).reset();
  }

  return (
    <div className="space-y-5">
      <h3 className="text-xl font-medium mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5 text-[#00bfff]" /> Bulk Allocate Points
      </h3>
      <p className="text-sm text-gray-400">
        Upload an Excel file with columns: <span className="text-white">Event Name, Organised By, Organiser Email, Date, Points</span>
      </p>

      <label className="block border-2 border-dashed border-white/15 rounded-xl p-8 text-center hover:bg-white/[0.02] transition-colors cursor-pointer">
        <Upload className="w-8 h-8 mx-auto text-gray-500 mb-3" />
        <p className="text-sm text-gray-300">{file ? file.name : "Click to upload"}</p>
        <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>

      <div className="flex justify-between items-center">
        <button onClick={() => setShowManual(!showManual)} className="text-sm text-[#00bfff] hover:underline">
          {showManual ? "Hide manual form" : "Single-person manual update"}
        </button>
        <button onClick={handleUpload} disabled={loading || !file} className="btn-primary">
          {loading ? "Processing..." : "Process Upload"}
        </button>
      </div>

      {showManual && (
        <form onSubmit={handleManualSubmit} className="space-y-4 border-t border-white/10 pt-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">User Email *</label>
              <input name="email" required className="input-field" placeholder="user@bitsathy.ac.in" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Points *</label>
              <input name="points" type="number" required className="input-field" placeholder="10" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Event Name</label>
              <input name="event_name" className="input-field" placeholder="Event name" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Organised By</label>
              <input name="organised_by" className="input-field" placeholder="Organiser name" />
            </div>
          </div>
          <button type="submit" className="btn-secondary text-sm">Allocate Points</button>
        </form>
      )}
    </div>
  );
}

function AnnouncementForm() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const title = fd.get("title") as string;
    const content = fd.get("content") as string;
    const mediaUrl = fd.get("media_url") as string;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Send as notification
      await supabase.from("notifications").insert({
        title,
        message: content,
        type: "announcement",
        sent_by: user?.id,
        recipient_role: "all",
      });

      // 2. Also post to the Global Feed (society_id = NULL)
      const { error: postError } = await supabase.from("posts").insert({
        content: `[Announcement: ${title}]\n\n${content}`,
        media_url: mediaUrl || null,
        author_id: user?.id,
        society_id: null, // Global post
      });

      if (postError) {
        console.error("Post error:", postError);
        // We don't throw here so the notification still goes through, 
        // but we warn the user if the migration hasn't been run yet.
        toast.warning("Notification sent, but failed to post to feed. Ensure you have run the SQL migration.");
      } else {
        toast.success("Announcement broadcasted and posted to feed!");
      }
      
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to broadcast");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h3 className="text-xl font-medium mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-[#00bfff]" /> Global Announcement</h3>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Title *</label>
        <input name="title" required className="input-field" placeholder="e.g. Upcoming Hackathon" />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Message *</label>
        <textarea name="content" required rows={4} className="input-field resize-none" placeholder="Type your announcement..." />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Media URL (Optional)</label>
        <input name="media_url" className="input-field" placeholder="https://example.com/image.jpg" />
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Broadcasting..." : "Send Announcement"}
      </button>
    </form>
  );
}

