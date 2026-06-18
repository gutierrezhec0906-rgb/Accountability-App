const express = require('express');
const router = express.Router();

// GET /api/scores/:uid — get user scores
router.get('/:uid', (req, res) => {
  res.json({ uid: req.params.uid, scores: {}, message: 'Configure Firebase Admin SDK' });
});

// POST /api/scores/:uid — update scores
router.post('/:uid', (req, res) => {
  const { scores } = req.body;
  res.json({ uid: req.params.uid, scores, updated: true });
});

module.exports = router;
