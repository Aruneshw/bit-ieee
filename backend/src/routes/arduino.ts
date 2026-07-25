import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';

const router = Router();

const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 10) {
    return false;
  }

  entry.count++;
  return true;
}

function getBoardFQBN(board: string): string {
  switch (board) {
    case 'mega':
      return 'arduino:avr:mega:cpu=atmega2560';
    case 'uno':
    default:
      return 'arduino:avr:uno';
  }
}

function execAsync(command: string, timeout = 30_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, { timeout }, (error, stdout, stderr) => {
      if (error && !stderr) {
        reject(error);
      } else {
        resolve({ stdout: stdout || '', stderr: stderr || '' });
      }
    });
  });
}

router.post('/compile', async (req: Request, res: Response): Promise<void> => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({
        success: false,
        output: 'Rate limit exceeded. Maximum 10 compilations per minute.',
        errors: ['Rate limit exceeded'],
      });
      return;
    }

    const { code, board = 'uno' } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({
        success: false,
        output: 'No sketch code provided.',
        errors: ["Missing 'code' field in request body"],
      });
      return;
    }

    if (code.length > 100_000) {
      res.status(400).json({
        success: false,
        output: 'Sketch too large (max 100KB).',
        errors: ['Sketch exceeds maximum size'],
      });
      return;
    }

    const buildId = randomUUID();
    const tempDir = join(tmpdir(), `arduino-compile-${buildId}`);
    const sketchDir = join(tempDir, 'sketch');
    const outputDir = join(tempDir, 'output');

    try {
      await mkdir(sketchDir, { recursive: true });
      await mkdir(outputDir, { recursive: true });

      const sketchPath = join(sketchDir, 'sketch.ino');
      await writeFile(sketchPath, code, 'utf-8');

      const fqbn = getBoardFQBN(board);
      const compileCmd = `arduino-cli compile --fqbn ${fqbn} --output-dir "${outputDir}" "${sketchDir}"`;

      const { stdout, stderr } = await execAsync(compileCmd);

      const hexPath = join(outputDir, 'sketch.ino.hex');
      let hex: string | undefined;

      try {
        hex = await readFile(hexPath, 'utf-8');
      } catch {
        const altHexPath = join(outputDir, 'sketch.ino.with_bootloader.hex');
        try {
          hex = await readFile(altHexPath, 'utf-8');
        } catch {
          res.json({
            success: false,
            output: stdout + '\n' + stderr,
            errors: ['Compilation succeeded but HEX file not found'],
          });
          return;
        }
      }

      const errors: string[] = [];
      const lines = (stdout + '\n' + stderr).split('\n');
      for (const line of lines) {
        if (line.includes('error:') || line.includes('Error')) {
          errors.push(line.trim());
        }
      }

      res.json({
        success: errors.length === 0,
        hex: errors.length === 0 ? hex : undefined,
        output: `${stdout}\n${stderr}`.trim(),
        errors: errors.length > 0 ? errors : undefined,
      });
    } finally {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Best effort cleanup
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('not found') || message.includes('ENOENT') || message.includes('command not found')) {
      res.json({
        success: false,
        output:
          'arduino-cli is not installed on this server.\n\n' +
          'To compile custom sketches, install arduino-cli:\n' +
          '  curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh\n' +
          '  arduino-cli core install arduino:avr\n\n' +
          'In the meantime, you can use the pre-compiled example sketches.',
        errors: ['arduino-cli not available'],
      });
      return;
    }

    res.status(500).json({
      success: false,
      output: `Compilation failed: ${message}`,
      errors: [message],
    });
  }
});

export default router;
