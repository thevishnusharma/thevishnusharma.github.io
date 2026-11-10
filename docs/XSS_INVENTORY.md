# XSS inventory (Phase 5)

Total HTML sinks found: **363** (231 build HTML from variables).

| File | sinks | with data | escape calls |
|---|---|---|---|
| script.js | 103 | 42 | 89 |
| qgen-app.js | 43 | 41 | 54 |
| batch-phase2.js | 39 | 20 | 0 |
| batch-system.js | 36 | 24 | 79 |
| index.html | 23 | 9 | 18 |
| exam-manager.js | 20 | 20 | 18 |
| student-features.js | 19 | 19 | 26 |
| app-ui.js | 10 | 6 | 3 |
| owner-panel.js | 9 | 6 | 13 |
| owner-ui.js | 9 | 8 | 13 |
| booklet-print.js | 8 | 5 | 0 |
| student-settings-pro.js | 5 | 4 | 11 |
| omr.js | 5 | 4 | 0 |
| admin-settings-pro.js | 5 | 3 | 25 |
| offline-sync.js | 4 | 4 | 0 |
| pdf-viewer.js | 3 | 2 | 3 |
| admin-notify.js | 2 | 1 | 0 |
| whatsapp-poll-export.js | 2 | 1 | 0 |
| question-generator.html | 2 | 2 | 0 |
| four-column-print.js | 1 | 0 | 0 |
| qgen-admin-gate.js | 1 | 0 | 0 |
| read-meter.js | 1 | 0 | 0 |
| native-push.js | 1 | 1 | 3 |
| solids-lab-boot.js | 1 | 0 | 0 |

## What was done
- `safe-html.js` (loaded first on every page): `__sx` text/attr escape, `__sj` inline-handler JS-string escape, `SnapSafe.safeUrl`, `html` tag, `sanitizeRich`.
- **Global guard**: every `innerHTML` / `outerHTML` / `insertAdjacentHTML` write is sanitised: script/iframe-js/object/embed/base/meta removed, `on*` attributes removed except user-click ones (`onclick`, `onchange`, `oninput`, `onsubmit`, key/focus/blur) and the simple `<img onerror="this.style.display='none'">` fallback, `javascript:`/`data:text/html`/`srcdoc` removed. Normal UI (buttons, inputs, tables, SVG icons) keeps working.
- `scripts/xss-autofix.js` (acorn AST): in HTML-building template literals, free-text fields (name, title, label, subject, chapter, message, address, ...) are wrapped with `__sx(...)`, and values inside inline handlers (`onclick="f('${x.id}')"`) with `__sj(...)`. Idempotent; run again after adding new code.
- Question/option/explanation text is intentionally NOT escaped (it may hold b/i/sub/sup/math); it is protected by the guard. Use `SnapSafe.sanitizeRich()` for new code that renders such text.
- CSP `<meta>` + referrer policy added to index.html, owner-app.html, question-generator.html.

## Not fixed / residual risk
- HTML built with string concatenation (`"<b>"+x+"</b>"`) was not auto-escaped (only the guard protects it). Convert gradually to `SnapSafe.html` or DOM APIs (`textContent`).
- Handlers that need a click (`onclick`) cannot be told apart from legit ones once injected; the escaping at the source is what prevents them. Fields not in the free-text list are not escaped yet.
- CSP still has `unsafe-inline` (inline scripts + inline handlers exist) and index.html also `unsafe-eval` (Solids Lab uses Babel + new Function). Next step: move inline scripts to files, then remove `unsafe-inline`.
- `connect-src` allows any `https:`; tighten to the known hosts after a week of normal use.
- GitHub Pages cannot send real headers (`frame-ancestors`, HSTS...). Optional: put free Cloudflare in front of the site.

## Worker review (push-worker/worker.js)
- `/owner/*`, `/alerts*`: owner Firebase token + OWNER_EMAILS check. `/broadcast`: secret compared constant-time. `/bank` PUT, `/files/*` writes, `/live/*`: admin token (institute checked). No redirects (`Location`) anywhere -> no open redirect. Responses are JSON (no HTML) -> no HTML injection.
- `/alert` is public by design (error reports). Add rate-limit in Phase 10. Default owner emails are hard-coded as fallback (Phase 10).

> v216: `own-live.js` (SnapLive) hata diya gaya — uske sinks ab nahi hain. Table ke baaki numbers purane scan ke hain; `npm test` ka `test_xss.js` abhi bhi pass hai.
