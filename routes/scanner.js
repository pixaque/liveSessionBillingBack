const router = require('express').Router();
const db     = require('../config/db');

// Lookup product by barcode, SKU, or fuzzy name
router.get('/lookup', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'code required' });
    const like = `%${code}%`;
    const [rows] = await db.query(
      `SELECT * FROM products
       WHERE barcode=? OR sku=? OR name LIKE ? OR tags LIKE ?
       ORDER BY
         CASE WHEN barcode=? THEN 0 WHEN sku=? THEN 1 ELSE 2 END
       LIMIT 5`,
      [code, code, like, like, code, code]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
