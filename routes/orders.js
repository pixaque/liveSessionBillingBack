const router = require('express').Router();
const db     = require('../config/db');

// GET all orders (paginated, filtered)
router.get('/', async (req, res) => {
  try {
    const { status, session_id, customer_id, page = 1, limit = 50 } = req.query;
    let sql = `
      SELECT o.*, c.name AS customer_name, c.phone AS customer_phone,
             c.address AS customer_address, c.city AS customer_city, c.fb_name,
             s.name AS session_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN sessions s ON s.id = o.session_id
      WHERE 1=1`;
    const params = [];
    if (status)      { sql += ' AND o.status=?';      params.push(status); }
    if (session_id)  { sql += ' AND o.session_id=?';  params.push(session_id); }
    if (customer_id) { sql += ' AND o.customer_id=?'; params.push(customer_id); }
    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page)-1)*parseInt(limit));

    const [orders] = await db.query(sql, params);
    for (const o of orders) {
      const [items] = await db.query('SELECT * FROM order_items WHERE order_id=?', [o.id]);
      o.items = items;
    }
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single order
router.get('/:id', async (req, res) => {
  try {
    const [[order]] = await db.query(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone,
              c.address AS customer_address, c.city, c.fb_name, c.email AS customer_email,
              s.name AS session_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN sessions s ON s.id = o.session_id
       WHERE o.id=?`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Not found' });
    const [items] = await db.query('SELECT * FROM order_items WHERE order_id=?', [order.id]);
    order.items = items;
    res.json(order);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create order + items (transaction)
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { session_id, customer_id, items, subtotal, delivery, discount, total, status, payment, notes } = req.body;
    if (!customer_id || !items?.length) return res.status(400).json({ error: 'customer_id and items required' });

    const [result] = await conn.query(
      'INSERT INTO orders (session_id,customer_id,subtotal,delivery,discount,total,status,payment,notes) VALUES (?,?,?,?,?,?,?,?,?)',
      [session_id||null, customer_id, subtotal||0, delivery||0, discount||0, total||0, status||'pending', payment||'cod', notes||'']
    );
    const orderId = result.insertId;

    for (const item of items) {
      await conn.query(
        'INSERT INTO order_items (order_id,product_id,product_name,emoji,qty,unit_price,line_total) VALUES (?,?,?,?,?,?,?)',
        [orderId, item.product_id||null, item.product_name, item.emoji||'📦', item.qty, item.unit_price, item.line_total]
      );
      // Decrement stock if product_id present
      if (item.product_id) {
        await conn.query('UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id=?', [item.qty, item.product_id]);
      }
    }

    await conn.commit();
    // Return full order
    const [[created]] = await conn.query(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone,
              c.address AS customer_address, c.city, s.name AS session_name
       FROM orders o JOIN customers c ON c.id=o.customer_id
       LEFT JOIN sessions s ON s.id=o.session_id WHERE o.id=?`,
      [orderId]
    );
    const [createdItems] = await conn.query('SELECT * FROM order_items WHERE order_id=?', [orderId]);
    created.items = createdItems;
    res.status(201).json(created);
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// PUT update order (status, payment, notes, delivery, discount)
router.put('/:id', async (req, res) => {
  try {
    const { status, payment, notes, delivery, discount } = req.body;
    await db.query(
      'UPDATE orders SET status=?, payment=?, notes=?, delivery=?, discount=?, total=subtotal+COALESCE(?,delivery)-COALESCE(?,discount) WHERE id=?',
      [status, payment, notes||'', delivery, discount, delivery, discount, req.params.id]
    );
    const [[updated]] = await db.query(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
       FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=?`,
      [req.params.id]
    );
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH just status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE orders SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ ok: true, status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE order
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM orders WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
