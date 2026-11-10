# Baseline tests (before any change)
- 14 Node unit tests (`test_*.js`, now in `tests/unit/`): **all 14 PASS**.
- `tests/security-rules.test.js` (Firestore/Storage emulator): **not run in the sandbox** (emulator download blocked). CI job `rules` runs it.
- No CI existed before this change.
