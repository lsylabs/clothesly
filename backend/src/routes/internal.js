import { Router } from 'express';

import { requireAuth } from '../auth.js';

const router = Router();

router.get('/v1/internal/ping', requireAuth, (req, res) => {
  res.json({
    ok: true,
    userId: req.auth.userId,
    role: req.auth.role ?? 'authenticated',
    timestamp: new Date().toISOString()
  });
});

router.post('/v1/internal/ai/outfit-generate', requireAuth, (_req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    message: 'AI orchestration endpoints are scaffolded and intentionally deferred.'
  });
});

export default router;

