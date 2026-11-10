// Phase 5 — XSS tests. Pure helper tests always run; DOM tests need jsdom (CI installs it; locally: npm i -D jsdom).
const assert = require('assert'), fs = require('fs'), path = require('path');
const S = require('../../safe-html.js');
let n = 0, skipped = 0; const t = (name, fn) => { try { fn(); n++; console.log('  PASS ' + name); } catch (e) { console.log('  FAIL ' + name + '\n   ' + (e.stack || e)); process.exitCode = 1; } };
const PAYLOADS = ['<img src=x onerror=alert(1)>', '"><script>alert(1)</script>', "'><svg onload=alert(1)>", 'javascript:alert(1)', '<a href="javascript:alert(1)">x</a>', "');alert(1);('"];

t('esc neutralises every hostile payload (no < > " \' left)', () => { for (const p of PAYLOADS) assert.ok(!/[<>"']/.test(S.esc(p)), p); });
t('esc handles null/undefined/numbers', () => { assert.strictEqual(S.esc(null), ''); assert.strictEqual(S.esc(undefined), ''); assert.strictEqual(S.esc(5), '5'); });
t('html`` tag auto-escapes interpolations, raw() opts out', () => { assert.strictEqual(S.html`<b>${'<i>'}</b>${S.raw('<u>')}`, '<b>&lt;i&gt;</b><u>'); });
t('safeUrl allows http(s)/tel/mailto/relative/data:image, blocks javascript:/data:text/html/vbscript', () => {
  for (const u of ['https://a.com/x', 'http://a.com', 'tel:+911234', 'mailto:a@b.com', 'data:image/png;base64,AAAA', 'img/a.png', '/x/y', '#top']) assert.ok(S.safeUrl(u), u);
  for (const u of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', '//evil.com/x', 'data:image/svg+xml;base64,AAAA']) assert.strictEqual(S.safeUrl(u), '', u);
});
t('escJs keeps value intact for a JS string and blocks quote break-out', () => {
  for (const v of PAYLOADS.concat(["O'Brien", 'a"b', 'back\\slash', 'line\nbreak'])) {
    const attr = S.escJs(v), decoded = attr.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#96;/g, '`').replace(/&amp;/g, '&');
    let got, called = false; new Function('f', 'alert', "f('" + decoded + "')")((x) => { got = x; }, () => { called = true; });
    assert.ok(!called, 'alert executed for ' + v); assert.strictEqual(got, v.replace(/\n/g, ' '));
  }
});
t('autofix tool: escapes free-text + handler interpolations, leaves rich fields, is idempotent', () => {
  let acornOk = true; try { require('acorn'); } catch (e) { try { require('/tmp/tool/node_modules/acorn'); } catch (e2) { acornOk = false; } }
  if (!acornOk) { skipped++; console.log('  SKIP (acorn not installed)'); return; }
  const { processSource } = require('../../scripts/xss-autofix.js');
  const src = 'el.innerHTML = `<div onclick="open(\'${s.id}\')">${s.name}</div><p>${q.text}</p><i>${t.title||"-"}</i>`; log(`Hello ${s.name}`);';
  const r = processSource(src); assert.strictEqual(r.n, 3);
  assert.ok(r.src.includes('${__sj(s.id)}') && r.src.includes('${__sx(s.name)}') && r.src.includes('${q.text}') && r.src.includes('__sx(t.title||"-")') && r.src.includes('log(`Hello ${s.name}`)'));
  assert.strictEqual(processSource(r.src).n, 0);
});

let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/tool/node_modules/jsdom')); } catch (e2) {} }
if (!JSDOM) { console.log('  SKIP DOM tests (jsdom not installed)'); }
else {
  const code = fs.readFileSync(path.join(__dirname, '..', '..', 'safe-html.js'), 'utf8');
  const mk = (body) => { const d = new JSDOM('<!doctype html><body>' + (body || '<div id="a"></div>'), { runScripts: 'outside-only' }); d.window.eval(code); return d.window; };
  t('guard: innerHTML auto-exec vectors removed (img onerror, script, svg onload, javascript: href, srcdoc, iframe js)', () => {
    const w = mk(); w.__fired = 0; const a = w.document.getElementById('a');
    a.innerHTML = '<img src=x onerror="__fired++"><script>__fired++</script><svg onload="__fired++"></svg><a href="javascript:__fired++">x</a><iframe srcdoc="<script>1</script>"></iframe><iframe src="javascript:__fired++"></iframe><input autofocus onfocusin="__fired++"><img/onerror="__fired++"/src=x><svg><animate onbegin="__fired++" attributeName=x dur=1s></svg><div onmouseover="__fired++">h</div><body onload="__fired++">';
    assert.strictEqual(a.querySelectorAll('script').length, 0); assert.ok(!a.innerHTML.match(/onerror|onload|onmouseover|onfocusin|javascript:|srcdoc/i), a.innerHTML); assert.strictEqual(w.__fired, 0);
  });
  t('guard fast path: normal UI strings (onclick, tables, svg icons) are returned untouched (no parsing cost)', () => { for (const x of ['<button onclick="go(1)">a</button>', '<table><tr><td>1</td></tr></table>', '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>', 'plain text', '<input onchange="f()" value="x">']) assert.strictEqual(S.sanitize(x), x); });
  t('guard: keeps normal UI (onclick, simple img fallback onerror, inputs, tables)', () => {
    const w = mk(); const a = w.document.getElementById('a');
    a.innerHTML = '<button onclick="go(1)">ok</button><img src="a.png" onerror="this.style.display=\'none\'"><table><tr><td>1</td></tr></table><input value="x" onchange="f()">';
    assert.ok(a.innerHTML.includes('onclick="go(1)"') && a.innerHTML.includes('onerror=') && a.querySelector('td') && a.querySelector('input').getAttribute('onchange') === 'f()');
  });
  t('guard: outerHTML + insertAdjacentHTML also sanitised', () => {
    const w = mk(); const a = w.document.getElementById('a'); a.insertAdjacentHTML('beforeend', '<img src=x onerror=alert(1)>');
    assert.ok(!a.innerHTML.includes('onerror'));
    a.outerHTML = '<div id="b"><img src=x onerror=alert(1)></div>'; assert.ok(!w.document.body.innerHTML.includes('onerror'));
  });
  t('hostile student name / test title / batch chat rendered via __sx never creates elements', () => {
    const w = mk(); const a = w.document.getElementById('a');
    for (const p of PAYLOADS) { a.innerHTML = `<div class="n">${w.__sx(p)}</div><button onclick="pick('${w.__sj(p)}')">x</button>`; assert.strictEqual(a.querySelectorAll('img,script,svg,a').length, 0, p); assert.strictEqual(a.querySelector('.n').textContent, p); }
  });
  t('sanitizeRich: keeps formatting (b i sub sup br ul li span) and strips everything dangerous', () => {
    const w = mk(); const out = w.SnapSafe.sanitizeRich('<b>x</b><sub>2</sub>H<sup>+</sup><br><ul><li>a</li></ul><span class="k" onclick="alert(1)">s</span><img src="javascript:alert(1)"><iframe src="//e"></iframe><a href="javascript:alert(1)">l</a><script>alert(1)</script><style>*{}</style>');
    assert.ok(out.includes('<b>x</b>') && out.includes('<sub>2</sub>') && out.includes('<sup>+</sup>') && out.includes('<li>a</li>') && out.includes('class="k"'));
    assert.ok(!/onclick|javascript:|<iframe|<script|<a |<style/i.test(out), out);
  });
}
console.log('\n' + n + ' passed' + (skipped ? ', ' + skipped + ' skipped' : ''));
