"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../config/supabase");
const db_1 = require("../core/database/db");
const circuit_grader_1 = require("../services/circuit-grader");
const router = (0, express_1.Router)();
// Middleware to verify Supabase Auth
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'Missing Authorization header' });
        return;
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase_1.supabase.auth.getUser(token);
    if (error || !user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    // @ts-ignore - store user for downstream routes
    req.user = user;
    next();
}
router.post('/grade', requireAuth, async (req, res) => {
    try {
        // @ts-ignore
        const user = req.user;
        const { sessionId } = req.body;
        if (!sessionId) {
            res.status(400).json({ error: 'sessionId is required' });
            return;
        }
        const session = await db_1.db.circuitSessions.findById(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        if (session.host_id !== user.id) {
            res.status(403).json({ error: 'Only the host can trigger grading' });
            return;
        }
        const ungradedRows = await db_1.db.circuitSandbox.findMany({
            where: { session_id: sessionId, graded: false },
        });
        if (ungradedRows.length === 0) {
            res.json({
                success: true,
                message: 'No ungraded submissions found',
                gradedCount: 0,
            });
            return;
        }
        const results = [];
        for (const submission of ungradedRows) {
            const gradingResult = await (0, circuit_grader_1.gradeCircuitSubmission)(submission.screenshot_url, session.question_text, session.reference_answer, session.reference_image_url);
            await db_1.db.circuitSandbox.update(submission.id, {
                ai_score: gradingResult.score,
                ai_feedback: gradingResult.feedback,
                graded: true,
            });
            await supabase_1.supabase.from('circuit_results').upsert({
                event_id: session.event_id,
                user_id: submission.user_id,
                session_id: sessionId,
                question_text: session.question_text,
                ai_score: gradingResult.score,
                ai_feedback: gradingResult.feedback,
            }, { onConflict: 'session_id,user_id' });
            results.push({
                userId: submission.user_id,
                score: gradingResult.score,
                feedback: gradingResult.feedback,
            });
        }
        res.json({
            success: true,
            gradedCount: results.length,
            results,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Circuit Grade Error:', message);
        res.status(500).json({ error: message });
    }
});
exports.default = router;
