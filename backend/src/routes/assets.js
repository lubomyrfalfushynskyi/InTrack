const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, departmentAccess, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();

// Apply audit logging to all asset routes
router.use(auditLog('asset'));

// Get all assets with filtering and pagination
router.get('/', authenticate, departmentAccess, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      department_id,
      location_id,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramCount = 0;

    // Build WHERE clause based on filters
    if (search) {
      paramCount++;
      conditions.push(`(a.inventory_number ILIKE $${paramCount} OR a.description ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    if (status) {
      paramCount++;
      conditions.push(`a.status = $${paramCount}`);
      params.push(status);
    }

    if (department_id) {
      paramCount++;
      conditions.push(`a.department_id = $${paramCount}`);
      params.push(department_id);
    }

    if (location_id) {
      paramCount++;
      conditions.push(`a.location_id = $${paramCount}`);
      params.push(location_id);
    }

    // Department admins can only see their department's assets
    if (req.user.role === 'department_admin' && req.user.department_id) {
      paramCount++;
      conditions.push(`a.department_id = $${paramCount}`);
      params.push(req.user.department_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM assets a ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get assets with full details
    const query = `
      SELECT
        a.asset_id, a.inventory_number, a.description, a.status,
        a.primary_introduced_date, a.secondary_introduced_date,
        a.operating_hours, a.operating_days,
        a.balance_value, a.actual_value, a.service_life_years, a.service_life_hours,
        a.created_at, a.updated_at,
        a.owner_id, u.username as owner_username, u.full_name as owner_full_name,
        a.department_id, d.name as department_name,
        a.location_id, l.full_path as location_full
      FROM assets a
      LEFT JOIN users u ON a.owner_id = u.user_id
      LEFT JOIN departments d ON a.department_id = d.department_id
      LEFT JOIN locations l ON a.location_id = l.location_id
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
    logger.error('Get assets error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні списку майна' });
  }
});

// Get single asset by ID
router.get('/:id', authenticate, departmentAccess, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        a.*,
        u.username as owner_username, u.full_name as owner_full_name,
        d.name as department_name, d.region_id,
        r.name as region_name,
        l.full_path as location_full, l.building, l.room, l.floor
       FROM assets a
       LEFT JOIN users u ON a.owner_id = u.user_id
       LEFT JOIN departments d ON a.department_id = d.department_id
       LEFT JOIN regions r ON d.region_id = r.region_id
       LEFT JOIN locations l ON a.location_id = l.location_id
       WHERE a.asset_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Майно не знайдено' });
    }

    // Get asset acts history
    const actsResult = await db.query(
      `SELECT act_id, act_type, act_number, act_date,
              from_dept.name as from_department_name,
              to_dept.name as to_department_name,
              creator.username as created_by_username,
              notes, created_at
       FROM acts
       LEFT JOIN departments from_dept ON acts.from_department_id = from_dept.department_id
       LEFT JOIN departments to_dept ON acts.to_department_id = to_dept.department_id
       LEFT JOIN users creator ON acts.created_by = creator.user_id
       WHERE asset_id = $1
       ORDER BY act_date ASC, created_at ASC`,
      [id]
    );

    // Get asset logs
    const logsResult = await db.query(
      `SELECT log_id, action_type, old_values, new_values, timestamp
       FROM logs
       WHERE entity = 'assets' AND entity_id = $1
       ORDER BY timestamp DESC
       LIMIT 50`,
      [id]
    );

    res.json({
      asset: result.rows[0],
      history: actsResult.rows,
      logs: logsResult.rows
    });
  } catch (error) {
    logger.error('Get asset error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні даних майна' });
  }
});

// Create new asset
router.post('/', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const {
      inventory_number,
      description,
      department_id,
      location_id,
      primary_introduced_date,
      balance_value,
      actual_value,
      service_life_years,
      service_life_hours
    } = req.body;

    // Validation
    if (!inventory_number || !description) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Інвентарний номер та опис обов\'язкові' });
    }

    // Check if inventory number already exists
    const existingAsset = await client.query(
      'SELECT asset_id FROM assets WHERE inventory_number = $1',
      [inventory_number]
    );

    if (existingAsset.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Інвентарний номер вже існує' });
    }

    // Set department based on user role
    let finalDepartmentId = department_id;
    if (req.user.role === 'department_admin' || req.user.role === 'editor') {
      finalDepartmentId = req.user.department_id;
    }

    // Insert asset
    const result = await client.query(
      `INSERT INTO assets
       (inventory_number, description, department_id, location_id,
        primary_introduced_date, balance_value, actual_value,
        service_life_years, service_life_hours, status, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
       RETURNING *`,
      [
        inventory_number,
        description,
        finalDepartmentId,
        location_id || null,
        primary_introduced_date || null,
        balance_value || null,
        actual_value || null,
        service_life_years || null,
        service_life_hours || null,
        req.user.user_id
      ]
    );

    await client.query('COMMIT');

    logger.info('Asset created', { assetId: result.rows[0].asset_id, inventoryNumber: inventory_number });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create asset error', { error: error.message });
    res.status(500).json({ message: 'Помилка при створенні майна' });
  } finally {
    client.release();
  }
});

// Update asset
router.put('/:id', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Get existing asset
    const existingAsset = await client.query('SELECT * FROM assets WHERE asset_id = $1', [id]);

    if (existingAsset.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Майно не знайдено' });
    }

    const asset = existingAsset.rows[0];

    // Department access check
    if ((req.user.role === 'department_admin' || req.user.role === 'editor') &&
        asset.department_id !== req.user.department_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Ви можете редагувати лише майно свого підрозділу' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    const updatableFields = [
      'description', 'location_id', 'balance_value', 'actual_value',
      'service_life_years', 'service_life_hours',
      'operating_hours', 'operating_days'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        paramCount++;
        updates.push(`${field} = $${paramCount}`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Немає полів для оновлення' });
    }

    values.push(id);

    const result = await client.query(
      `UPDATE assets SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE asset_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    await client.query('COMMIT');

    logger.info('Asset updated', { assetId: id });

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Update asset error', { error: error.message });
    res.status(500).json({ message: 'Помилка при оновленні майна' });
  } finally {
    client.release();
  }
});

// Delete asset (only global admin)
router.delete('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM assets WHERE asset_id = $1 RETURNING asset_id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Майно не знайдено' });
    }

    logger.info('Asset deleted', { assetId: id });

    res.json({ message: 'Майно успішно видалено' });
  } catch (error) {
    logger.error('Delete asset error', { error: error.message });
    res.status(500).json({ message: 'Помилка при видаленні майна' });
  }
});

module.exports = router;
