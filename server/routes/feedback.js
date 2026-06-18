const express = require('express');
const router = express.Router();

// GET /api/feedback/:uid — get feedback for user
router.get('/:uid', (req, res) => {
  res.json({ uid: req.params.uid, feedback: [] });
});

// POST /api/feedback — submit feedback
router.post('/', (req, res) => {
  const { targetUid, fromUid, anonymous, type, category, rating, text } = req.body;
  if (!targetUid || !text) return res.status(400).json({ error: 'targetUid and text are required' });
  res.json({ id: Date.now().toString(), targetUid, fromUid: anonymous ? null : fromUid, type, category, rating, text, date: new Date().toISOString() });
});

module.exports = router;
