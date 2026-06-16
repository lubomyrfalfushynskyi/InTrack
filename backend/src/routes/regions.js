const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();
router.use(auditLog('region'));

// GET / — список областей (для всіх авторизованих)
router.get('/', authenticate, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT r.*,
        (SELECT COUNT(*) FROM departments d WHERE d.region_id = r.region_id) AS dept_count,
        (SELECT COUNT(*) FROM assets a JOIN departments d ON a.department_id = d.department_id WHERE d.region_id = r.region_id) AS asset_count
       FROM regions r
       ORDER BY r.display_order, r.region_name`
    );
    res.json(r.rows);
  } catch (e) { logger.error('Get regions error', { error: e.message }); res.status(500).json({ message: 'Помилка отримання областей' }); }
});

// GET /:id — область з підрозділами
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await db.query(
      `SELECT r.*,
        (SELECT COUNT(*) FROM departments d WHERE d.region_id = r.region_id) AS dept_count
       FROM regions r
       WHERE r.region_id = $1`,
      [id]
    );
    if (!r.rows.length) return res.status(404).json({ message: 'Область не знайдена' });

    // Отримуємо підрозділи цієї області
    const depts = await db.query(
      `SELECT d.*,
        (SELECT COUNT(*) FROM locations l WHERE l.department_id = d.department_id) AS location_count,
        (SELECT COUNT(*) FROM assets a WHERE a.department_id = d.department_id) AS asset_count
       FROM departments d
       WHERE d.region_id = $1
       ORDER BY d.name`,
      [id]
    );

    res.json({ ...r.rows[0], departments: depts.rows });
  } catch (e) { logger.error('Get region error', { error: e.message }); res.status(500).json({ message: 'Помилка отримання області' }); }
});

// POST / — створити область (global_admin only)
router.post('/', authenticate, authorize('global_admin'), async (req, res) => {
  const { region_name, display_order } = req.body;
  if (!region_name) return res.status(400).json({ message: 'Назва області обов\'язкова' });

  try {
    const r = await db.query(
      'INSERT INTO regions (region_name, display_order) VALUES ($1, $2) RETURNING *',
      [region_name, display_order || 999]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') { // Unique violation
      return res.status(409).json({ message: 'Область з такою назвою вже існує' });
    }
    logger.error('Create region error', { error: e.message });
    res.status(500).json({ message: 'Помилка створення області' });
  }
});

// PUT /:id — редагувати область (global_admin only)
router.put('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  const { id } = req.params;
  const { region_name, display_order } = req.body;

  if (!region_name) return res.status(400).json({ message: 'Назва області обов\'язкова' });

  try {
    const r = await db.query(
      'UPDATE regions SET region_name = $1, display_order = $2, updated_at = CURRENT_TIMESTAMP WHERE region_id = $3 RETURNING *',
      [region_name, display_order || 999, id]
    );
    if (!r.rows.length) return res.status(404).json({ message: 'Область не знайдена' });
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') { // Unique violation
      return res.status(409).json({ message: 'Область з такою назвою вже існує' });
    }
    logger.error('Update region error', { error: e.message });
    res.status(500).json({ message: 'Помилка оновлення області' });
  }
});

// DELETE /:id — видалити область (global_admin only)
// CASCADE: видаляє всі підрозділи цієї області + їх майно + приміщення
router.delete('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  const { id } = req.params;

  try {
    // Спочатку перевіримо, чи є підрозділи в цій області
    const check = await db.query('SELECT COUNT(*) as cnt FROM departments WHERE region_id = $1', [id]);
    const deptCount = parseInt(check.rows[0].cnt);

    // Видаляємо область (CASCADE видалить підрозділи → майно → приміщення)
    const r = await db.query('DELETE FROM regions WHERE region_id = $1 RETURNING region_name', [id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Область не знайдена' });

    res.json({ message: `Область "${r.rows[0].region_name}" та ${deptCount} підрозділів видалено` });
  } catch (e) {
    logger.error('Delete region error', { error: e.message });
    res.status(500).json({ message: 'Помилка видалення області' });
  }
});

module.exports = router;
