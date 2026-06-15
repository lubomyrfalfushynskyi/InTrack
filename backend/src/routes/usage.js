const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, getScope, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router({ mergeParams: true });

// GET / — журнал напрацювання об'єкта (усі записи)
router.get('/', authenticate, async (req, res) => {
  try {
    const { assetId } = req.params;
    const scope = getScope(req);
    const params = [assetId]; let extra = '';
    if (!scope.all) {
      if (scope.departmentId) { params.push(scope.departmentId); extra = `AND a.department_id = $${params.length}`; }
      else extra = 'AND FALSE';
    }
    const a = await db.query(`SELECT asset_id FROM assets a WHERE a.asset_id = $1 ${extra}`, params);
    if (!a.rows.length) return res.status(404).json({ message: 'Майно не знайдено' });
    const r = await db.query(
      `SELECT u.usage_id, u.period_year, u.period_month, u.hours, u.entered_at,
              us.username AS entered_by_username, us.full_name AS entered_by_full_name
       FROM asset_usage u LEFT JOIN users us ON u.entered_by = us.user_id
       WHERE u.asset_id = $1 ORDER BY u.period_year, u.period_month`, [assetId]);
    res.json(r.rows);
  } catch (e) { logger.error('Get usage error', { error: e.message }); res.status(500).json({ message: 'Помилка' }); }
});

// POST / — внести напрацювання за місяць
router.post('/', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  try {
    const { assetId } = req.params;
    const { period_year, period_month, hours } = req.body;
    if (!period_year || !period_month || hours === undefined || hours === null)
      return res.status(400).json({ message: 'Рік, місяць і години обов\'язкові' });
    if (period_month < 1 || period_month > 12) return res.status(400).json({ message: 'Місяць 1–12' });

    const scope = getScope(req);
    const ck = await db.query('SELECT department_id FROM assets WHERE asset_id = $1', [assetId]);
    if (!ck.rows.length) return res.status(404).json({ message: 'Майно не знайдено' });
    if (!scope.all && ck.rows[0].department_id !== scope.departmentId) return res.status(403).json({ message: 'Поза вашим підрозділом' });

    const r = await db.query(
      `INSERT INTO asset_usage (asset_id, period_year, period_month, hours, entered_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (asset_id, period_year, period_month)
       DO UPDATE SET hours = EXCLUDED.hours, entered_by = EXCLUDED.entered_by, entered_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [assetId, period_year, period_month, hours, req.user.user_id]);
    res.status(201).json(r.rows[0]);
  } catch (e) { logger.error('Create usage error', { error: e.message }); res.status(500).json({ message: 'Помилка' }); }
});

// DELETE /:usageId — адмін у межах доступу
router.delete('/:usageId', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const { assetId, usageId } = req.params;
    const scope = getScope(req);
    const params = [usageId, assetId]; let extra = '';
    if (!scope.all) {
      if (scope.departmentId) { params.push(scope.departmentId); extra = `AND a.department_id = $${params.length}`; }
      else extra = 'AND FALSE';
    }
    const r = await db.query(
      `DELETE FROM asset_usage u USING assets a WHERE u.usage_id = $1 AND u.asset_id = $2 AND a.asset_id = u.asset_id ${extra} RETURNING u.usage_id`, params);
    if (!r.rows.length) return res.status(403).json({ message: 'Поза доступом або не знайдено' });
    res.json({ message: 'Видалено' });
  } catch (e) { logger.error('Delete usage error', { error: e.message }); res.status(500).json({ message: 'Помилка' }); }
});

module.exports = router;
