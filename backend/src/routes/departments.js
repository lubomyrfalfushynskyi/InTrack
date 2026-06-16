const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();
router.use(auditLog('department'));

// Усі підрозділи (довідник; видимість усім — для випадаючих списків)
router.get('/', authenticate, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT d.*,
        r.region_name,
        (SELECT COUNT(*) FROM assets a WHERE a.department_id = d.department_id) AS asset_count,
        (SELECT COUNT(*) FROM users u WHERE u.department_id = d.department_id) AS user_count
       FROM departments d
       LEFT JOIN regions r ON d.region_id = r.region_id
       ORDER BY d.name`);
    res.json(r.rows);
  } catch (e) { logger.error('Get departments error', { error: e.message }); res.status(500).json({ message: 'Помилка отримання підрозділів' }); }
});

router.post('/', authenticate, authorize('global_admin'), async (req, res) => {
  const { name, region_id } = req.body;
  if (!name) return res.status(400).json({ message: 'Назва обов\'язкова' });
  if (!region_id) return res.status(400).json({ message: 'Область обов\'язкова' });
  try {
    const r = await db.query('INSERT INTO departments (name, region_id) VALUES ($1, $2) RETURNING *', [name, region_id]);
    res.status(201).json(r.rows[0]);
  } catch (e) { logger.error('Create department error', { error: e.message }); res.status(500).json({ message: 'Помилка створення' }); }
});

router.put('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  const { id } = req.params;
  const { name, region_id } = req.body;
  if (!name) return res.status(400).json({ message: 'Назва обов\'язкова' });
  if (!region_id) return res.status(400).json({ message: 'Область обов\'язкова' });
  try {
    const r = await db.query('UPDATE departments SET name = $1, region_id = $2, updated_at = CURRENT_TIMESTAMP WHERE department_id = $3 RETURNING *', [name, region_id, id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Не знайдено' });
    res.json(r.rows[0]);
  } catch (e) { logger.error('Update department error', { error: e.message }); res.status(500).json({ message: 'Помилка' }); }
});

router.delete('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query('DELETE FROM departments WHERE department_id = $1 RETURNING department_id', [id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Не знайдено' });
    res.json({ message: 'Підрозділ видалено' });
  } catch (e) { logger.error('Delete department error', { error: e.message }); res.status(500).json({ message: 'Помилка' }); }
});

module.exports = router;
