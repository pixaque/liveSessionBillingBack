require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const db      = require('./config/db');

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    '*'
  ],
  credentials: true
}));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────
app.use('/api/products',  require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/sessions',  require('./routes/sessions'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/dispatch',  require('./routes/dispatch'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/settings',  require('./routes/settings'));
app.use('/api/scanner',   require('./routes/scanner'));

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date() }));

// ── Global error handler ────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`🚀 LiveDrop API running on http://localhost:${PORT}`));
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 LiveDrop API running on port ${PORT}`));
