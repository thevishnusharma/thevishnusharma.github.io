import * as bankChunks from './bank-chunks.mjs';
import { createLegacyModules } from './legacy-modules.mjs';

export { auth, tests, results, bank, omr, admin, student, utils } from './legacy-modules.mjs';
export { loadSubject, loadAll, getIndex } from './bank-chunks.mjs';

export const modules = createLegacyModules(bankChunks);
window.SnapModules = modules;
window.SnapModulesReady = Promise.resolve(modules);
