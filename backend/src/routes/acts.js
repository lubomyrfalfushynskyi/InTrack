const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, getScope, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();
router.use(auditLog('act'));

const ACT_FIELDS = ['act_number', 'act_date', 'action_date', 'asset_id', 'from_department_id',
  'to_department_id', 'responsible_user_id', 'location_id', 'notes'];

// GET / — список актів (scope + фільтри)
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 50, act_type, asset_id, department_id, date_from, date_to,
      sort_by = 'act_date', sort_order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;
    const scope = getScope(req);
    const conditions = []; const params = []; let pc = 0;

    if (act_type) { pc++; conditions.push(`act.act_type = $${pc}`); params.push(act_type); }
    if (asset_id) { pc++; conditions.push(`act.asset_id = $${pc}`); params.push(asset_id); }
    if (department_id) { pc++; conditions.push(`(act.from_department_id = $${pc} OR act.to_department_id = $${pc})`); params.push(department_id); }
    if (date_from) { pc++; conditions.push(`act.act_date >= $${pc}`); params.push(date_from); }
    if (date_to) { pc++; conditions.push(`act.act_date <= $${pc}`); params.push(date_to); }
    if (!scope.all) {
      if (scope.departmentId) { pc++; conditions.push(`(act.from_department_id = $${pc} OR act.to_department_id = $${pc})`); params.push(scope.departmentId); }
      else conditions.push('FALSE');
    }

    const allowedSort = ['act_id','act_type','act_number','act_date','action_date','created_at'];
    const sort = allowedSort.includes(sort_by) ? sort_by : 'act_date';
    const order = String(sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = parseInt((await db.query(`SELECT COUNT(*) total FROM acts act ${where}`, params)).rows[0].total);
    const result = await db.query(
      `SELECT act.*, a.inventory_number, a.name AS asset_name,
         from_d.name AS from_department_name, to_d.name AS to_department_name,
         ru.username AS responsible_username, ru.full_name AS responsible_full_name,
         creator.username AS created_by_username
       FROM acts act
       LEFT JOIN assets a ON act.asset_id = a.asset_id
       LEFT JOIN departments from_d ON act.from_department_id = from_d.department_id
       LEFT JOIN departments to_d   ON act.to_department_id   = to_d.department_id
       LEFT JOIN users ru ON act.responsible_user_id = ru.user_id
       LEFT JOIN users creator ON act.created_by = creator.user_id
       ${where}
       ORDER BY ${sort} ${order} LIMIT $${pc + 1} OFFSET $${pc + 2}`,
      [...params, limit, offset]);
    res.json({ data: result.rows, pagination: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { logger.error('Get acts error', { error: e.message }); res.status(500).json({ message: 'Помилка отримання актів' }); }
});

// GET /:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await db.query(
      `SELECT act.*, a.inventory_number, a.name AS asset_name,
         from_d.name AS from_department_name, to_d.name AS to_department_name,
         ru.username AS responsible_username, creator.username AS created_by_username
       FROM acts act
       LEFT JOIN assets a ON act.asset_id = a.asset_id
       LEFT JOIN departments from_d ON act.from_department_id = from_d.department_id
       LEFT JOIN departments to_d   ON act.to_department_id   = to_d.department_id
       LEFT JOIN users ru ON act.responsible_user_id = ru.user_id
       LEFT JOIN users creator ON act.created_by = creator.user_id
       WHERE act.act_id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Акт не знайдено' });
    res.json(r.rows[0]);
  } catch (e) { logger.error('Get act error', { error: e.message }); res.status(500).json({ message: 'Помилка' }); }
});

// helper: перевірити унікальність (act_type, act_number)
async function assertUnique(client, act_type, act_number) {
  const ex = await client.query('SELECT act_id FROM acts WHERE act_type=$1 AND act_number=$2', [act_type, act_number]);
  return ex.rows.length === 0;
}

// helper: остання дата дії над об'єктом (max(action_date) по його актах)
async function lastActionDate(client, asset_id) {
  const r = await client.query('SELECT MAX(action_date) AS d FROM acts WHERE asset_id=$1', [asset_id]);
  return r.rows[0].d || null;
}

// helper: валідація дат акту
// повертає рядок-повідомлення про помилку, або null якщо OK
function validateActDates(act_type, act_date, action_date, last_action) {
  const ad = act_date ? new Date(act_date) : null;
  const od = action_date ? new Date(action_date) : null;
  const ld = last_action ? new Date(last_action) : null;
  if (act_type === 'introduction') {
    if (od && ad && od > ad) return 'Дата дії не може бути пізніше дати акту (введення)';
  } else {
    // перенесення/продовження/списання
    if (ld && od && od < ld) return 'Дата дії не може бути раніше останньої дії над майном';
    if (od && ad && od > ad) return 'Дата дії не може бути пізніше дати акту';
  }
  return null;
}

// POST /introduction — створити майно + акт введення
router.post('/introduction', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body;
    if (!b.act_number || !b.act_date || !b.inventory_number || !b.name) {
      await client.query('ROLLBACK'); return res.status(400).json({ message: 'Номер акту, дата, інв.номер і найменування обов\'язкові' });
    }
    if (!await assertUnique(client, 'introduction', b.act_number)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Акт введення з таким номером вже є' }); }
    const exA = await client.query('SELECT asset_id FROM assets WHERE inventory_number=$1', [b.inventory_number]);
    if (exA.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Інвентарний номер вже існує' }); }

    const scope = getScope(req);
    // Авто-підрозділ: scoped — свій; глобальний адмін — з цільового користувача
    let deptId = b.department_id;
    if (!scope.all) deptId = scope.departmentId;
    if (scope.all && b.responsible_user_id) {
      const u = await client.query('SELECT department_id FROM users WHERE user_id=$1', [b.responsible_user_id]);
      if (u.rows.length && u.rows[0].department_id) deptId = u.rows[0].department_id;
    }
    const actionDate = b.action_date || b.act_date;
    const dateErr = validateActDates('introduction', b.act_date, actionDate, null);
    if (dateErr) { await client.query('ROLLBACK'); return res.status(400).json({ message: dateErr }); }
    const primaryDate = b.primary_introduced_date || actionDate;
    const respId = b.responsible_user_id || req.user.user_id;

    const assetRes = await client.query(
      `INSERT INTO assets (inventory_number, name, asset_type_id, unit, quantity, initial_value, balance_value,
         additional_info, primary_introduced_date, secondary_introduced_date, status, responsible_user_id, department_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$12) RETURNING asset_id`,
      [b.inventory_number, b.name, b.asset_type_id || null, b.unit || 'шт.', b.quantity || 1,
       b.initial_value || null, b.balance_value || null, b.additional_info || null, primaryDate,
       b.secondary_introduced_date || null, respId, deptId || null]);
    const assetId = assetRes.rows[0].asset_id;

    const actRes = await client.query(
      `INSERT INTO acts (act_type, act_number, act_date, action_date, asset_id, to_department_id, responsible_user_id, created_by, notes)
       VALUES ('introduction',$1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.act_number, b.act_date, actionDate || null, assetId, deptId || null, respId, req.user.user_id, b.notes || null]);

    await client.query('COMMIT');
    res.status(201).json({ act: actRes.rows[0], asset_id: assetId });
  } catch (e) { await client.query('ROLLBACK'); logger.error('Introduction error', { error: e.message }); res.status(500).json({ message: 'Помилка акту введення' }); }
  finally { client.release(); }
});

// POST /transfer — списання з відправника + повторне введення в одержувачі (той самий об'єкт)
router.post('/transfer', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body;
    if (!b.act_number || !b.act_date || !b.asset_id || !b.to_department_id) {
      await client.query('ROLLBACK'); return res.status(400).json({ message: 'Номер акту, дата, ID майна і підрозділ-одержувач обов\'язкові' });
    }
    if (!await assertUnique(client, 'transfer', b.act_number)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Акт передачі з таким номером вже є' }); }

    const aRes = await client.query('SELECT * FROM assets WHERE asset_id=$1', [b.asset_id]);
    if (!aRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Майно не знайдено' }); }
    const asset = aRes.rows[0];
    const scope = getScope(req);
    if (!scope.all && asset.department_id !== scope.departmentId) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Майно не у вашому підрозділі' }); }

    const actionDate = b.action_date || b.act_date;
    const lastAction = await lastActionDate(client, b.asset_id);
    const dateErr = validateActDates('transfer', b.act_date, actionDate, lastAction);
    if (dateErr) { await client.query('ROLLBACK'); return res.status(400).json({ message: dateErr }); }
    const fromDept = asset.department_id;

    // Внутрішня передача (to == from): НЕ списує, міняє утримувача (+ опц. приміщення)
    // Міжпідроздільна: списує (status=transferred) у відправнику
    if (b.to_department_id === fromDept) {
      const newLoc = b.location_id !== undefined ? b.location_id : asset.location_id;
      await client.query(
        `UPDATE assets SET responsible_user_id=$1, location_id=$2, updated_at=CURRENT_TIMESTAMP WHERE asset_id=$3`,
        [b.responsible_user_id || asset.responsible_user_id, newLoc, b.asset_id]);
    } else {
      await client.query(`UPDATE assets SET status='transferred', updated_at=CURRENT_TIMESTAMP WHERE asset_id=$1`, [b.asset_id]);
    }

    const actRes = await client.query(
      `INSERT INTO acts (act_type, act_number, act_date, action_date, asset_id, from_department_id, to_department_id, responsible_user_id, created_by, notes)
       VALUES ('transfer',$1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.act_number, b.act_date, actionDate || null, b.asset_id, fromDept || null, b.to_department_id, b.responsible_user_id || null, req.user.user_id, b.notes || null]);

    await client.query('COMMIT');
    res.status(201).json(actRes.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); logger.error('Transfer error', { error: e.message }); res.status(500).json({ message: 'Помилка акту передачі' }); }
  finally { client.release(); }
});

// POST /extension — +1 рік до придатності (рахується через лічильник актів продовження)
router.post('/extension', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body;
    if (!b.act_number || !b.act_date || !b.asset_id) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Номер акту, дата і ID майна обов\'язкові' }); }
    if (!await assertUnique(client, 'extension', b.act_number)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Акт продовження з таким номером вже є' }); }

    const aRes = await client.query('SELECT * FROM assets WHERE asset_id=$1', [b.asset_id]);
    if (!aRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Майно не знайдено' }); }
    const asset = aRes.rows[0];
    const scope = getScope(req);
    if (!scope.all && asset.department_id !== scope.departmentId) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Майно не у вашому підрозділі' }); }

    const actionDate = b.action_date || b.act_date;
    const lastAction = await lastActionDate(client, b.asset_id);
    const dateErr = validateActDates('extension', b.act_date, actionDate, lastAction);
    if (dateErr) { await client.query('ROLLBACK'); return res.status(400).json({ message: dateErr }); }
    const actRes = await client.query(
      `INSERT INTO acts (act_type, act_number, act_date, action_date, asset_id, from_department_id, created_by, notes)
       VALUES ('extension',$1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.act_number, b.act_date, actionDate || null, b.asset_id, asset.department_id || null, req.user.user_id, b.notes || null]);

    await client.query('COMMIT');
    res.status(201).json(actRes.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); logger.error('Extension error', { error: e.message }); res.status(500).json({ message: 'Помилка акту продовження' }); }
  finally { client.release(); }
});

// POST /write-off — фінальне списання
router.post('/write-off', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body;
    if (!b.act_number || !b.act_date || !b.asset_id) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Номер акту, дата і ID майна обов\'язкові' }); }
    if (!await assertUnique(client, 'write_off', b.act_number)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Акт списання з таким номером вже є' }); }

    const aRes = await client.query('SELECT * FROM assets WHERE asset_id=$1', [b.asset_id]);
    if (!aRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Майно не знайдено' }); }
    const asset = aRes.rows[0];
    const scope = getScope(req);
    if (!scope.all && asset.department_id !== scope.departmentId) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Майно не у вашому підрозділі' }); }

    const actionDate = b.action_date || b.act_date;
    const lastAction = await lastActionDate(client, b.asset_id);
    const dateErr = validateActDates('write_off', b.act_date, actionDate, lastAction);
    if (dateErr) { await client.query('ROLLBACK'); return res.status(400).json({ message: dateErr }); }
    await client.query(`UPDATE assets SET status='written_off', updated_at=CURRENT_TIMESTAMP WHERE asset_id=$1`, [b.asset_id]);
    const actRes = await client.query(
      `INSERT INTO acts (act_type, act_number, act_date, action_date, asset_id, from_department_id, created_by, notes)
       VALUES ('write_off',$1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.act_number, b.act_date, actionDate || null, b.asset_id, asset.department_id || null, req.user.user_id, b.notes || null]);

    await client.query('COMMIT');
    res.status(201).json(actRes.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); logger.error('Write-off error', { error: e.message }); res.status(500).json({ message: 'Помилка акту списання' }); }
  finally { client.release(); }
});

// DELETE /:id — лише глобальний адмін
router.delete('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const r = await db.query('DELETE FROM acts WHERE act_id=$1 RETURNING act_id', [id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Акт не знайдено' });
    res.json({ message: 'Акт видалено' });
  } catch (e) { logger.error('Delete act error', { error: e.message }); res.status(500).json({ message: 'Помилка видалення' }); }
});

module.exports = router;
