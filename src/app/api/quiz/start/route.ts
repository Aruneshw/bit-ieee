import { createClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } }
  );

  try {
    const { eventId } = await request.json();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Fetch event and host details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*, organiser:users(name, email)")
      .eq("id", eventId)
      .eq("organiser_id", user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found or not owned by you" }, { status: 404 });
    }

    // 2. Fetch or create task for this event
    let { data: task } = await supabase.from("tasks").select("id").eq("event_id", eventId).single();
    if (!task) {
      const { data: newTask, error: taskErr } = await supabase.from("tasks").insert({
        event_id: eventId,
        type: "mcq",
        created_by: user.id
      }).select().single();
      if (taskErr) throw taskErr;
      task = newTask;
    }

    // 3. Generate and Hash OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // 4. Deactivate old sessions and start new one
    await supabase.from("quiz_sessions").update({ active: false }).eq("event_id", eventId);
    const { data: session, error: sessErr } = await supabase.from("quiz_sessions").insert({
      task_id: task.id,
      host_id: user.id,
      event_id: eventId,
      otp_hash: otpHash,
      active: true,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 mins
    }).select().single();

    if (sessErr) throw sessErr;

    // 5. Fetch booked students
    const { data: bookings } = await supabase
      .from("event_bookings")
      .select("user:users(name, email)")
      .eq("event_id", eventId);

    const attendees = (bookings || []).map(b => b.user).filter(u => u?.email);

    // 6. Bulk Send OTP via Nodemailer
    if (attendees.length > 0) {
      // For large counts, we should use a queue, but for 50-100 students, a Promise.all is okay
      // but sequential or chunked is safer for SMTP limits.
      const sendPromises = attendees.map(student => 
        transporter.sendMail({
          from: `"IEEE BIT Hub" <${process.env.SMTP_USER}>`,
          to: student.email,
          subject: `Quiz Starting Now — ${event.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a192f; color: #ffffff; padding: 30px; border-radius: 12px;">
              <h2 style="color: #00bfff;">Your Quiz OTP</h2>
              <p>Hi ${student.name}, the quiz for <strong>"${event.name}"</strong> is starting now!</p>
              <div style="background: #ffffff10; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #64ffda;">${otp}</span>
              </div>
              <p style="font-size: 14px; color: #8892b0;">
                Valid for 15 minutes.<br/>
                Hosted by: ${event.organiser?.name}<br/>
                Venue: ${event.venue || 'TBA'}
              </p>
            </div>
          `
        })
      );
      
      // Wait for all emails (sequential for SMTP stability)
      for (const promise of sendPromises) {
        await promise.catch(e => console.error("Email failed:", e));
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      otp: otp, // Return raw OTP to host for display
      studentCount: attendees.length,
      expiresAt: session.expires_at
    });


  } catch (error: any) {
    console.error("Quiz Start Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
