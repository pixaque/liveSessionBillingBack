const router = require('express').Router();
const db     = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR fb_name LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    sql += ' ORDER BY name ASC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await db.query('SELECT * FROM customers WHERE id=?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer order history
router.get('/:id/orders', async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, s.name AS session_name
       FROM orders o
       LEFT JOIN sessions s ON s.id = o.session_id
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC`,
      [req.params.id]
    );
    for (const o of orders) {
      const [items] = await db.query('SELECT * FROM order_items WHERE order_id=?', [o.id]);
      o.items = items;
    }
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, fb_name, address, city, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
    const [result] = await db.query(
      'INSERT INTO customers (name,phone,email,fb_name,address,city,notes) VALUES (?,?,?,?,?,?,?)',
      [name, phone, email||'', fb_name||'', address||'', city||'', notes||'']
    );
    const [[created]] = await db.query('SELECT * FROM customers WHERE id=?', [result.insertId]);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, fb_name, address, city, notes } = req.body;
    await db.query(
      'UPDATE customers SET name=?,phone=?,email=?,fb_name=?,address=?,city=?,notes=? WHERE id=?',
      [name, phone, email||'', fb_name||'', address||'', city||'', notes||'', req.params.id]
    );
    const [[updated]] = await db.query('SELECT * FROM customers WHERE id=?', [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM customers WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
