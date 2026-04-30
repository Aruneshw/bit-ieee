"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminEventDetailEditor } from "@/components/admin/event-detail-editor";
import { Loader2 } from "lucide-react";

export default function AdminEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("events")
        .select("*, organiser:users(id, full_name, name, roll_number, department)")
        .eq("id", id)
        .single();
      setEvent(data || null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent-primary)" }} />
      </div>
    );
  }

  if (!event) {
    return <div className="glass-card p-6">Event not found.</div>;
  }

  return <AdminEventDetailEditor eventId={id} initialEvent={event} />;
}

