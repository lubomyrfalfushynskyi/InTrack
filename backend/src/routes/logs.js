const express = require('express');
const db = require('../services/database');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();

// Get all logs (admin only)
router.get('/', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      user_id,
      action_type,
      entity,
      entity_id,
      date_from,
      date_to,
      sort_by = 'timestamp',
      sort_order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramCount = 0;

    // Build WHERE clause
    if (user_id) {
      paramCount++;
      conditions.push(`l.user_id = $${paramCount}`);
      params.push(user_id);
    }

    if (action_type) {
      paramCount++;
      conditions.push(`l.action_type = $${paramCount}`);
      params.push(action_type);
    }

    if (entity) {
      paramCount++;
      conditions.push(`l.entity = $${paramCount}`);
      params.push(entity);
    }

    if (entity_id) {
      paramCount++;
      conditions.push(`l.entity_id = $${paramCount}`);
      params.push(entity_id);
    }

    if (date_from) {
      paramCount++;
      conditions.push(`l.timestamp >= $${paramCount}`);
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      conditions.push(`l.timestamp <= $${paramCount}`);
      params.push(date_to);
    }

    // Department admins can only see logs for their department's actions
    // This is implemented by checking the department of the user who performed the action
    if (req.user.role === 'department_admin') {
      paramCount++;
      conditions.push(`l.user_id IN (SELECT user_id FROM users WHERE department_id = $${paramCount})`);
      params.push(req.user.department_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM logs l ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get logs with user info
    const query = `
      SELECT
        l.*,
        u.username, u.full_name,
        u.role as user_role
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.user_id
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
    logger.error('Get logs error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні логів' });
  }
});

// Get single log by ID
router.get('/:id', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        l.*,
        u.username, u.full_name, u.department_id,
        d.name as department_name
       FROM logs l
       LEFT JOIN users u ON l.user_id = u.user_id
       LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE l.log_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Запис логу не знайдено' });
    }

    // Department admin can only see logs from their department
    if (req.user.role === 'department_admin' &&
        result.rows[0].department_id !== req.user.department_id) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get log error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні запису логу' });
  }
});

// Get log statistics
router.get('/stats/summary', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    const conditions = [];
    const params = [];
    let paramCount = 0;

    if (date_from) {
      paramCount++;
      conditions.push(`timestamp >= $${paramCount}`);
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      conditions.push(`timestamp <= $${paramCount}`);
      params.push(date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Department admins see stats only for their department
    if (req.user.role === 'department_admin') {
      paramCount++;
      const deptCondition = `user_id IN (SELECT user_id FROM users WHERE department_id = $${paramCount})`;
      if (conditions.length > 0) {
        params.push(req.user.department_id);
      } else {
        whereClause = `WHERE ${deptCondition}`;
        params.push(req.user.department_id);
      }
    }

    const result = await db.query(
      `SELECT
        action_type,
        entity,
        COUNT(*) as count
       FROM logs
       ${whereClause}
       GROUP BY action_type, entity
       ORDER BY count DESC`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Get log stats error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні статистики логів' });
  }
});

// Export logs to CSV
router.get('/export/csv', authenticate, authorize('global_admin', 'department_admin'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    const conditions = [];
    const params = [];
    let paramCount = 0;

    if (date_from) {
      paramCount++;
      conditions.push(`timestamp >= $${paramCount}`);
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      conditions.push(`timestamp <= $${paramCount}`);
      params.push(date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT
        l.timestamp,
        u.username,
        u.full_name,
        l.action_type,
        l.entity,
        l.entity_id,
        l.old_values,
        l.new_values,
        l.ip_address
       FROM logs l
       LEFT JOIN users u ON l.user_id = u.user_id
       ${whereClause}
       ORDER BY l.timestamp DESC`,
      params
    );

    // Convert to CSV
    const csv = [
      'Timestamp,Username,Full Name,Action,Entity,Entity ID,IP Address',
      ...result.rows.map(row =>
        `"${row.timestamp}","${row.username || ''}","${row.full_name || ''}",${row.action_type},${row.entity},${row.entity_id},"${row.ip_address || ''}"`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=logs.csv');
    res.send(csv);
  } catch (error) {
    logger.error('Export logs error', { error: error.message });
    res.status(500).json({ message: 'Помилка при експорті логів' });
  }
});

module.exports = router;
