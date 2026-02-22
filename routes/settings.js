// ── settings.js ─────────────────────────────────────────────
const sRouter = require('express').Router();
const db      = require('../config/db');

sRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT `key`, `value` FROM settings');
    const obj = {};
    rows.forEach(r => obj[r.key] = r.value);
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

sRouter.put('/', async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await db.query('INSERT INTO settings (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=?', [key, value, value]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = sRouter;

// ── scanner.js — product lookup by barcode/SKU ──────────────
// (AI vision is called directly from frontend to Anthropic API)
