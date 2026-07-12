import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { gradeCircuitSubmission } from "@/lib/circuit-grader";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

/**
 * POST /api/circuit/grade
 *
 * Host triggers AI grading for all ungraded submissions in a session.
 * Body: { sessionId }
 *
 * 1. Iterates ungraded circuit_sandbox rows
 * 2. Sends each screenshot to Gemini Vision for grading
 * 3. Updates sandbox rows with score + feedback
 * 4. Saves permanent results to Supabase
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

    // Verify session exists and caller is the host
    const session = await db.circuitSessions.findById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.host_id !== user.id) {
      return NextResponse.json({ error: "Only the host can trigger grading" }, { status: 403 });
    }

    // Fetch all ungraded submissions
    const ungradedRows = await db.circuitSandbox.findMany({
      where: { session_id: sessionId, graded: false },
    });

    if (ungradedRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No ungraded submissions found",
        gradedCount: 0,
      });
    }

    const results: Array<{
      userId: string;
      score: number;
      feedback: string;
    }> = [];

    // Grade each submission
    for (const submission of ungradedRows) {
      const gradingResult = await gradeCircuitSubmission(
        submission.screenshot_url,
        session.question_text,
        session.reference_answer,
        session.reference_image_url
      );

      // Update sandbox row in TiDB
      await db.circuitSandbox.update(submission.id, {
        ai_score: gradingResult.score,
        ai_feedback: gradingResult.feedback,
        graded: true,
      });

      // Save permanent result to Supabase
      // Using upsert to handle re-grading
      await supabase.from("circuit_results").upsert(
        {
          event_id: session.event_id,
          user_id: submission.user_id,
          session_id: sessionId,
          question_text: session.question_text,
          ai_score: gradingResult.score,
          ai_feedback: gradingResult.feedback,
        },
        { onConflict: "session_id,user_id" }
      );

      results.push({
        userId: submission.user_id,
        score: gradingResult.score,
        feedback: gradingResult.feedback,
      });
    }

    return NextResponse.json({
      success: true,
      gradedCount: results.length,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Circuit Grade Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
