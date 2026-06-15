const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, getScope } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();

// GET / — CRUD-журнал (global/supervisor — усі; адмін підрозділу — свій)
router.get('/', authenticate, authorize('global_admin', 'global_supervisor', 'department_admin'), async (req, res) => {
  try {
    const { action_type, entity, entity_id, user_id, date_from, date_to,
      page = 1, limit = 100, sort_by = 'timestamp', sort_order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;
    const scope = getScope(req);
    const conditions = []; const params = []; let pc = 0;
    if (action_type) { pc++; conditions.push(`l.action_type = $${pc}`); params.push(action_type); }
    if (entity) { pc++; conditions.push(`l.entity = $${pc}`); params.push(entity); }
    if (entity_id) { pc++; conditions.push(`l.entity_id = $${pc}`); params.push(entity_id); }
    if (user_id) { pc++; conditions.push(`l.user_id = $${pc}`); params.push(user_id); }
    if (date_from) { pc++; conditions.push(`l.timestamp >= $${pc}`); params.push(date_from); }
    if (date_to) { pc++; conditions.push(`l.timestamp <= $${pc}`); params.push(date_to); }
    if (!scope.all) {
      if (scope.departmentId) { pc++; conditions.push(`l.user_id IN (SELECT user_id FROM users WHERE department_id = $${pc})`); params.push(scope.departmentId); }
      else conditions.push('FALSE');
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = parseInt((await db.query(`SELECT COUNT(*) total FROM logs l ${where}`, params)).rows[0].total);
    const r = await db.query(
      `SELECT l.*, u.username, u.full_name, u.role AS user_role
       FROM logs l LEFT JOIN users u ON l.user_id = u.user_id
       ${where} ORDER BY ${sort_by} ${sort_order} LIMIT $${pc + 1} OFFSET $${pc + 2}`, [...params, limit, offset]);
    res.json({ data: r.rows, pagination: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { logger.error('Get logs error', { error: e.message }); res.status(500).json({ message: 'Помилка отримання журналу' }); }
});

// GET /:id
router.get('/:id', authenticate, authorize('global_admin', 'global_supervisor', 'department_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const r = await db.query(
      `SELECT l.*, u.username, u.full_name, u.department_id, d.name AS department_name
       FROM logs l LEFT JOIN users u ON l.user_id = u.user_id LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE l.log_id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Запис не знайдено' });
    const scope = getScope(req);
    if (!scope.all && r.rows[0].department_id !== scope.departmentId) return res.status(403).json({ message: 'Доступ заборонено' });
    res.json(r.rows[0]);
  } catch (e) { logger.error('Get log error', { error: e.message }); res.status(500).json({ message: 'Помилка' }); }
});

module.exports = router;
