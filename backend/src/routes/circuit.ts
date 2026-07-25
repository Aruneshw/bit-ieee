import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { db } from '../core/database/db';
import { gradeCircuitSubmission } from '../services/circuit-grader';

const router = Router();

// Middleware to verify Supabase Auth
async function requireAuth(req: Request, res: Response, next: Function): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  // @ts-ignore - store user for downstream routes
  req.user = user;
  next();
}

router.post('/grade', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    // @ts-ignore
    const user = req.user;
    const { sessionId } = req.body;
    
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const session = await db.circuitSessions.findById(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    if (session.host_id !== user.id) {
      res.status(403).json({ error: 'Only the host can trigger grading' });
      return;
    }

    const ungradedRows = await db.circuitSandbox.findMany({
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
      const gradingResult = await gradeCircuitSubmission(
        submission.screenshot_url,
        session.question_text,
        session.reference_answer,
        session.reference_image_url
      );

      await db.circuitSandbox.update(submission.id, {
        ai_score: gradingResult.score,
        ai_feedback: gradingResult.feedback,
        graded: true,
      });

      await supabase.from('circuit_results').upsert(
        {
          event_id: session.event_id,
          user_id: submission.user_id,
          session_id: sessionId,
          question_text: session.question_text,
          ai_score: gradingResult.score,
          ai_feedback: gradingResult.feedback,
        },
        { onConflict: 'session_id,user_id' }
      );

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Circuit Grade Error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
