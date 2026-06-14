const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();

// Apply audit logging to all department routes
router.use(auditLog('department'));

// Get all departments with filtering
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      region_id,
      search,
      sort_by = 'name',
      sort_order = 'ASC'
    } = req.query;

    const conditions = [];
    const params = [];
    let paramCount = 0;

    // Build WHERE clause
    if (region_id) {
      paramCount++;
      conditions.push(`d.region_id = $${paramCount}`);
      params.push(region_id);
    }

    if (search) {
      paramCount++;
      conditions.push(`d.name ILIKE $${paramCount}`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT
        d.*,
        r.name as region_name,
        (SELECT COUNT(*) FROM assets WHERE department_id = d.department_id) as asset_count,
        (SELECT COUNT(*) FROM users WHERE department_id = d.department_id) as user_count
       FROM departments d
       LEFT JOIN regions r ON d.region_id = r.region_id
       ${whereClause}
       ORDER BY ${sort_by} ${sort_order}`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Get departments error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні списку підрозділів' });
  }
});

// Get single department by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        d.*,
        r.name as region_name
       FROM departments d
       LEFT JOIN regions r ON d.region_id = r.region_id
       WHERE d.department_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Підрозділ не знайдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get department error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні даних підрозділу' });
  }
});

// Create new department (only global admin)
router.post('/', authenticate, authorize('global_admin'), async (req, res) => {
  try {
    const { name, region_id } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ message: 'Назва підрозділу обов\'язкова' });
    }

    // Insert department
    const result = await db.query(
      `INSERT INTO departments (name, region_id)
       VALUES ($1, $2)
       RETURNING *`,
      [name, region_id || null]
    );

    logger.info('Department created', { departmentId: result.rows[0].department_id, name });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create department error', { error: error.message });
    res.status(500).json({ message: 'Помилка при створенні підрозділу' });
  }
});

// Update department (only global admin)
router.put('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing department
    const existingDept = await db.query('SELECT * FROM departments WHERE department_id = $1', [id]);

    if (existingDept.rows.length === 0) {
      return res.status(404).json({ message: 'Підрозділ не знайдено' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    const updatableFields = ['name', 'region_id'];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        paramCount++;
        updates.push(`${field} = $${paramCount}`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Немає полів для оновлення' });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE departments SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE department_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    logger.info('Department updated', { departmentId: id });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update department error', { error: error.message });
    res.status(500).json({ message: 'Помилка при оновленні підрозділу' });
  }
});

// Delete department (only global admin)
router.delete('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if department is in use
    const inUseByAssets = await db.query('SELECT asset_id FROM assets WHERE department_id = $1 LIMIT 1', [id]);
    const inUseByUsers = await db.query('SELECT user_id FROM users WHERE department_id = $1 LIMIT 1', [id]);

    if (inUseByAssets.rows.length > 0 || inUseByUsers.rows.length > 0) {
      return res.status(400).json({ message: 'Підрозділ використовується, не можна видалити' });
    }

    const result = await db.query('DELETE FROM departments WHERE department_id = $1 RETURNING department_id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Підрозділ не знайдено' });
    }

    logger.info('Department deleted', { departmentId: id });

    res.json({ message: 'Підрозділ успішно видалено' });
  } catch (error) {
    logger.error('Delete department error', { error: error.message });
    res.status(500).json({ message: 'Помилка при видаленні підрозділу' });
  }
});

module.exports = router;
