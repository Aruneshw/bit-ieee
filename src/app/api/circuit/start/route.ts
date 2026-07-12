import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/circuit/start
 *
 * Host creates a circuit challenge session.
 * Body: { eventId, tinkercadUrl, questionText, referenceAnswer?, referenceImageUrl? }
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { eventId, tinkercadUrl, questionText, referenceAnswer, referenceImageUrl } = body;

    if (!eventId || !tinkercadUrl || !questionText) {
      return NextResponse.json(
        { error: "eventId, tinkercadUrl, and questionText are required" },
        { status: 400 }
      );
    }

    // Validate TinkerCAD URL
    if (!tinkercadUrl.includes("tinkercad.com")) {
      return NextResponse.json(
        { error: "Invalid TinkerCAD URL" },
        { status: 400 }
      );
    }

    // Verify host owns this event
    const event = await db.events.findOne({ id: eventId, organiser_id: user.id });
    if (!event) {
      return NextResponse.json(
        { error: "Event not found or you are not the organizer" },
        { status: 404 }
      );
    }

    // Fetch or create task for this event
    let task = await db.tasks.findOne({ event_id: eventId });
    if (!task) {
      task = await db.tasks.create({
        id: randomUUID(),
        event_id: eventId,
        type: "general",
        status: "draft",
        created_by: user.id,
      });
    }

    // Deactivate any existing circuit sessions for this event
    const existingSessions = await db.circuitSessions.findMany({
      where: { event_id: eventId, active: true },
    });
    for (const sess of existingSessions) {
      await db.circuitSessions.update(sess.id, { active: false });
    }

    // Create new circuit session — expires in 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const session = await db.circuitSessions.create({
      id: randomUUID(),
      task_id: task.id,
      event_id: eventId,
      host_id: user.id,
      tinkercad_url: tinkercadUrl,
      question_text: questionText,
      reference_answer: referenceAnswer || null,
      reference_image_url: referenceImageUrl || null,
      active: true,
      expires_at: expiresAt,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      expiresAt,
      eventName: event.name,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Circuit Start Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
