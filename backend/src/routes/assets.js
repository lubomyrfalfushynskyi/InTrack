const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, getScope, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();
router.use(auditLog('asset'));

// Обчислення ефективного стану + залишкового строку в SQL
const SELECT_WITH_LIFECYCLE = `
  SELECT a.asset_id, a.inventory_number, a.name, a.asset_type_id, a.unit, a.quantity,
    a.initial_value, a.balance_value, a.additional_info,
    a.primary_introduced_date, a.secondary_introduced_date, a.status,
    a.responsible_user_id, a.department_id, a.location_id, a.created_at, a.updated_at,
    t.name AS type_name, t.normative_life_years,
    d.name AS department_name,
    l.building AS location_building, l.floor AS location_floor, l.room AS location_room,
    u.username AS responsible_username, u.full_name AS responsible_full_name,
    (SELECT COUNT(*) FROM acts ac WHERE ac.asset_id = a.asset_id AND ac.act_type = 'extension') AS extension_count,
    CASE WHEN a.status = 'written_off' THEN 'written_off'
         WHEN a.status = 'transferred' THEN 'transferred'
         WHEN a.primary_introduced_date IS NULL OR t.normative_life_years IS NULL THEN 'active'
         WHEN (t.normative_life_years + (SELECT COUNT(*) FROM acts ac WHERE ac.asset_id = a.asset_id AND ac.act_type = 'extension'))
              - EXTRACT(EPOCH FROM (now() - a.primary_introduced_date::timestamp)) / (365.25*24*3600) < 0 THEN 'expired'
         ELSE 'active' END AS effective_status,
    CASE WHEN a.primary_introduced_date IS NULL OR t.normative_life_years IS NULL THEN NULL
         ELSE ROUND((t.normative_life_years + (SELECT COUNT(*) FROM acts ac WHERE ac.asset_id = a.asset_id AND ac.act_type = 'extension'))
              - EXTRACT(EPOCH FROM (now() - a.primary_introduced_date::timestamp)) / (365.25*24*3600), 1)
    END AS remaining_life_years,
    t.normative_hours AS type_normative_hours,
    (SELECT COALESCE(SUM(h.hours), 0) FROM asset_usage h WHERE h.asset_id = a.asset_id) AS usage_hours_total,
    CASE WHEN t.normative_hours IS NULL THEN NULL
         ELSE t.normative_hours - (SELECT COALESCE(SUM(h.hours), 0) FROM asset_usage h WHERE h.asset_id = a.asset_id)
    END AS remaining_hours
  FROM assets a
  LEFT JOIN asset_types t ON a.asset_type_id = t.type_id
  LEFT JOIN departments d ON a.department_id = d.department_id
  LEFT JOIN locations l ON a.location_id = l.location_id
  LEFT JOIN users u ON a.responsible_user_id = u.user_id
`;

// GET / — список з фільтрами/сортуванням/пагінацією + scope
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status, department_id, location_id, type_id, responsible_user_id,
            sort_by = 'created_at', sort_order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;
    const scope = getScope(req);
    const conditions = []; const params = []; let pc = 0;

    if (search) { pc++; conditions.push(`(sub.inventory_number ILIKE $${pc} OR sub.name ILIKE $${pc})`); params.push(`%${search}%`); }
    if (status) { pc++; conditions.push(`sub.effective_status = $${pc}`); params.push(status); }
    if (department_id) { pc++; conditions.push(`sub.department_id = $${pc}`); params.push(department_id); }
    if (location_id) { pc++; conditions.push(`sub.location_id = $${pc}`); params.push(location_id); }
    if (type_id) { pc++; conditions.push(`sub.asset_type_id = $${pc}`); params.push(type_id); }
    if (responsible_user_id) { pc++; conditions.push(`sub.responsible_user_id = $${pc}`); params.push(responsible_user_id); }
    if (!scope.all) {
      if (scope.departmentId) { pc++; conditions.push(`sub.department_id = $${pc}`); params.push(scope.departmentId); }
      else conditions.push('sub.department_id IS NULL');
    }

    const allowedSort = ['asset_id','inventory_number','name','created_at','updated_at','primary_introduced_date','effective_status','remaining_life_years','balance_value','initial_value'];
    const sort = allowedSort.includes(sort_by) ? sort_by : 'created_at';
    const order = String(sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = parseInt((await db.query(`SELECT COUNT(*) total FROM (${SELECT_WITH_LIFECYCLE}) sub ${where}`, params)).rows[0].total);
    const result = await db.query(
      `SELECT * FROM (${SELECT_WITH_LIFECYCLE}) sub ${where} ORDER BY ${sort} ${order} LIMIT $${pc + 1} OFFSET $${pc + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: result.rows, pagination: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { logger.error('Get assets error', { error: e.message }); res.status(500).json({ message: 'Помилка отримання списку майна' }); }
});

// GET /:id — картка з хронологією актів і журналом
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const ar = await db.query(`${SELECT_WITH_LIFECYCLE} WHERE a.asset_id = $1`, [id]);
    if (!ar.rows.length) return res.status(404).json({ message: 'Майно не знайдено' });
    const scope = getScope(req);
    if (!scope.all && ar.rows[0].department_id !== scope.departmentId) return res.status(403).json({ message: 'Поза вашим підрозділом' });

    const acts = await db.query(
      `SELECT act_id, act_type, act_number, act_date, action_date,
              from_d.name AS from_department_name, to_d.name AS to_department_name,
              ru.username AS responsible_username, ru.full_name AS responsible_full_name,
              creator.username AS created_by_username, notes, acts.created_at
       FROM acts
       LEFT JOIN departments from_d ON acts.from_department_id = from_d.department_id
       LEFT JOIN departments to_d   ON acts.to_department_id   = to_d.department_id
       LEFT JOIN users ru  ON acts.responsible_user_id = ru.user_id
       LEFT JOIN users creator ON acts.created_by = creator.user_id
       WHERE acts.asset_id = $1
       ORDER BY acts.act_date ASC, acts.created_at ASC`, [id]);

    const logs = await db.query(
      `SELECT log_id, action_type, new_values, timestamp, u.username
       FROM logs LEFT JOIN users u ON logs.user_id = u.user_id
       WHERE entity = 'asset' AND entity_id = $1 ORDER BY timestamp DESC LIMIT 50`, [id]);

    res.json({ asset: ar.rows[0], history: acts.rows, logs: logs.rows });
  } catch (e) { logger.error('Get asset error', { error: e.message }); res.status(500).json({ message: 'Помилка отримання даних майна' }); }
});

// PUT /:id — пряме редагування колонок (ТЗ §8)
//  редактор: лише location_id; адміни: будьщо (писається в CRUD-журнал); супервізор/переглядач — заборонено
router.put('/:id', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const cur = await client.query('SELECT * FROM assets WHERE asset_id = $1', [id]);
    if (!cur.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Майно не знайдено' }); }
    const asset = cur.rows[0];
    const scope = getScope(req);
    if (!scope.all && asset.department_id !== scope.departmentId) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Поза вашим підрозділом' }); }

    const requested = Object.keys(req.body || {});
    if (req.user.role === 'editor') {
      const forbidden = requested.filter(k => k !== 'location_id');
      if (forbidden.length) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Редактор міняє лише локацію напряму; інше — через акти', fields: forbidden }); }
    }

    const updatable = ['name','asset_type_id','unit','quantity','initial_value','balance_value','additional_info',
      'location_id','responsible_user_id','department_id','status','secondary_introduced_date'];
    const updates = []; const vals = []; let pc = 0;
    updatable.forEach(f => { if (requested.includes(f)) { pc++; updates.push(`${f} = $${pc}`); vals.push(req.body[f]); } });
    if (!updates.length) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Немає полів для оновлення' }); }

    vals.push(id);
    const result = await client.query(
      `UPDATE assets SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE asset_id = $${pc + 1} RETURNING *`, vals);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); logger.error('Update asset error', { error: e.message }); res.status(500).json({ message: 'Помилка оновлення майна' }); }
  finally { client.release(); }
});

// DELETE /:id — глобальний адмін або адмін підрозділу (у межах доступу)
router.delete('/:id', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const scope = getScope(req);
    if (scope.all) {
      const r = await db.query('DELETE FROM assets WHERE asset_id = $1 RETURNING asset_id', [id]);
      if (!r.rows.length) return res.status(404).json({ message: 'Майно не знайдено' });
      return res.json({ message: 'Майно видалено' });
    }
    const r = await db.query('DELETE FROM assets WHERE asset_id = $1 AND department_id = $2 RETURNING asset_id', [id, scope.departmentId]);
    if (!r.rows.length) return res.status(403).json({ message: 'Поза вашим підрозділом' });
    res.json({ message: 'Майно видалено' });
  } catch (e) { logger.error('Delete asset error', { error: e.message }); res.status(500).json({ message: 'Помилка видалення' }); }
});

module.exports = router;
