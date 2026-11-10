# Accessibility checks

The accessibility workflow runs an axe-core scan against the login, student dashboard, exam, result, admin dashboard, admin settings and student settings states. It also checks that Tab moves focus and that the page does not overflow horizontally at a 390px viewport. The Lighthouse accessibility category must score at least 90/100.

Run locally after installing the workflow-only tools:

```sh
npm install --no-save axe-core playwright lighthouse chrome-launcher
npx playwright install chromium
node scripts/check-accessible-markup.js
node scripts/a11y-audit.js
```

The Playwright scans block third-party requests so Firebase credentials and live data are not needed. `artifacts/a11y-results.json` contains the last local or CI run. The CI job uploads it even when an audit fails.

The page now has an explicit main navigation name, a page-level heading, programmatic labels for static controls, a title for the question-generator iframe, a name for the floating question-navigation control, and a zoom-friendly viewport. Continue to preserve keyboard operation and visible focus when adding controls. Keep text contrast at WCAG AA for normal-sized text and do not convey status through color alone.
