"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const crypto_1 = require("crypto");
const os_1 = require("os");
const router = (0, express_1.Router)();
const rateLimiter = new Map();
function checkRateLimit(ip) {
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
function getBoardFQBN(board) {
    switch (board) {
        case 'mega':
            return 'arduino:avr:mega:cpu=atmega2560';
        case 'uno':
        default:
            return 'arduino:avr:uno';
    }
}
function execAsync(command, timeout = 30_000) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(command, { timeout }, (error, stdout, stderr) => {
            if (error && !stderr) {
                reject(error);
            }
            else {
                resolve({ stdout: stdout || '', stderr: stderr || '' });
            }
        });
    });
}
router.post('/compile', async (req, res) => {
    try {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
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
        const buildId = (0, crypto_1.randomUUID)();
        const tempDir = (0, path_1.join)((0, os_1.tmpdir)(), `arduino-compile-${buildId}`);
        const sketchDir = (0, path_1.join)(tempDir, 'sketch');
        const outputDir = (0, path_1.join)(tempDir, 'output');
        try {
            await (0, promises_1.mkdir)(sketchDir, { recursive: true });
            await (0, promises_1.mkdir)(outputDir, { recursive: true });
            const sketchPath = (0, path_1.join)(sketchDir, 'sketch.ino');
            await (0, promises_1.writeFile)(sketchPath, code, 'utf-8');
            const fqbn = getBoardFQBN(board);
            const compileCmd = `arduino-cli compile --fqbn ${fqbn} --output-dir "${outputDir}" "${sketchDir}"`;
            const { stdout, stderr } = await execAsync(compileCmd);
            const hexPath = (0, path_1.join)(outputDir, 'sketch.ino.hex');
            let hex;
            try {
                hex = await (0, promises_1.readFile)(hexPath, 'utf-8');
            }
            catch {
                const altHexPath = (0, path_1.join)(outputDir, 'sketch.ino.with_bootloader.hex');
                try {
                    hex = await (0, promises_1.readFile)(altHexPath, 'utf-8');
                }
                catch {
                    res.json({
                        success: false,
                        output: stdout + '\n' + stderr,
                        errors: ['Compilation succeeded but HEX file not found'],
                    });
                    return;
                }
            }
            const errors = [];
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
        }
        finally {
            try {
                await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
            }
            catch {
                // Best effort cleanup
            }
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('not found') || message.includes('ENOENT') || message.includes('command not found')) {
            res.json({
                success: false,
                output: 'arduino-cli is not installed on this server.\n\n' +
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
exports.default = router;
