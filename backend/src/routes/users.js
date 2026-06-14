const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../services/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();

// Apply audit logging to all user routes
router.use(auditLog('user'));

// Get all users (global admin and department admin)
router.get('/', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      role,
      department_id,
      search,
      sort_by = 'username',
      sort_order = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramCount = 0;

    // Build WHERE clause
    if (role) {
      paramCount++;
      conditions.push(`u.role = $${paramCount}`);
      params.push(role);
    }

    if (search) {
      paramCount++;
      conditions.push(`(u.username ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    // Department admins can only see users from their department
    if (req.user.role === 'department_admin') {
      paramCount++;
      conditions.push(`u.department_id = $${paramCount}`);
      params.push(req.user.department_id);
    } else if (department_id) {
      paramCount++;
      conditions.push(`u.department_id = $${paramCount}`);
      params.push(department_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get users with department info
    const query = `
      SELECT
        u.user_id, u.username, u.full_name, u.role, u.department_id,
        u.is_active, u.created_at, u.updated_at, u.last_login,
        d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.department_id
      ${whereClause}
      ORDER BY ${sort_by} ${sort_order}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    params.push(limit, offset);
    const result = await db.query(query, params);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get users error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні списку користувачів' });
  }
});

// Get single user by ID
router.get('/:id', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        u.user_id, u.username, u.full_name, u.role, u.department_id,
        u.is_active, u.created_at, u.updated_at, u.last_login,
        d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE u.user_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    // Department admin can only see users from their department
    if (req.user.role === 'department_admin' &&
        result.rows[0].department_id !== req.user.department_id) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get user error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні даних користувача' });
  }
});

// Create new user (only global admin)
router.post('/', authenticate, authorize('global_admin'), async (req, res) => {
  try {
    const {
      username,
      password,
      full_name,
      role,
      department_id,
      is_active = true
    } = req.body;

    // Validation
    if (!username || !password || !role) {
      return res.status(400).json({ message: 'Логін, пароль та роль обов\'язкові' });
    }

    if (!['global_admin', 'department_admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Невірна роль' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Пароль має бути не менше 6 символів' });
    }

    // Check if username already exists
    const existingUser = await db.query('SELECT user_id FROM users WHERE username = $1', [username]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Користувач з таким логіном вже існує' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (username, password_hash, full_name, role, department_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, username, full_name, role, department_id, is_active, created_at`,
      [username, passwordHash, full_name || null, role, department_id || null, is_active]
    );

    logger.info('User created', { userId: result.rows[0].user_id, username, role });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create user error', { error: error.message });
    res.status(500).json({ message: 'Помилка при створенні користувача' });
  }
});

// Update user (only global admin)
router.put('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing user
    const existingUser = await db.query('SELECT * FROM users WHERE user_id = $1', [id]);

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    const user = existingUser.rows[0];

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    const updatableFields = ['full_name', 'role', 'department_id', 'is_active'];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        paramCount++;
        updates.push(`${field} = $${paramCount}`);
        values.push(req.body[field]);
      }
    });

    // Handle password change separately
    if (req.body.password) {
      if (req.body.password.length < 6) {
        return res.status(400).json({ message: 'Пароль має бути не менше 6 символів' });
      }
      paramCount++;
      updates.push(`password_hash = $${paramCount}`);
      values.push(await bcrypt.hash(req.body.password, 10));
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Немає полів для оновлення' });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $${paramCount + 1}
       RETURNING user_id, username, full_name, role, department_id, is_active, updated_at`,
      values
    );

    logger.info('User updated', { userId: id });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update user error', { error: error.message });
    res.status(500).json({ message: 'Помилка при оновленні користувача' });
  }
});

// Delete user (only global admin)
router.delete('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.user.user_id) {
      return res.status(400).json({ message: 'Ви не можете видалити свій акаунт' });
    }

    const result = await db.query('DELETE FROM users WHERE user_id = $1 RETURNING user_id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    logger.info('User deleted', { userId: id });

    res.json({ message: 'Користувача успішно видалено' });
  } catch (error) {
    logger.error('Delete user error', { error: error.message });
    res.status(500).json({ message: 'Помилка при видаленні користувача' });
  }
});

// Toggle user active status
router.patch('/:id/toggle-active', authenticate, authorize('global_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get current status
    const current = await db.query('SELECT is_active FROM users WHERE user_id = $1', [id]);

    if (current.rows.length === 0) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    // Toggle status
    const result = await db.query(
      `UPDATE users SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING user_id, username, is_active`,
      [id]
    );

    logger.info('User status toggled', { userId: id, isActive: result.rows[0].is_active });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Toggle user active error', { error: error.message });
    res.status(500).json({ message: 'Помилка при зміні статусу користувача' });
  }
});

module.exports = router;
