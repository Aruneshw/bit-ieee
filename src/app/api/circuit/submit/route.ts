import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const JWT_SECRET = process.env.QUIZ_JWT_SECRET || "bit-ieee-quiz-secret-2026";

/**
 * POST /api/circuit/submit
 *
 * Student uploads a circuit screenshot.
 * Expects multipart/form-data with a "screenshot" file field,
 * OR JSON with { sessionId, screenshotBase64, fileName }.
 *
 * Auth: Quiz JWT in Authorization header OR Supabase session.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    // --- Authenticate student ---
    let userId: string | null = null;

    // Try Quiz JWT first
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        userId = decoded.userId;
      } catch {
        // JWT invalid, try Supabase auth below
      }
    }

    // Fallback to Supabase session
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- Parse the request ---
    const contentType = request.headers.get("content-type") || "";
    let sessionId: string;
    let fileBuffer: Buffer;
    let fileName: string;

    if (contentType.includes("multipart/form-data")) {
      // Handle form data upload
      const formData = await request.formData();
      sessionId = formData.get("sessionId") as string;
      const file = formData.get("screenshot") as File;

      if (!sessionId || !file) {
        return NextResponse.json(
          { error: "sessionId and screenshot file are required" },
          { status: 400 }
        );
      }

      const arrayBuf = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
      fileName = file.name || "screenshot.png";
    } else {
      // Handle JSON with base64
      const body = await request.json();
      sessionId = body.sessionId;
      const base64Data = body.screenshotBase64;
      fileName = body.fileName || "screenshot.png";

      if (!sessionId || !base64Data) {
        return NextResponse.json(
          { error: "sessionId and screenshotBase64 are required" },
          { status: 400 }
        );
      }

      // Strip data URL prefix if present
      const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
      fileBuffer = Buffer.from(base64Clean, "base64");
    }

    // --- Validate session ---
    const session = await db.circuitSessions.findById(sessionId);
    if (!session || !session.active) {
      return NextResponse.json(
        { error: "Circuit session not found or has ended" },
        { status: 404 }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Circuit session has expired" },
        { status: 410 }
      );
    }

    // --- Upload screenshot to Supabase Storage ---
    const storagePath = `circuit-sandbox/${sessionId}/${userId}_${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("circuit-sandbox")
      .upload(storagePath, fileBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      // Try creating the bucket if it doesn't exist
      if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
        await supabase.storage.createBucket("circuit-sandbox", {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024, // 5MB
        });

        // Retry upload
        const { error: retryError } = await supabase.storage
          .from("circuit-sandbox")
          .upload(storagePath, fileBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (retryError) {
          console.error("Storage retry failed:", retryError);
          return NextResponse.json(
            { error: "Failed to upload screenshot" },
            { status: 500 }
          );
        }
      } else {
        console.error("Storage upload error:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload screenshot" },
          { status: 500 }
        );
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("circuit-sandbox")
      .getPublicUrl(storagePath);

    const screenshotUrl = urlData.publicUrl;

    // --- Upsert sandbox entry in TiDB ---
    // Check if already submitted
    const existing = await db.circuitSandbox.findOne({
      session_id: sessionId,
      user_id: userId,
    });

    if (existing) {
      // Update with new screenshot
      await db.circuitSandbox.update(existing.id, {
        screenshot_url: screenshotUrl,
        graded: false,
        ai_score: 0,
        ai_feedback: null,
      });
    } else {
      await db.circuitSandbox.create({
        id: randomUUID(),
        session_id: sessionId,
        user_id: userId,
        screenshot_url: screenshotUrl,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Screenshot uploaded successfully!",
      screenshotUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Circuit Submit Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
