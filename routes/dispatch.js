// ── dispatch.js ─────────────────────────────────────────────
const router = require('express').Router();
const db     = require('../config/db');

// GET all pending orders grouped by customer (dispatch view)
router.get('/', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const validStatuses = ['pending','processing','dispatched','cancelled','all'];
    const filterStatus = validStatuses.includes(status) ? status : 'pending';

    let sql = `
      SELECT o.*, c.name AS customer_name, c.phone AS customer_phone,
             c.address AS customer_address, c.city AS customer_city, c.fb_name,
             s.name AS session_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN sessions s ON s.id = o.session_id`;
    if (filterStatus !== 'all') sql += ` WHERE o.status = '${filterStatus}'`;
    sql += ' ORDER BY c.name, o.created_at DESC';

    const [orders] = await db.query(sql);
    for (const o of orders) {
      const [items] = await db.query('SELECT * FROM order_items WHERE order_id=?', [o.id]);
      o.items = items;
    }
    // Group by customer
    const grouped = {};
    for (const o of orders) {
      const cid = o.customer_id;
      if (!grouped[cid]) grouped[cid] = { customer_id: cid, customer_name: o.customer_name, customer_phone: o.customer_phone, customer_address: o.customer_address, customer_city: o.customer_city, fb_name: o.fb_name, orders: [] };
      grouped[cid].orders.push(o);
    }
    res.json(Object.values(grouped));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH mark customer's orders as dispatched
router.patch('/customer/:customerId', async (req, res) => {
  try {
    const { status = 'dispatched' } = req.body;
    await db.query(
      "UPDATE orders SET status=? WHERE customer_id=? AND status='pending'",
      [status, req.params.customerId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH mark ALL pending as dispatched
router.patch('/all', async (req, res) => {
  try {
    const [result] = await db.query("UPDATE orders SET status='dispatched' WHERE status='pending'");
    res.json({ ok: true, affected: result.affectedRows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
