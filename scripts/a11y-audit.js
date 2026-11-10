/* Automated axe scans for core SPA screens and a Lighthouse accessibility gate. */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const requireFromRoot = createRequire(path.join(root, 'package.json'));
const layoutOnly = process.argv.includes('--layout-only');
const chromeLauncher = layoutOnly ? null : require('chrome-launcher');
const axePath = layoutOnly ? null : requireFromRoot.resolve('axe-core');
const lighthousePath = layoutOnly ? null : requireFromRoot.resolve('lighthouse');
const lighthouseImport = lighthousePath ? import(pathToFileURL(lighthousePath).href) : null;
const states = [
  { name: 'login', show: ['home-screen', 'student-auth-screen'] },
  { name: 'student-dashboard', show: ['home-screen', 'student-form', 'student-dashboard-home'] },
  { name: 'test', show: ['exam-screen'] },
  { name: 'result', show: ['result-screen'] },
  { name: 'admin-dashboard', show: ['home-screen', 'admin-panel', 'admin-dashboard-home'] },
  { name: 'admin-settings', show: ['home-screen', 'admin-panel', 'settings-box'] },
  { name: 'student-settings', show: ['home-screen', 'student-form', 'student-settings-card'] }
];
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webmanifest': 'application/manifest+json'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let rel;
      try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html'; }
      catch { res.writeHead(400).end(); return; }
      const file = path.resolve(root, rel);
      if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404).end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function prepareState(page, state) {
  await page.evaluate((ids) => {
    const screens = ['home-screen', 'exam-screen', 'result-screen', 'practice-result-screen', 'solution-screen'];
    screens.forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    ['student-auth-screen', 'student-form', 'student-dashboard-home', 'student-settings-card', 'admin-panel', 'admin-dashboard-home', 'settings-box']
      .forEach((id) => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
    const splash = document.getElementById('app-splash-screen'); if (splash) splash.remove();
    const modal = document.getElementById('app-install-modal'); if (modal) modal.style.display = 'none';
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('hidden'); el.style.removeProperty('display'); }
    });
    if (ids.includes('exam-screen')) {
      document.getElementById('exam-title').textContent = 'Sample practice test';
      document.getElementById('exam-meta').textContent = 'Class 10 · Mathematics';
      document.getElementById('exam-question').textContent = 'What is 2 + 2?';
      document.getElementById('question-count').textContent = 'Question 1 of 1';
      document.getElementById('exam-options').innerHTML = '<button type="button">2</button><button type="button">3</button><button type="button">4</button><button type="button">5</button>';
    }
    if (ids.includes('result-screen')) {
      document.getElementById('result-greeting').textContent = 'Practice complete';
      document.getElementById('result-feedback').textContent = 'Your result is ready.';
    }
  }, state.show);
}

async function main() {
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}/`;
  const results = { axe: [], lighthouseAccessibility: null, mobileOverflow: [], keyboard: [] };
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'],
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
    });
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await context.newPage();
    await page.route('https://**/*', (route) => route.abort());
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    if (!layoutOnly) await page.addScriptTag({ path: axePath });
    for (const state of states) {
      await prepareState(page, state);
      if (!layoutOnly) {
        const scan = await page.evaluate(async () => window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
        }));
        const violations = scan.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
        results.axe.push({ state: state.name, violations });
        console.log(`${state.name}: ${scan.violations.length} axe violation(s), ${scan.passes.length} rule(s) passed`);
        for (const v of violations) console.log(`  ${v.impact || 'unknown'} ${v.id}: ${v.nodes} element(s) — ${v.help}`);
        const severe = scan.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
        if (severe.length) throw new Error(`${state.name} has ${severe.length} serious/critical axe violation(s)`);
      } else console.log(`${state.name}: layout/keyboard smoke only (axe skipped)`);
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement && document.activeElement !== document.body);
      results.keyboard.push({ state: state.name, firstTabMovesFocus: focused });
      if (!focused) throw new Error(`${state.name}: Tab did not move focus to a control`);
      await page.setViewportSize({ width: 390, height: 844 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      results.mobileOverflow.push({ state: state.name, overflow });
      if (overflow) throw new Error(`${state.name}: horizontal page overflow at 390px width`);
      await page.setViewportSize({ width: 1365, height: 900 });
    }
    await browser.close(); browser = null;

    if (!layoutOnly) {
      const chrome = await chromeLauncher.launch({
        chromePath: chromium.executablePath(),
        chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']
      });
      try {
        const lighthouseModule = await lighthouseImport;
        const lighthouse = lighthouseModule.default || lighthouseModule;
        const { lhr } = await lighthouse(baseUrl, {
          port: chrome.port,
          onlyCategories: ['accessibility'],
          output: 'json',
          logLevel: 'error',
          disableStorageReset: true
        });
        results.lighthouseAccessibility = Math.round((lhr.categories.accessibility.score || 0) * 100);
        console.log(`Lighthouse accessibility: ${results.lighthouseAccessibility}/100`);
        if (results.lighthouseAccessibility < 90) throw new Error('Lighthouse accessibility score is below 90');
      } finally { await chrome.kill(); }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'artifacts', 'a11y-results.json'), JSON.stringify(results, null, 2) + '\n');
  }
}

main().catch((error) => { console.error(error && error.stack || error); process.exitCode = 1; });
