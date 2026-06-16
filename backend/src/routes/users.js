const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, getScope, auditLog } = require('../middleware/auth');
const { hashPassword } = require('../services/password');
const logger = require('../services/logger');

const router = express.Router();
router.use(auditLog('user'));

const ROLES = ['global_admin', 'global_supervisor', 'department_admin', 'editor', 'viewer'];
const GLOBAL_ONLY_ROLES = ['global_admin', 'global_supervisor'];

// GET / — глобальний адмін і адмін підрозділу (scoped)
router.get('/', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const { search, role, department_id, sort_by = 'username', sort_order = 'ASC', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const scope = getScope(req);
    const conditions = []; const params = []; let pc = 0;
    if (search) { pc++; conditions.push(`(u.username ILIKE $${pc} OR u.full_name ILIKE $${pc})`); params.push(`%${search}%`); }
    if (role) { pc++; conditions.push(`u.role = $${pc}`); params.push(role); }
    if (!scope.all) {
      if (scope.departmentId) { pc++; conditions.push(`u.department_id = $${pc}`); params.push(scope.departmentId); }
      else conditions.push('FALSE');
    } else if (department_id) { pc++; conditions.push(`u.department_id = $${pc}`); params.push(department_id); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = parseInt((await db.query(`SELECT COUNT(*) total FROM users u ${where}`, params)).rows[0].total);
    const r = await db.query(
      `SELECT u.user_id, u.username, u.full_name, u.role, u.department_id, u.is_active, u.created_at, u.last_login,
        d.name AS department_name
       FROM users u LEFT JOIN departments d ON u.department_id = d.department_id
       ${where} ORDER BY ${sort_by} ${sort_order} LIMIT $${pc + 1} OFFSET $${pc + 2}`, [...params, limit, offset]);
    res.json({ data: r.rows, pagination: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { logger.error('Get users error', { error: e.message }); res.status(500).json({ message: 'Помилка отримання користувачів' }); }
});

// GET /:id
router.get('/:id', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const r = await db.query(
      `SELECT u.user_id, u.username, u.full_name, u.role, u.department_id, u.is_active, u.created_at, u.last_login, d.name AS department_name
       FROM users u LEFT JOIN departments d ON u.department_id = d.department_id WHERE u.user_id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Користувача не знайдено' });
    const scope = getScope(req);
    if (!scope.all && r.rows[0].department_id !== scope.departmentId) return res.status(403).json({ message: 'Поза вашим підрозділом' });
    res.json(r.rows[0]);
  } catch (e) { logger.error('Get user error', { error: e.message }); res.status(500).json({ message: 'Помилка' }); }
});

// POST / — створити користувача
router.post('/', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const { username, password, full_name, role, department_id, is_active = true } = req.body;
    if (!username || !password || !role) return res.status(400).json({ message: 'Логін, пароль і роль обов\'язкові' });
    if (!ROLES.includes(role)) return res.status(400).json({ message: 'Невірна роль' });
    if (String(password).length < 4) return res.status(400).json({ message: 'Пароль занадто короткий (мін. 4)' });
    if (GLOBAL_ONLY_ROLES.includes(role) && req.user.role !== 'global_admin')
      return res.status(403).json({ message: 'Глобальні ролі призначає лише глобальний адмін' });
    const scope = getScope(req);
    const deptId = req.user.role === 'global_admin' ? (department_id || null) : scope.departmentId;
    const ex = await db.query('SELECT user_id FROM users WHERE username = $1', [username]);
    if (ex.rows.length) return res.status(400).json({ message: 'Логін зайнятий' });
    const hash = await hashPassword(password);
    const r = await db.query(
      `INSERT INTO users (username, password_hash, full_name, role, department_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING user_id, username, full_name, role, department_id, is_active, created_at`,
      [username, hash, full_name || null, role, deptId, is_active]);
    res.status(201).json(r.rows[0]);
  } catch (e) { logger.error('Create user error', { error: e.message }); res.status(500).json({ message: 'Помилка створення користувача' }); }
});

// PUT /:id
router.put('/:id', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const cur = await client.query('SELECT * FROM users WHERE user_id = $1', [id]);
    if (!cur.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Користувача не знайдено' }); }
    const scope = getScope(req);
    if (!scope.all && cur.rows[0].department_id !== scope.departmentId) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Поза вашим підрозділом' }); }
    const { full_name, role, department_id, is_active, password } = req.body;
    if (role && GLOBAL_ONLY_ROLES.includes(role) && req.user.role !== 'global_admin') { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Глобальні ролі призначає лише глобальний адмін' }); }
    const fields = []; const vals = []; let pc = 0;
    [['full_name', full_name], ['role', role], ['is_active', is_active]].forEach(([f, v]) => { if (v !== undefined) { pc++; fields.push(`${f}=$${pc}`); vals.push(v); } });
    if (department_id !== undefined && req.user.role === 'global_admin') { pc++; fields.push(`department_id=$${pc}`); vals.push(department_id); }
    if (password) {
      if (String(password).length < 4) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Пароль занадто короткий' }); }
      pc++; fields.push(`password_hash=$${pc}`); vals.push(await hashPassword(password));
    }
    if (!fields.length) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Немає полів' }); }
    vals.push(id);
    const r = await client.query(`UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $${pc + 1} RETURNING user_id, username, full_name, role, department_id, is_active, updated_at`, vals);
    await client.query('COMMIT');
    res.json(r.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); logger.error('Update user error', { error: e.message }); res.status(500).json({ message: 'Помилка оновлення' }); }
  finally { client.release(); }
});

// PATCH /:id/toggle-active — блокування/розблокування (гард: не блокувати при активному майні)
router.patch('/:id/toggle-active', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const cur = await db.query('SELECT is_active, department_id FROM users WHERE user_id = $1', [id]);
    if (!cur.rows.length) return res.status(404).json({ message: 'Користувача не знайдено' });
    const scope = getScope(req);
    if (!scope.all && cur.rows[0].department_id !== scope.departmentId) return res.status(403).json({ message: 'Поза вашим підрозділом' });
    // Гард: блокування заборонене, поки є активне (несписане і непередане) майно
    if (cur.rows[0].is_active) {
      const ac = await db.query(
        "SELECT COUNT(*)::int AS n FROM assets WHERE responsible_user_id = $1 AND status NOT IN ('written_off','transferred')",
        [id]);
      if (ac.rows[0].n > 0) {
        return res.status(403).json({
          message: `Неможливо заблокувати: на користувачі ${ac.rows[0].n} активних одиниць майна. Спишіть або передайте їх.`,
          active_assets: ac.rows[0].n,
        });
      }
    }
    const r = await db.query('UPDATE users SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING user_id, username, is_active', [id]);
    res.json(r.rows[0]);
  } catch (e) { logger.error('Toggle user error', { error: e.message }); res.status(500).json({ message: 'Помилка' }); }
});

// DELETE /:id — ВИДАЛЕННЯ ЗАБОРОНЕНО (ТЗ: користувачів не видаляємо, лише блокуємо)
router.delete('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  res.status(403).json({ message: 'Видалення користувачів заборонено. Замість цього заблокуйте користувача (деактивація).' });
});

module.exports = router;
