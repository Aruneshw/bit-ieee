import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RoleInFile = "member" | "leadership";

interface IncomingRow {
  full_name: string;
  roll_number: string;
  email: string;
  role: RoleInFile;
  society: string | null;
  phone_number?: string | null;
  department?: string | null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Ensure requester is admin_primary
    const { data: me } = await supabase
      .from("users")
      .select("id, role")
      .eq("email", user.email.toLowerCase())
      .single();

    if (!me || me.role !== "admin_primary") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const rows: IncomingRow[] = body?.rows || [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Missing service role configuration" }, { status: 500 });
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Build society map
    const { data: societies } = await admin.from("societies").select("id, name, abbreviation");
    const societyMap = new Map<string, string>();
    (societies || []).forEach((s: any) => {
      if (s.name) societyMap.set(String(s.name).toLowerCase(), s.id);
      if (s.abbreviation) societyMap.set(String(s.abbreviation).toLowerCase(), s.id);
    });

    const results: Array<{ row: IncomingRow; ok: boolean; reason?: string; action?: string }> = [];

    for (const row of rows) {
      const email = normalizeEmail(row.email);
      const roll = String(row.roll_number || "").trim();
      const fullName = String(row.full_name || "").trim();
      const role = row.role === "leadership" ? "leadership" : "membership";
      const societyId = row.society ? (societyMap.get(String(row.society).toLowerCase()) || null) : null;

      if (!email || !roll || !fullName) {
        results.push({ row, ok: false, reason: "Missing required fields" });
        continue;
      }

      // Skip if email/roll already exists in users table
      const { data: existing } = await admin
        .from("users")
        .select("id, email, roll_number")
        .or(`email.eq.${email},roll_number.eq.${roll}`)
        .maybeSingle();

      if (existing?.id) {
        results.push({ row, ok: false, reason: "Email or roll number already exists", action: "skipped" });
        continue;
      }

      // Create Auth user
      const tempPassword = roll.toLowerCase();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          must_change_password: true,
        },
      });

      if (createErr || !created?.user?.id) {
        results.push({ row, ok: false, reason: createErr?.message || "Auth user creation failed" });
        continue;
      }

      const uid = created.user.id;

      // Insert users row
      const { error: upsertErr } = await admin.from("users").insert({
        id: uid,
        email,
        name: fullName,
        full_name: fullName,
        roll_number: roll,
        role,
        society_id: societyId,
        phone_number: row.phone_number || null,
        mobile: row.phone_number || null,
        department: row.department || null,
        profile_completed: false,
      } as any);

      if (upsertErr) {
        // cleanup auth user to avoid orphan
        await admin.auth.admin.deleteUser(uid);
        results.push({ row, ok: false, reason: upsertErr.message || "Profile insert failed" });
        continue;
      }

      results.push({ row, ok: true, action: "created" });
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok && r.action !== "skipped").length,
      skipped: results.filter((r) => !r.ok && r.action === "skipped").length,
    };

    return NextResponse.json({ ok: true, summary, results });
  } catch (e: any) {
    console.error("bulk-create-users error:", e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

