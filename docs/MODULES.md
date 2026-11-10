# JavaScript module map

The app is a classic-script application being moved gradually to ES modules. `modules/app.mjs` imports the bank module and publishes `window.SnapModules`; `modules/legacy-modules.mjs` exports the auth, tests, results, bank, OMR, admin, student and utility facades. `modules/legacy-bridge.mjs` is the explicit adapter for classic globals that ES modules cannot read as lexical bindings.

| Domain | Current implementation | Module boundary |
|---|---|---|
| Auth | `script.js`, `server-auth.js`, `student-session.js` | `modules/legacy-modules.mjs` exports `auth`; legacy sign-in functions remain callable through the bridge. |
| Tests | `script.js`, `exam-manager.js` | `tests` facade; saved tests continue using the existing Firestore chunks. |
| Results | `script.js`, `student-features.js` | `results` facade and shared records API. |
| Bank | `script.js`, `bank-idb.js`, `question-bank/` | `modules/bank-chunks.mjs` is a real import/export module; `modules/app.mjs` imports it. |
| OMR | `omr.js` | `omr` facade preserves the current window API. |
| Admin | `script.js`, `admin-settings-pro.js`, `owner-panel.js` | `admin` facade. |
| Student | `student-features.js`, `student-settings-pro.js`, `student-session.js` | `student` facade. |
| Utilities | `subject-resolver.js`, `safe-html.js`, `bank-idb.js` | `utils` facade. |

## Compatibility contract

- Keep existing classic global names stable while callers in `index.html` use inline handlers or other classic files.
- New ES modules import the bridge or domain module; do not assume top-level `let` bindings such as `questionBank` are properties of `window`.
- `window.__setQuestionBankForChunks()` is the deliberate write-through shim for the classic `questionBank` and `_bankMap` state.
- Inline JavaScript and CSS from `index.html` now live under `inline/`. Classic scripts are loaded synchronously where their original inline blocks appeared, preserving order.
- Move implementation one domain at a time, add module-level tests, then remove the corresponding legacy facade only after all callers migrate.

`script.js` remains the legacy core because many features share lexical state and call global functions. The largest inherited line was split at statement boundaries and syntax-checked; a full formatter-driven rewrite and complete extraction of every domain remain incremental work rather than a safe one-pass edit.
