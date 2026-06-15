const jwt = require('jsonwebtoken');
const db = require('../services/database');
const logger = require('../services/logger');

// JWT-аутентифікація
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Токен не надано' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    const result = await db.query(
      'SELECT user_id, username, full_name, role, department_id, is_active FROM users WHERE user_id = $1',
      [decoded.userId]
    );
    if (result.rows.length === 0) return res.status(401).json({ message: 'Користувача не знайдено' });
    const user = result.rows[0];
    if (!user.is_active) return res.status(403).json({ message: 'Акаунт деактивовано' });
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error', { error: error.message });
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Невірний токен' });
    if (error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Токен закінчився' });
    res.status(500).json({ message: 'Помилка аутентифікації' });
  }
};

// Перевірка ролі (global_admin обходить усе)
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Неавторизований доступ' });
  const role = req.user.role;
  if (role === 'global_admin') return next();
  if (!allowedRoles.includes(role)) {
    logger.warn('Unauthorized access attempt', { userId: req.user.user_id, userRole: role, requiredRoles: allowedRoles });
    return res.status(403).json({ message: 'Недостатньо прав', requiredRoles: allowedRoles });
  }
  next();
};

// Область видимості: глобальні (admin/supervisor) — усі підрозділи; решта — свій
const getScope = (req) => {
  const role = req.user && req.user.role;
  if (role === 'global_admin' || role === 'global_supervisor') return { all: true, departmentId: null };
  return { all: false, departmentId: (req.user && req.user.department_id) || null };
};

// Чи може роль робити мутації (супервізор/переглядач — ні)
const canMutate = (req) => {
  const role = req.user && req.user.role;
  return role === 'global_admin' || role === 'department_admin' || role === 'editor';
};

// CRUD-журнал: фіксує всі успішні non-GET операції (акти + прямі правки адмінів)
const auditLog = (entity) => (req, res, next) => {
  const originalSend = res.send;
  res.send = function (data) {
    if (res.statusCode >= 200 && res.statusCode < 300 && req.method !== 'GET') {
      const actionType = req.method === 'POST' ? 'create'
        : (req.method === 'PUT' || req.method === 'PATCH') ? 'update' : 'delete';
      let entityId = req.params.id || req.params.assetId || req.params.actId
        || req.params.typeId || req.params.locationId || req.params.userId;
      if (!entityId) {
        try {
          const d = typeof data === 'string' ? JSON.parse(data) : data;
          entityId = d && (d.asset_id || d.act_id || d.type_id || d.location_id || d.user_id) || null;
        } catch (e) { entityId = null; }
      }
      db.query(
        `INSERT INTO logs (user_id, action_type, entity, entity_id, new_values, ip_address, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [req.user && req.user.user_id, actionType, entity, entityId || null,
         (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') ? JSON.stringify(req.body) : null,
         req.ip, req.get('user-agent')]
      ).catch(err => logger.error('Failed audit log', { error: err.message }));
    }
    originalSend.call(this, data);
  };
  next();
};

module.exports = { authenticate, authorize, getScope, canMutate, auditLog };
