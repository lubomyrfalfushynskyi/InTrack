// ============================================
// Розрахунок залишкового строку та ефективного стану майна (ТЗ v2.0 §3, §4)
// ============================================
// залишковий_строк = (normative_life_years + N_продовжень×1) − years(primary_introduced_date, сьогодні)
// рахується від ПЕРВІСНОЇ дати введення; передача лічильник не скидає.
// ============================================

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

function yearsBetween(from, to = new Date()) {
  if (!from) return null;
  const d = new Date(from);
  if (isNaN(d.getTime())) return null;
  return (new Date(to).getTime() - d.getTime()) / MS_PER_YEAR;
}

function remainingLife(primaryIntroducedDate, normativeLifeYears, extensionCount = 0, now = new Date()) {
  if (!primaryIntroducedDate || normativeLifeYears === null || normativeLifeYears === undefined) return null;
  const elapsed = yearsBetween(primaryIntroducedDate, now);
  if (elapsed === null) return null;
  return (normativeLifeYears + (extensionCount || 0)) - elapsed;
}

function effectiveStatus(storedStatus, remaining) {
  if (storedStatus === 'written_off') return 'written_off';
  if (remaining === null || remaining === undefined) return 'active';
  return remaining < 0 ? 'expired' : 'active';
}

// округлення для відображення (1 знак)
function round1(n) {
  if (n === null || n === undefined || isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}

module.exports = { yearsBetween, remainingLife, effectiveStatus, round1 };
