const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, departmentAccess, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();

// Apply audit logging to all act routes
router.use(auditLog('act'));

// Get all acts with filtering
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      act_type,
      asset_id,
      department_id,
      date_from,
      date_to,
      sort_by = 'act_date',
      sort_order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramCount = 0;

    // Build WHERE clause
    if (act_type) {
      paramCount++;
      conditions.push(`act.act_type = $${paramCount}`);
      params.push(act_type);
    }

    if (asset_id) {
      paramCount++;
      conditions.push(`act.asset_id = $${paramCount}`);
      params.push(asset_id);
    }

    if (department_id) {
      paramCount++;
      conditions.push(`(act.from_department_id = $${paramCount} OR act.to_department_id = $${paramCount})`);
      params.push(department_id);
    }

    if (date_from) {
      paramCount++;
      conditions.push(`act.act_date >= $${paramCount}`);
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      conditions.push(`act.act_date <= $${paramCount}`);
      params.push(date_to);
    }

    // Department admins can only see acts related to their department
    if (req.user.role === 'department_admin' && req.user.department_id) {
      paramCount++;
      conditions.push(`(act.from_department_id = $${paramCount} OR act.to_department_id = $${paramCount})`);
      params.push(req.user.department_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM acts act ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get acts with full details
    const query = `
      SELECT
        act.*,
        a.inventory_number, a.description as asset_description,
        from_dept.name as from_department_name,
        to_dept.name as to_department_name,
        creator.username as created_by_username,
        creator.full_name as created_by_full_name
      FROM acts act
      LEFT JOIN assets a ON act.asset_id = a.asset_id
      LEFT JOIN departments from_dept ON act.from_department_id = from_dept.department_id
      LEFT JOIN departments to_dept ON act.to_department_id = to_dept.department_id
      LEFT JOIN users creator ON act.created_by = creator.user_id
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
    logger.error('Get acts error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні списку актів' });
  }
});

// Get single act by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        act.*,
        a.inventory_number, a.description as asset_description, a.status,
        from_dept.name as from_department_name,
        to_dept.name as to_department_name,
        creator.username as created_by_username,
        creator.full_name as created_by_full_name
       FROM acts act
       LEFT JOIN assets a ON act.asset_id = a.asset_id
       LEFT JOIN departments from_dept ON act.from_department_id = from_dept.department_id
       LEFT JOIN departments to_dept ON act.to_department_id = to_dept.department_id
       LEFT JOIN users creator ON act.created_by = creator.user_id
       WHERE act.act_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Акт не знайдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get act error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні даних акту' });
  }
});

// Create introduction act (new asset)
router.post('/introduction', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const { act_number, act_date, inventory_number, description, location_id, department_id, balance_value, service_life_years } = req.body;

    // Validation
    if (!act_number || !act_date || !inventory_number || !description) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Номер акту, дата, інвентарний номер та опис обов\'язкові' });
    }

    // Check if act number already exists
    const existingAct = await client.query(
      "SELECT act_id FROM acts WHERE act_type = 'introduction' AND act_number = $1",
      [act_number]
    );

    if (existingAct.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Акт з таким номером вже існує' });
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

    // Determine department
    let finalDepartmentId = department_id;
    if (req.user.role === 'department_admin' || req.user.role === 'editor') {
      finalDepartmentId = req.user.department_id;
    }

    // Create asset first
    const assetResult = await client.query(
      `INSERT INTO assets
       (inventory_number, description, department_id, location_id,
        primary_introduced_date, balance_value, service_life_years, status, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
       RETURNING asset_id`,
      [inventory_number, description, finalDepartmentId, location_id || null, act_date, balance_value || null, service_life_years || null, req.user.user_id]
    );

    const assetId = assetResult.rows[0].asset_id;

    // Create introduction act
    const actResult = await client.query(
      `INSERT INTO acts (act_type, act_number, act_date, asset_id, to_department_id, created_by, notes)
       VALUES ('introduction', $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [act_number, act_date, assetId, finalDepartmentId, req.user.user_id, req.body.notes || null]
    );

    await client.query('COMMIT');

    logger.info('Introduction act created', { actId: actResult.rows[0].act_id, assetId });

    res.status(201).json({
      act: actResult.rows[0],
      asset: assetResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create introduction act error', { error: error.message });
    res.status(500).json({ message: 'Помилка при створенні акту введення' });
  } finally {
    client.release();
  }
});

// Create transfer act
router.post('/transfer', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const { act_number, act_date, asset_id, to_department_id, location_id, notes } = req.body;

    // Validation
    if (!act_number || !act_date || !asset_id || !to_department_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Номер акту, дата, ID майна та підрозділ-отримувач обов\'язкові' });
    }

    // Check if act number already exists
    const existingAct = await client.query(
      "SELECT act_id FROM acts WHERE act_type = 'transfer' AND act_number = $1",
      [act_number]
    );

    if (existingAct.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Акт з таким номером вже існує' });
    }

    // Get asset
    const assetResult = await client.query('SELECT * FROM assets WHERE asset_id = $1', [asset_id]);

    if (assetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Майно не знайдено' });
    }

    const asset = assetResult.rows[0];

    // Check department access
    if ((req.user.role === 'department_admin' || req.user.role === 'editor') &&
        asset.department_id !== req.user.department_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Ви можете передавати лише майно свого підрозділу' });
    }

    // Update asset
    await client.query(
      `UPDATE assets
       SET department_id = $1, location_id = $2, status = 'transferred',
           owner_id = $3, updated_at = CURRENT_TIMESTAMP
       WHERE asset_id = $4`,
      [to_department_id, location_id || null, req.user.user_id, asset_id]
    );

    // Create transfer act
    const actResult = await client.query(
      `INSERT INTO acts (act_type, act_number, act_date, asset_id, from_department_id, to_department_id, created_by, notes)
       VALUES ('transfer', $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [act_number, act_date, asset_id, asset.department_id, to_department_id, req.user.user_id, notes || null]
    );

    await client.query('COMMIT');

    logger.info('Transfer act created', { actId: actResult.rows[0].act_id, assetId });

    res.status(201).json(actResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create transfer act error', { error: error.message });
    res.status(500).json({ message: 'Помилка при створенні акту передачі' });
  } finally {
    client.release();
  }
});

// Create write-off act
router.post('/write-off', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const { act_number, act_date, asset_id, notes } = req.body;

    // Validation
    if (!act_number || !act_date || !asset_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Номер акту, дата та ID майна обов\'язкові' });
    }

    // Check if act number already exists
    const existingAct = await client.query(
      "SELECT act_id FROM acts WHERE act_type = 'write_off' AND act_number = $1",
      [act_number]
    );

    if (existingAct.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Акт з таким номером вже існує' });
    }

    // Get asset
    const assetResult = await client.query('SELECT * FROM assets WHERE asset_id = $1', [asset_id]);

    if (assetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Майно не знайдено' });
    }

    const asset = assetResult.rows[0];

    // Check department access
    if ((req.user.role === 'department_admin' || req.user.role === 'editor') &&
        asset.department_id !== req.user.department_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Ви можете списувати лише майно свого підрозділу' });
    }

    // Update asset status
    await client.query(
      `UPDATE assets
       SET status = 'written_off', updated_at = CURRENT_TIMESTAMP
       WHERE asset_id = $1`,
      [asset_id]
    );

    // Create write-off act
    const actResult = await client.query(
      `INSERT INTO acts (act_type, act_number, act_date, asset_id, from_department_id, created_by, notes)
       VALUES ('write_off', $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [act_number, act_date, asset_id, asset.department_id, req.user.user_id, notes || null]
    );

    await client.query('COMMIT');

    logger.info('Write-off act created', { actId: actResult.rows[0].act_id, assetId });

    res.status(201).json(actResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create write-off act error', { error: error.message });
    res.status(500).json({ message: 'Помилка при створенні акту списання' });
  } finally {
    client.release();
  }
});

// Delete act (only global admin)
router.delete('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM acts WHERE act_id = $1 RETURNING act_id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Акт не знайдено' });
    }

    logger.info('Act deleted', { actId: id });

    res.json({ message: 'Акт успішно видалено' });
  } catch (error) {
    logger.error('Delete act error', { error: error.message });
    res.status(500).json({ message: 'Помилка при видаленні акту' });
  }
});

module.exports = router;
