"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server action to approve or reject an event with server-side security.
 */
export async function updateEventStatus(eventId: string, status: "approved" | "rejected", notes?: string) {
  const supabase = await createClient();

  // 1. Verify Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "Unauthorized: Please login." };
  }

  // 2. Verify Admin Role on Server
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin_primary") {
    return { success: false, error: "Forbidden: You do not have permission to perform this action." };
  }

  // 3. Perform Action
  const { error: updateError } = await supabase
    .from("events")
    .update({ 
      status, 
      admin_notes: notes || null,
      updated_at: new Date().toISOString() 
    })
    .eq("id", eventId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // 4. Revalidate cache
  revalidatePath("/admin/event-requests");
  revalidatePath(`/admin/event-requests/${eventId}`);
  revalidatePath("/admin/dashboard");

  return { success: true };
}
