import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function approveEvent() {
  const { data, error } = await supabase
    .from("events")
    .update({ status: "approved" })
    .eq("id", "39dad1e8-705e-4bf5-913f-003c6ec51bc2")
    .select();

  if (error) {
    console.error("Error updating event:", error);
    return;
  }
  console.log("Event approved:", data);
}

approveEvent();
