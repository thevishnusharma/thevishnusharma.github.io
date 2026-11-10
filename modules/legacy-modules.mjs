/*
 * Import/export facades for classic-script domains. These adapters keep the
 * existing window API stable while feature implementations migrate gradually.
 */
function invoke(name, args = []) {
  const fn = window[name];
  if (typeof fn !== 'function') throw new Error(`Legacy app API is unavailable: ${name}`);
  return fn.apply(window, args);
}

function optional(name, args = []) {
  const fn = window[name];
  return typeof fn === 'function' ? fn.apply(window, args) : undefined;
}

export const auth = Object.freeze({
  get currentUser() { return window.getAuth?.()?.currentUser || null; },
  loginStudent: (...args) => invoke('loginStudent', args),
  registerStudent: (...args) => invoke('registerStudent', args),
  loginAdmin: (...args) => invoke('loginAdmin', args),
  logoutStudent: (...args) => invoke('logoutStudent', args),
  logoutAdmin: (...args) => invoke('logoutAdmin', args)
});

export const tests = Object.freeze({
  sync: (...args) => optional('syncTests', args),
  render: (...args) => optional('renderTests', args),
  start: (...args) => invoke('startTest', args),
  save: (...args) => invoke('saveTest', args)
});

export const results = Object.freeze({
  show: (...args) => optional('showResult', args),
  renderStudentSheet: (...args) => optional('renderStudentResultSheet', args),
  getRecords: (...args) => optional('__getMyRecordsShared', args)
});

export const bank = Object.freeze({
  get questions() { return Array.isArray(window.questionBank) ? window.questionBank : []; },
  get chunks() { return window.SnapQuestionBankChunks || null; },
  sync: (...args) => optional('syncBank', args),
  render: (...args) => optional('renderBank', args)
});

export const omr = Object.freeze({
  copyPrompt: (...args) => optional('copyChatGptOmrPrompt', args),
  openScanner: (...args) => optional('openOmrScanner', args),
  gradeManual: (...args) => optional('gradeOmrManual', args)
});

export const admin = Object.freeze({
  showTab: (...args) => optional('showAdminTab', args),
  enter: (...args) => optional('enterAdminPanel', args),
  instituteId: (...args) => optional('getCurrentAdminInstituteId', args)
});

export const student = Object.freeze({
  get session() { return optional('getStudentSession') || null; },
  openSection: (...args) => optional('goStudentSection', args),
  get extras() { return window.SavyaExtras || null; }
});

export const utils = Object.freeze({
  get subjectResolver() { return window.SubjectResolver || null; },
  get safeHtml() { return window.SnapSafeHtml || null; },
  get bankIdb() { return window.__bankIdb || null; }
});

export function createLegacyModules(bankChunks) {
  const bankModule = Object.freeze({
    get questions() { return bank.questions; },
    chunks: bankChunks,
    sync: bank.sync,
    render: bank.render
  });
  return Object.freeze({ auth, tests, results, bank: bankModule, omr, admin, student, utils });
}
