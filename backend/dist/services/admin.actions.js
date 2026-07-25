"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEventStatus = updateEventStatus;
const supabase_1 = require("../config/supabase");
/**
 * Service function to approve or reject an event.
 */
async function updateEventStatus(eventId, status, notes, userId) {
    // If userId is provided, we can optionally verify admin role here
    // For now, assume authentication is handled by the router/middleware
    const { error: updateError } = await supabase_1.supabase
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
