// ============================================
// Password helper
// ============================================
// Етап 1 (база): plaintext-порівняння (INSECURE — лише локальна тестова платформа).
// Етап 3 (ENABLE_BCRYPT=true): справжнє bcrypt-хешування.
// Єдина точка перемикання для login / change-password / seed.
// ============================================

const bcrypt = require('bcryptjs');

const USE_BCRYPT = (process.env.ENABLE_BCRYPT || 'false').toLowerCase() === 'true';

async function hashPassword(plain) {
  if (USE_BCRYPT) {
    return bcrypt.hash(plain, 10);
  }
  return plain; // Етап 1: plaintext
}

async function verifyPassword(plain, stored) {
  if (USE_BCRYPT) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored; // Етап 1: plaintext
}

module.exports = {
  hashPassword,
  verifyPassword,
  USE_BCRYPT,
};
