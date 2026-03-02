import { Router } from 'express';

import { requireAuth } from '../auth.js';

const router = Router();

router.post('/v1/uploads/sign', requireAuth, async (req, res) => {
  const { bucket, objectPath, contentType } = req.body ?? {};

  if (!bucket || !objectPath || !contentType) {
    return res.status(400).json({
      error: 'Missing fields',
      required: ['bucket', 'objectPath', 'contentType']
    });
  }

  return res.status(501).json({
    error: 'Not implemented',
    message: 'Signed upload URL orchestration will be added when BFF upload signing is enabled.',
    received: { bucket, objectPath, contentType, userId: req.auth.userId }
  });
});

export default router;

