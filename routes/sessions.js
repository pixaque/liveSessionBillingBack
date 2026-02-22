const router = require('express').Router();
const db     = require('../config/db');

router.get('/', async (_req, res) => {
  try {
    const [sessions] = await db.query(
      `SELECT s.*,
         COUNT(DISTINCT o.id)          AS order_count,
         COALESCE(SUM(o.total),0)      AS revenue,
         SUM(o.status='pending')       AS pending_count
       FROM sessions s
       LEFT JOIN orders o ON o.session_id = s.id
       GROUP BY s.id
       ORDER BY s.created_at DESC`
    );
    res.json(sessions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [[session]] = await db.query('SELECT * FROM sessions WHERE id=?', [req.params.id]);
    if (!session) return res.status(404).json({ error: 'Not found' });
    const [orders] = await db.query(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address, c.fb_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.session_id = ?
       ORDER BY o.created_at DESC`,
      [req.params.id]
    );
    for (const o of orders) {
      const [items] = await db.query('SELECT * FROM order_items WHERE order_id=?', [o.id]);
      o.items = items;
    }
    session.orders = orders;
    res.json(session);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, session_date, fb_url, notes, status } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const [result] = await db.query(
      'INSERT INTO sessions (name,session_date,fb_url,notes,status) VALUES (?,?,?,?,?)',
      [name, session_date || new Date().toISOString().split('T')[0], fb_url||'', notes||'', status||'active']
    );
    const [[created]] = await db.query('SELECT * FROM sessions WHERE id=?', [result.insertId]);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, session_date, fb_url, notes, status } = req.body;
    await db.query(
      'UPDATE sessions SET name=?,session_date=?,fb_url=?,notes=?,status=? WHERE id=?',
      [name, session_date, fb_url||'', notes||'', status||'active', req.params.id]
    );
    const [[updated]] = await db.query('SELECT * FROM sessions WHERE id=?', [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM sessions WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
