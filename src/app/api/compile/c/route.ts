import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFileSync, mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

/**
 * POST /api/compile/c
 * Compiles and runs C code safely on the server.
 */
export async function POST(request: NextRequest) {
  let tempDir = "";
  try {
    const { code } = await request.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, output: "No code provided or code is invalid." },
        { status: 400 }
      );
    }

    const buildId = Math.random().toString(36).substring(2, 15);
    tempDir = join(tmpdir(), `c-compile-${buildId}`);
    mkdirSync(tempDir, { recursive: true });

    const sourcePath = join(tempDir, "main.c");
    const outputPath = join(tempDir, "main");

    // Write source code
    writeFileSync(sourcePath, code);

    // Compile code
    let compileOutput = "";
    try {
      const compileCmd = `gcc -O2 -Wall -o "${outputPath}" "${sourcePath}"`;
      const { stderr } = await execAsync(compileCmd, { timeout: 10000 });
      if (stderr) {
        compileOutput = stderr;
      }
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        output: "Compilation Failed",
        errors: err.stderr || err.message || "Unknown compilation error",
      });
    }

    // Run compiled binary safely
    try {
      // Use "timeout" to prevent infinite loops, e.g., timeout 2s
      const runCmd = `timeout 2 "${outputPath}"`;
      const { stdout, stderr } = await execAsync(runCmd, {
        timeout: 3000,
        maxBuffer: 1024 * 1024, // 1MB stdout max limit
      });

      return NextResponse.json({
        success: true,
        output: stdout,
        errors: stderr || "",
      });
    } catch (err: any) {
      if (err.killed || err.signal === "SIGTERM" || err.code === 124) {
        return NextResponse.json({
          success: false,
          output: "Execution Timeout (Infinite Loop Detected)",
          errors: "Your program was terminated because it took longer than 2 seconds to execute.",
        });
      }
      return NextResponse.json({
        success: false,
        output: err.stdout || "",
        errors: err.stderr || err.message || "Execution failed",
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, output: "Server Error", errors: err.message },
      { status: 500 }
    );
  } finally {
    // Clean up temporary files
    if (tempDir && existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error("Failed to clean up temp dir:", cleanupErr);
      }
    }
  }
}
