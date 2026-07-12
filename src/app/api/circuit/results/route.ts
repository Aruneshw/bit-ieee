import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

const JWT_SECRET = process.env.QUIZ_JWT_SECRET || "bit-ieee-quiz-secret-2026";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    let userId: string | null = null;

    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as { userId: string };
        userId = decoded.userId;
      } catch { /* try supabase */ }
    }

    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await db.circuitSessions.findById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isHost = session.host_id === userId;

    const submissions = await db.query<(RowDataPacket & {
      id: string; user_id: string; screenshot_url: string;
      ai_score: number; ai_feedback: string | null;
      graded: boolean; submitted_at: string;
      user_name: string | null; user_email: string | null;
    })[]>(
      `SELECT cs.*, u.name AS user_name, u.email AS user_email
       FROM circuit_sandbox cs
       LEFT JOIN users u ON cs.user_id = u.id
       WHERE cs.session_id = ?
       ORDER BY cs.ai_score DESC`,
      [sessionId]
    );

    const filtered = isHost ? submissions : submissions.filter(s => s.user_id === userId);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id, questionText: session.question_text,
        tinkercadUrl: session.tinkercad_url, active: session.active,
        expiresAt: session.expires_at,
      },
      results: filtered.map(s => ({
        id: s.id, userId: s.user_id, userName: s.user_name || "Unknown",
        userEmail: s.user_email || "", screenshotUrl: s.screenshot_url,
        aiScore: s.ai_score, aiFeedback: s.ai_feedback,
        graded: s.graded, submittedAt: s.submitted_at,
      })),
      totalSubmissions: submissions.length,
      gradedCount: submissions.filter(s => s.graded).length,
      isHost,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Circuit Results Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
