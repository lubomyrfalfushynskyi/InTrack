const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, getScope, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();
router.use(auditLog('location'));

// GET / — список приміщень (scope)
router.get('/', authenticate, async (req, res) => {
  try {
    const scope = getScope(req);
    let where = ''; const params = [];
    if (!scope.all) {
      if (scope.departmentId) { where = 'WHERE l.department_id = $1'; params.push(scope.departmentId); }
      else where = 'WHERE FALSE';
    }
    const r = await db.query(
      `SELECT l.*, d.name AS department_name
       FROM locations l LEFT JOIN departments d ON l.department_id = d.department_id
       ${where} ORDER BY d.name, l.building, l.floor NULLS LAST, l.room NULLS LAST`, params);
    res.json(r.rows);
  } catch (e) { logger.error('Get locations error', { error: e.message }); res.status(500).json({ message: 'Помилка отримання приміщень' }); }
});

// POST / — створити приміщення (окрема кнопка)
router.post('/', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  try {
    const { building, floor, room, department_id } = req.body;
    if (!building || !department_id) return res.status(400).json({ message: 'Будівля і підрозділ обов\'язкові' });
    const scope = getScope(req);
    const deptId = scope.all ? department_id : scope.departmentId;
    const r = await db.query(
      'INSERT INTO locations (department_id, building, floor, room) VALUES ($1,$2,$3,$4) RETURNING *',
      [deptId, building, floor || null, room || null]);
    res.status(201).json(r.rows[0]);
  } catch (e) { logger.error('Create location error', { error: e.message }); res.status(500).json({ message: 'Помилка створення приміщення' }); }
});

// PUT /:id
router.put('/:id', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const cur = await client.query('SELECT * FROM locations WHERE location_id = $1', [id]);
    if (!cur.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Приміщення не знайдено' }); }
    const scope = getScope(req);
    if (!scope.all && cur.rows[0].department_id !== scope.departmentId) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Поза вашим підрозділом' }); }
    const { building, floor, room } = req.body;
    const fields = []; const vals = []; let pc = 0;
    [['building', building], ['floor', floor], ['room', room]].forEach(([f, v]) => { if (v !== undefined) { pc++; fields.push(`${f}=$${pc}`); vals.push(v); } });
    if (!fields.length) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Немає полів' }); }
    vals.push(id);
    const r = await client.query(`UPDATE locations SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE location_id = $${pc + 1} RETURNING *`, vals);
    await client.query('COMMIT');
    res.json(r.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); logger.error('Update location error', { error: e.message }); res.status(500).json({ message: 'Помилка оновлення' }); }
  finally { client.release(); }
});

// DELETE /:id
router.delete('/:id', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const cur = await db.query('SELECT department_id FROM locations WHERE location_id = $1', [id]);
    if (!cur.rows.length) return res.status(404).json({ message: 'Приміщення не знайдено' });
    const scope = getScope(req);
    if (!scope.all && cur.rows[0].department_id !== scope.departmentId) return res.status(403).json({ message: 'Поза вашим підрозділом' });
    await db.query('DELETE FROM locations WHERE location_id = $1', [id]);
    res.json({ message: 'Приміщення видалено' });
  } catch (e) { logger.error('Delete location error', { error: e.message }); res.status(500).json({ message: 'Помилка видалення' }); }
});

// GET /:id/assets — майно в приміщенні (різні власники, стани)
router.get('/:id/assets', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const scope = getScope(req);
    const params = [id]; let pc = 1; let extra = '';
    if (!scope.all) {
      if (scope.departmentId) { pc++; extra = `AND a.department_id = $${pc}`; params.push(scope.departmentId); }
      else extra = 'AND FALSE';
    }
    const r = await db.query(
      `SELECT a.asset_id, a.inventory_number, a.name, a.status,
        u.username AS responsible_username, u.full_name AS responsible_full_name,
        a.department_id, d.name AS department_name
       FROM assets a
       LEFT JOIN users u ON a.responsible_user_id = u.user_id
       LEFT JOIN departments d ON a.department_id = d.department_id
       WHERE a.location_id = $1 ${extra} ORDER BY a.name`, params);
    res.json(r.rows);
  } catch (e) { logger.error('Location assets error', { error: e.message }); res.status(500).json({ message: 'Помилка' }); }
});

module.exports = router;
