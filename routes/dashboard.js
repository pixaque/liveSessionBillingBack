const router = require('express').Router();
const db     = require('../config/db');

router.get('/', async (_req, res) => {
  try {
    const [[totals]] = await db.query(`
      SELECT
        COUNT(*)                                    AS total_orders,
        SUM(status='pending')                       AS pending_orders,
        SUM(status='dispatched')                    AS dispatched_orders,
        COALESCE(SUM(CASE WHEN status='dispatched' THEN total ELSE 0 END),0) AS collected_revenue,
        COALESCE(SUM(CASE WHEN status='pending'    THEN total ELSE 0 END),0) AS pending_revenue,
        COALESCE(SUM(total),0)                      AS total_revenue
      FROM orders`);

    const [[counts]] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM customers) AS total_customers,
        (SELECT COUNT(*) FROM products)  AS total_products,
        (SELECT COUNT(*) FROM sessions)  AS total_sessions,
        (SELECT COUNT(*) FROM products WHERE stock < 10) AS low_stock_count`);

    // Revenue last 7 days
    const [dailyRevenue] = await db.query(`
      SELECT DATE(created_at) AS day, COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC`);

    // Top products by revenue (from order_items)
    const [topProducts] = await db.query(`
      SELECT oi.product_name, oi.emoji,
             SUM(oi.qty) AS total_qty,
             SUM(oi.line_total) AS total_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status != 'cancelled'
      GROUP BY oi.product_name, oi.emoji
      ORDER BY total_revenue DESC
      LIMIT 5`);

    // Low stock products
    const [lowStock] = await db.query(
      'SELECT id, name, sku, emoji, stock, price FROM products WHERE stock < 10 ORDER BY stock ASC LIMIT 8'
    );

    // Recent orders
    const [recentOrders] = await db.query(`
      SELECT o.id, o.total, o.status, o.payment, o.created_at,
             c.name AS customer_name, c.phone AS customer_phone,
             s.name AS session_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN sessions s ON s.id = o.session_id
      ORDER BY o.created_at DESC LIMIT 8`);

    res.json({
      ...totals,
      ...counts,
      daily_revenue: dailyRevenue,
      top_products:  topProducts,
      low_stock:     lowStock,
      recent_orders: recentOrders,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
