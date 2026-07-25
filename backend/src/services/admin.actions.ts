import { supabase } from '../config/supabase';

/**
 * Service function to approve or reject an event.
 */
export async function updateEventStatus(eventId: string, status: "approved" | "rejected", notes?: string, userId?: string) {
  // If userId is provided, we can optionally verify admin role here
  // For now, assume authentication is handled by the router/middleware
  
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

  return { success: true };
}
