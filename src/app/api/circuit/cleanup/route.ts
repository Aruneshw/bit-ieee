import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/circuit/cleanup
 * Host ends session → purges sandbox data from TiDB + Supabase Storage.
 * Final scores remain in Supabase circuit_results.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const session = await db.circuitSessions.findById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.host_id !== user.id) {
      return NextResponse.json({ error: "Only the host can end the session" }, { status: 403 });
    }

    // 1. Delete sandbox screenshots from Supabase Storage
    const { data: files } = await supabase.storage
      .from("circuit-sandbox")
      .list(`circuit-sandbox/${sessionId}`);

    if (files && files.length > 0) {
      const paths = files.map(f => `circuit-sandbox/${sessionId}/${f.name}`);
      await supabase.storage.from("circuit-sandbox").remove(paths);
    }

    // 2. Delete sandbox rows from TiDB
    const sandboxRows = await db.circuitSandbox.findMany({
      where: { session_id: sessionId },
    });
    for (const row of sandboxRows) {
      await db.circuitSandbox.delete(row.id);
    }

    // 3. Deactivate session
    await db.circuitSessions.update(sessionId, { active: false });

    return NextResponse.json({
      success: true,
      message: "Session ended. Sandbox data purged. Final results preserved in Supabase.",
      deletedSubmissions: sandboxRows.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Circuit Cleanup Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
