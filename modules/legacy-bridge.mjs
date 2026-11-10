/*
 * Narrow bridge for classic app globals while the legacy bundle is split into
 * modules. New modules import this API instead of reaching through lexical
 * bindings that are not properties of window.
 */
export function getLegacyAuth() {
  try { return typeof window.getAuth === 'function' ? window.getAuth() : null; } catch { return null; }
}

export function getLegacyStudentSession() {
  try { return typeof window.getStudentSession === 'function' ? window.getStudentSession() : null; } catch { return null; }
}

export function setLegacyQuestionBank(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Question bank must be an array');
  if (typeof window.__setQuestionBankForChunks === 'function') return window.__setQuestionBankForChunks(rows);
  window.questionBank = rows;
  return rows;
}
