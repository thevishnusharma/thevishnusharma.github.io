// v175: GitHub Action me institute ki details (naam, logo, rang) Firestore se khud laata hai — sirf INSTITUTE_ID dena padta hai.
// Firestore ke rules me institutes padhne ke liye "signed-in" chahiye; app jaisa hi anonymous sign-in yahan bhi use hota hai.
// Fail ho to workflow ke inputs (app_name) se kaam chalta hai. Output: GITHUB_OUTPUT (app_name, slug, package, has_icon, active)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const id = (process.env.INSTITUTE_ID || '').trim();
const manualName = (process.env.INPUT_APP_NAME || '').trim();
if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) { console.error('INSTITUTE_ID galat/khaali hai'); process.exit(1); }
const cfgTxt = fs.readFileSync(path.join(ROOT, 'firebase-config.js'), 'utf8');
const apiKey = (cfgTxt.match(/apiKey\s*:\s*"([^"]+)"/) || [])[1], projectId = (cfgTxt.match(/projectId\s*:\s*"([^"]+)"/) || [])[1];
const H = { 'Content-Type': 'application/json', Referer: 'https://thevishnusharma.github.io/', Origin: 'https://thevishnusharma.github.io' };
const val = f => f == null ? undefined : (f.stringValue !== undefined ? f.stringValue : f.booleanValue !== undefined ? f.booleanValue : f.integerValue !== undefined ? +f.integerValue : undefined);
(async () => {
  let d = {};
  try {
    const a = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + apiKey, { method: 'POST', headers: H, body: '{"returnSecureToken":true}' })).json();
    if (!a.idToken) throw new Error('anonymous sign-in nahi hua: ' + JSON.stringify(a.error || a));
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/institutes/${encodeURIComponent(id)}`, { headers: { Authorization: 'Bearer ' + a.idToken, Referer: H.Referer } });
    const j = await r.json();
    if (!r.ok) throw new Error('institute nahi mila / padh nahi paaye: ' + JSON.stringify(j.error || j));
    for (const [k, v] of Object.entries(j.fields || {})) d[k] = val(v);
    console.log('institute mila:', d.name, '| active:', d.active);
  } catch (e) { console.warn('WARN: Firestore se institute nahi mila —', e.message, '\n      Workflow input (app_name) aur default icon use honge.'); }

  const name = (manualName || d.name || 'The Vishnu Sharma').replace(/[<>&"'\\]/g, '').trim().slice(0, 40) || 'The Vishnu Sharma';
  const slug = id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40) || 'inst';
  const pkg = 'com.snaptestpro.i' + slug;
  let hasIcon = false;
  const m = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(d.logoDataUrl || '');
  if (m) { fs.writeFileSync(path.join(ROOT, 'institute-icon.img'), Buffer.from(m[1], 'base64')); hasIcon = true; }
  else { const own = path.join(ROOT, 'institute-icons', id + '.png'); if (fs.existsSync(own)) { fs.copyFileSync(own, path.join(ROOT, 'institute-icon.img')); hasIcon = true; } }
  /* v222: native splash/status bar rang ke liye (android-brand.js padhta hai); sirf valid #rrggbb */
  const bc = /^#[0-9a-f]{6}$/i.test(d.brandColor || '') ? d.brandColor : '';
  if (bc) fs.writeFileSync(path.join(ROOT, 'institute-brand.json'), JSON.stringify({ brandColor: bc }));
  console.log({ name, pkg, hasIcon, brandColor: bc || '-' });
  const out = { app_name: name, slug, package: pkg, has_icon: hasIcon, active: d.active === false ? 'false' : 'true' };
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(out).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
})();
