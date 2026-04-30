import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, status, event_date, start_time, end_time, is_ieee_official");

  if (error) {
    console.error("Error fetching events:", error);
    return;
  }
  console.log(`Found ${data.length} total events:`);
  console.log(data);
}

checkEvents();
