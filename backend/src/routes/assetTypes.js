const express = require('express');
const db = require('../services/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();
router.use(auditLog('asset_type'));

// Перелік видів (усі ролі)
router.get('/', authenticate, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM asset_types ORDER BY name');
    res.json(r.rows);
  } catch (e) { logger.error('Get asset_types error', { error: e.message }); res.status(500).json({ message: 'Помилка отримання видів' }); }
});

// Створити вид (глобальний адмін)
router.post('/', authenticate, authorize('global_admin'), async (req, res) => {
  const { name, description, normative_life_years } = req.body;
  if (!name || normative_life_years === undefined || normative_life_years === null) {
    return res.status(400).json({ message: 'Найменування і нормативний строк обов\'язкові' });
  }
  try {
    const r = await db.query(
      'INSERT INTO asset_types (name, description, normative_life_years) VALUES ($1,$2,$3) RETURNING *',
      [name, description || null, normative_life_years]);
    res.status(201).json(r.rows[0]);
  } catch (e) { logger.error('Create asset_type error', { error: e.message }); res.status(500).json({ message: 'Помилка створення виду' }); }
});

// Оновити вид (глобальний адмін)
router.put('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  const { id } = req.params;
  const { name, description, normative_life_years } = req.body;
  const fields = []; const vals = []; let pc = 0;
  [['name', name], ['description', description], ['normative_life_years', normative_life_years]].forEach(([f, v]) => {
    if (v !== undefined) { pc++; fields.push(`${f} = $${pc}`); vals.push(v); }
  });
  if (!fields.length) return res.status(400).json({ message: 'Немає полів' });
  vals.push(id);
  try {
    const r = await db.query(`UPDATE asset_types SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE type_id = $${pc + 1} RETURNING *`, vals);
    if (!r.rows.length) return res.status(404).json({ message: 'Вид не знайдено' });
    res.json(r.rows[0]);
  } catch (e) { logger.error('Update asset_type error', { error: e.message }); res.status(500).json({ message: 'Помилка оновлення виду' }); }
});

// Видалити вид (глобальний адмін)
router.delete('/:id', authenticate, authorize('global_admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query('DELETE FROM asset_types WHERE type_id = $1 RETURNING type_id', [id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Вид не знайдено' });
    res.json({ message: 'Вид видалено' });
  } catch (e) { logger.error('Delete asset_type error', { error: e.message }); res.status(500).json({ message: 'Помилка видалення виду' }); }
});

module.exports = router;
