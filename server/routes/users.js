const express = require('express');
const router = express.Router();

// GET /api/users/:uid — fetch user profile
router.get('/:uid', async (req, res) => {
  try {
    // Firebase Admin SDK would query Firestore here
    res.json({ uid: req.params.uid, message: 'Configure Firebase Admin SDK to enable server-side queries' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users — list users (admin only)
router.get('/', async (req, res) => {
  res.json({ users: [], message: 'Requires Firebase Admin SDK configuration' });
});

module.exports = router;
