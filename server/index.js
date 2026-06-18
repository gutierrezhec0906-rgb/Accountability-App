const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/scores', require('./routes/scores'));
app.use('/api/feedback', require('./routes/feedback'));

app.listen(PORT, () => {
  console.log(`Accountability App server running on port ${PORT}`);
});
