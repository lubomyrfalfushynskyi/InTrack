const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../services/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Логін та пароль обов\'язкові' });
    }

    // Get user from database
    const result = await db.query(
      `SELECT user_id, username, password_hash, full_name, role, department_id, is_active
       FROM users WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      logger.warn('Login attempt with non-existent user', { username });
      return res.status(401).json({ message: 'Невірний логін або пароль' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      logger.warn('Login attempt with disabled account', { username });
      return res.status(403).json({ message: 'Акаунт деактивовано' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      logger.warn('Login attempt with invalid password', { username });
      return res.status(401).json({ message: 'Невірний логін або пароль' });
    }

    // Update last login
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1', [user.user_id]);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logger.info('User logged in successfully', { userId: user.user_id, username });

    res.json({
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        departmentId: user.department_id
      }
    });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ message: 'Помилка при вході в систему' });
  }
});

// Get current user info
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.user_id, u.username, u.full_name, u.role, u.department_id,
              d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get current user error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні даних користувача' });
  }
});

// Change password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Поточний та новий пароль обов\'язкові' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Новий пароль має бути не менше 6 символів' });
    }

    // Get user with password hash
    const result = await db.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [req.user.user_id]
    );

    const user = result.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Невірний поточний пароль' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [newPasswordHash, req.user.user_id]
    );

    logger.info('User changed password successfully', { userId: req.user.user_id });

    res.json({ message: 'Пароль успішно змінено' });
  } catch (error) {
    logger.error('Change password error', { error: error.message });
    res.status(500).json({ message: 'Помилка при зміні пароля' });
  }
});

module.exports = router;
