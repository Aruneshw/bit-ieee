import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";


const JWT_SECRET = process.env.QUIZ_JWT_SECRET || "bit-ieee-quiz-secret-2026";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const { taskId, hostId } = decoded;

    const supabase = await createClient();


    // 2. Fetch questions for this task

    // We enforce hostId isolation in the query for extra safety
    const { data: task, error } = await supabase
      .from("tasks")
      .select("id, type, questions, event:events(name)")
      .eq("id", taskId)
      .eq("created_by", hostId)
      .single();

    if (error || !task) {
      return NextResponse.json({ error: "Task not found or unauthorized access" }, { status: 404 });
    }

    const event = Array.isArray(task.event) ? task.event[0] : task.event;

    return NextResponse.json({
      success: true,
      questions: task.questions,
      type: task.type,
      eventName: (event as any)?.name || "Unknown Event"
    });


  } catch (error: any) {
    console.error("Quiz Questions Error:", error);
    return NextResponse.json({ error: "Invalid session token" }, { status: 403 });
  }
}
