const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();

// Apply audit logging to all location routes
router.use(auditLog('location'));

// Get all locations with filtering
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      region,
      building,
      room,
      floor,
      sort_by = 'region',
      sort_order = 'ASC'
    } = req.query;

    const conditions = [];
    const params = [];
    let paramCount = 0;

    // Build WHERE clause
    if (region) {
      paramCount++;
      conditions.push(`region ILIKE $${paramCount}`);
      params.push(`%${region}%`);
    }

    if (building) {
      paramCount++;
      conditions.push(`building ILIKE $${paramCount}`);
      params.push(`%${building}%`);
    }

    if (room) {
      paramCount++;
      conditions.push(`room ILIKE $${paramCount}`);
      params.push(`%${room}%`);
    }

    if (floor) {
      paramCount++;
      conditions.push(`floor ILIKE $${paramCount}`);
      params.push(`%${floor}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT * FROM locations ${whereClause} ORDER BY ${sort_by} ${sort_order}`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Get locations error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні списку локацій' });
  }
});

// Get unique regions
router.get('/regions/unique', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT DISTINCT region FROM locations ORDER BY region'
    );

    res.json(result.rows.map(row => row.region));
  } catch (error) {
    logger.error('Get unique regions error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні списку регіонів' });
  }
});

// Get buildings by region
router.get('/buildings/by-region', authenticate, async (req, res) => {
  try {
    const { region } = req.query;

    if (!region) {
      return res.status(400).json({ message: 'Регіон обов\'язковий' });
    }

    const result = await db.query(
      'SELECT DISTINCT building FROM locations WHERE region = $1 ORDER BY building',
      [region]
    );

    res.json(result.rows.map(row => row.building));
  } catch (error) {
    logger.error('Get buildings by region error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні списку будівель' });
  }
});

// Get hierarchical location tree
router.get('/tree', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT region, building, room, floor, array_agg(location_id) as ids
       FROM locations
       GROUP BY region, building, room, floor
       ORDER BY region, building, room, floor`
    );

    // Build tree structure
    const tree = {};
    result.rows.forEach(row => {
      if (!tree[row.region]) {
        tree[row.region] = {};
      }
      if (!tree[row.region][row.building]) {
        tree[row.region][row.building] = {};
      }
      if (!tree[row.region][row.building][row.room || '']) {
        tree[row.region][row.building][row.room || ''] = [];
      }
      if (row.floor) {
        tree[row.region][row.building][row.room || ''].push(row.floor);
      }
    });

    res.json(tree);
  } catch (error) {
    logger.error('Get location tree error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні дерева локацій' });
  }
});

// Get single location by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('SELECT * FROM locations WHERE location_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Локацію не знайдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get location error', { error: error.message });
    res.status(500).json({ message: 'Помилка при отриманні даних локації' });
  }
});

// Create new location
router.post('/', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  try {
    const { region, building, room, floor } = req.body;

    // Validation
    if (!region || !building) {
      return res.status(400).json({ message: 'Регіон та будівля обов\'язкові' });
    }

    // Insert location
    const result = await db.query(
      `INSERT INTO locations (region, building, room, floor)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [region, building, room || null, floor || null]
    );

    logger.info('Location created', { locationId: result.rows[0].location_id });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create location error', { error: error.message });
    res.status(500).json({ message: 'Помилка при створенні локації' });
  }
});

// Update location
router.put('/:id', authenticate, authorize('global_admin', 'department_admin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing location
    const existingLocation = await db.query('SELECT * FROM locations WHERE location_id = $1', [id]);

    if (existingLocation.rows.length === 0) {
      return res.status(404).json({ message: 'Локацію не знайдено' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    const updatableFields = ['region', 'building', 'room', 'floor'];

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
      `UPDATE locations SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE location_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    logger.info('Location updated', { locationId: id });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update location error', { error: error.message });
    res.status(500).json({ message: 'Помилка при оновленні локації' });
  }
});

// Delete location (only global admin)
router.delete('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if location is in use
    const inUse = await db.query('SELECT asset_id FROM assets WHERE location_id = $1 LIMIT 1', [id]);

    if (inUse.rows.length > 0) {
      return res.status(400).json({ message: 'Локацію використовується, не можна видалити' });
    }

    const result = await db.query('DELETE FROM locations WHERE location_id = $1 RETURNING location_id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Локацію не знайдено' });
    }

    logger.info('Location deleted', { locationId: id });

    res.json({ message: 'Локацію успішно видалено' });
  } catch (error) {
    logger.error('Delete location error', { error: error.message });
    res.status(500).json({ message: 'Помилка при видаленні локації' });
  }
});

module.exports = router;
