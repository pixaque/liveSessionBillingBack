const router = require('express').Router();
const db     = require('../config/db');

// GET all products (with optional search)
router.get('/', async (req, res) => {
  try {
    const { q, category } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (name LIKE ? OR sku LIKE ? OR tags LIKE ? OR barcode LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY name ASC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET categories list
router.get('/meta/categories', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT DISTINCT category FROM products ORDER BY category');
    res.json(rows.map(r => r.category));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create product
router.post('/', async (req, res) => {
  try {
    const { name, sku, category, emoji, price, cost, stock, tags, barcode, last_sold, market_low, market_high } = req.body;
    if (!name || !sku || !price) return res.status(400).json({ error: 'name, sku and price required' });
    const [result] = await db.query(
      `INSERT INTO products (name,sku,category,emoji,price,cost,stock,tags,barcode,last_sold,market_low,market_high)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, sku, category||'Other', emoji||'📦', price, cost||0, stock||0, tags||'', barcode||'', last_sold||price, market_low||price*0.8, market_high||price*1.3]
    );
    const [[created]] = await db.query('SELECT * FROM products WHERE id=?', [result.insertId]);
    res.status(201).json(created);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'SKU already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  try {
    const { name, sku, category, emoji, price, cost, stock, tags, barcode, last_sold, market_low, market_high } = req.body;
    await db.query(
      `UPDATE products SET name=?,sku=?,category=?,emoji=?,price=?,cost=?,stock=?,tags=?,barcode=?,last_sold=?,market_low=?,market_high=?
       WHERE id=?`,
      [name, sku, category, emoji, price, cost, stock, tags||'', barcode||'', last_sold||price, market_low||0, market_high||0, req.params.id]
    );
    const [[updated]] = await db.query('SELECT * FROM products WHERE id=?', [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update stock only
router.patch('/:id/stock', async (req, res) => {
  try {
    const { stock } = req.body;
    await db.query('UPDATE products SET stock=? WHERE id=?', [stock, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE product
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
