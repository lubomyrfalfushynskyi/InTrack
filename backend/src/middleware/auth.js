const jwt = require('jsonwebtoken');
const db = require('../services/database');
const logger = require('../services/logger');

// JWT authentication middleware
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Токен не надано' });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

    // Get user from database
    const result = await db.query(
      'SELECT user_id, username, full_name, role, department_id, is_active FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Користувача не знайдено' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'Акаунт деактивовано' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error', { error: error.message });
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Невірний токен' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Токен закінчився' });
    }
    res.status(500).json({ message: 'Помилка аутентифікації' });
  }
};

// Role-based authorization middleware factory
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Неавторизований доступ' });
    }

    const userRole = req.user.role;

    // Global admin has access to everything
    if (userRole === 'global_admin') {
      return next();
    }

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(userRole)) {
      logger.warn('Unauthorized access attempt', {
        userId: req.user.user_id,
        userRole,
        requiredRoles: allowedRoles
      });
      return res.status(403).json({
        message: 'Недостатньо прав для виконання цієї дії',
        requiredRoles: allowedRoles
      });
    }

    next();
  };
};

// Department-based access check
const departmentAccess = (req, res, next) => {
  // Global admin can access everything
  if (req.user.role === 'global_admin') {
    return next();
  }

  // Department admin can only access their department
  if (req.user.role === 'department_admin') {
    const userDepartmentId = req.user.department_id;
    const requestedDepartmentId = parseInt(req.params.departmentId || req.query.departmentId || req.body.department_id);

    if (requestedDepartmentId && requestedDepartmentId !== userDepartmentId) {
      return res.status(403).json({ message: 'Доступ заборонено: ви можете переглядати лише свій підрозділ' });
    }

    return next();
  }

  // Editors and viewers can only view
  if (req.user.role === 'editor' || req.user.role === 'viewer') {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      return res.status(403).json({ message: 'Недостатньо прав для виконання цієї дії' });
    }
    return next();
  }

  next();
};

// Audit logging middleware
const auditLog = (entity) => {
  return async (req, res, next) => {
    // Store original send to intercept response
    const originalSend = res.send;

    // Get entity ID from params or body
    let entityId = req.params.id || req.params.assetId || req.params.actId;
    if (!entityId && req.body.asset_id) entityId = req.body.asset_id;
    if (!entityId && req.body.user_id) entityId = req.body.user_id;

    // Override send
    res.send = function (data) {
      // Only log on successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const actionType = req.method === 'GET' ? 'view' :
                          req.method === 'POST' ? 'create' :
                          req.method === 'PUT' || req.method === 'PATCH' ? 'update' : 'delete';

        // Log to database asynchronously
        db.query(
          `INSERT INTO logs (user_id, action_type, entity, entity_id, new_values, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user?.user_id || null,
            actionType,
            entity,
            entityId || null,
            req.method === 'POST' || req.method === 'PUT' ? JSON.stringify(req.body) : null,
            req.ip,
            req.get('user-agent')
          ]
        ).catch(err => logger.error('Failed to create audit log', { error: err.message }));
      }

      originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
  departmentAccess,
  auditLog
};
