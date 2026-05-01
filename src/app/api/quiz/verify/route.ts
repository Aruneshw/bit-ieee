import { createClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

// In production, always use a real secret from process.env
const JWT_SECRET = process.env.QUIZ_JWT_SECRET || "bit-ieee-quiz-secret-2026";

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } }
  );

  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and OTP are required" }, { status: 400 });
    }

    // 1. Lookup attendee by email
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, name")
      .eq("email", email.toLowerCase())
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // 2. Fetch active quiz sessions for events this user is booked for
    // This is the isolation gate: The session must belong to an event the user has booked.
    const { data: sessions, error: sessErr } = await supabase
      .from("quiz_sessions")
      .select("*, event:events(name)")
      .eq("active", true)
      .gt("expires_at", new Date().toISOString());

    if (sessErr || !sessions || sessions.length === 0) {
      return NextResponse.json({ error: "No active quiz sessions found" }, { status: 404 });
    }

    // Find the session that belongs to a booking for this user
    let validSession = null;
    for (const session of sessions) {
      const { data: booking } = await supabase
        .from("event_bookings")
        .select("id")
        .eq("event_id", session.event_id)
        .eq("user_id", user.id)
        .single();

      if (booking) {
        // 3. Verify OTP Hash
        const match = await bcrypt.compare(otp, session.otp_hash);
        if (match) {
          validSession = session;
          break;
        }
      }
    }

    if (!validSession) {
      return NextResponse.json({ error: "Invalid OTP or not booked for this session" }, { status: 401 });
    }

    // 4. Generate Quiz JWT
    const token = jwt.sign(
      {
        userId: user.id,
        hostId: validSession.host_id,
        taskId: validSession.task_id,
        eventId: validSession.event_id,
        sessionId: validSession.id,
        userName: user.name
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return NextResponse.json({
      success: true,
      token,
      event: validSession.event,
      user: { name: user.name }
    });

  } catch (error: any) {
    console.error("Quiz Verify Error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
