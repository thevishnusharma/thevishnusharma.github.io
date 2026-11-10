# PHASE 0 — SnapLive hataya, live = sirf YouTube link (v216, web 1.4.11)

## Kya badla
| File | Badlav |
|---|---|
| `own-live.js` | **Poori file delete** |
| `index.html` | `<script src="own-live.js">` hataya |
| `sw.js` | `/own-live.js` precache se hataya, cache `snaptestpro-v216` |
| `app-config.js` | `snapLive` flag hataya; `ownFiles` ko DEPRECATED comment; version/build stamp |
| `batch-system.js` | Class form se SnapLive + Jitsi option gaya; naya class hamesha `external` (link). SnapLive ke watch/play/studio/endClass/purge/chat-hands cleanup hataye. Purani `own` class/recording par saaf message. Purani `inapp` live dekhne ka raasta (`joinLive`) rakha |
| `batch-phase2.js` | `liveKey` wali condition hatayi |
| `batch-system.css` | SnapLive ke `.sl-*` styles hataye |
| `firestore.rules` | `items/{id}/chat` aur `hands` rules hataye (sirf SnapLive ke the). `items` aur baaki rules jaise the |
| `push-worker/worker.js` | `handleLive` + `/live/*` route + live-only helpers hataye. `liveAdmin` ka naam `adminFromRequest` (push aur SnapFiles dono use karte hain) |
| `snap-files.js` | DEPRECATED comment (code rakha) |
| `version.json`, `package.json` | 1.4.11 / build 216 |
| docs | CHANGELOG, XSS_INVENTORY, SNAPLIVE note "REMOVED" mark |

**Jaan-boojh kar nahi chhua:** Worker ka R2/KV wala SnapFiles code, `LIVE_R2` binding ka naam (SnapFiles use karta hai), `live_mode` input APK workflows me (wo "website live mode" hai, SnapLive nahi), recording ka "processing" flow (Phase 1 me jayega).

## Checks
- `npm test` -> 33/33 pass
- `node scripts/stamp-version.js --check` -> versions in sync
- `npm run build:www && npm run check:precache` -> OK (93 entries)
- **Chalaya nahi:** `npm run test:rules` (Firestore emulator/Java chahiye), browser/phone par UI, Worker ko Cloudflare par.

## Deploy (phone, copy-paste) — is order me
1. **Firestore rules:** Firebase Console -> Firestore Database -> Rules -> `firestore.rules` ka poora text paste -> Publish.
2. **Worker:** Cloudflare Dashboard -> Workers -> `cool-thunder-a280` -> Edit code -> `push-worker/worker.js` ka poora text paste -> Deploy.
3. **Website:** GitHub web par changed files upload/commit (main). `own-live.js` ko repo se **delete** karo (file kholo -> dustbin icon -> Commit).
4. APK purane live-URL wale hain to naya APK zaroori nahi (website se update ho jata hai).

## Rollback
GitHub me pichla commit "Revert" karo; Worker me purana code wapas paste; Firestore rules me purana text paste. (Naye fields nahi bane, data format nahi badla.)

## Meri test checklist
1. Admin -> Batch -> Live Classes -> + Add: "Live kaise hogi?" dropdown **nahi** dikhna chahiye; Date & Time ke neeche YouTube wali hint dikhe.
2. Class banao -> Go Live -> YouTube link daalo -> student phone par "Join" dikhe aur link khule.
3. End Class -> chalna chahiye (Recording "Processing" me banegi — Phase 1 me badlegi).
4. Batch delete chalao (test batch) — chal jana chahiye.
5. Koi notes/PPT item kholo — pehle jaisa khule.

## Safai-list (Cloudflare / Firebase / GitHub)
Dekho chat wala jawab ya niche; "andaaza" = dashboard ke menu naam badal sakte hain.

| Cheez | Kahan | Faisla |
|---|---|---|
| `LIVE_PUBLIC_BASE` | Worker Variables | **Hatao** — ab kahin padhi nahi jati |
| `LIVE_R2` binding + R2 bucket | Worker Bindings / R2 | R2 kabhi nahi banaya to kuch nahi. Bana hai to abhi binding rakho (SnapFiles code isi naam se padhta hai); SnapFiles hatne par hatana |
| `FILES_KV` binding | Worker Bindings | `ownFiles:false` hai, isliye ab kaam ka nahi — hata sakte ho (BANK_KV alag cheez hai, **mat hatao**) |
| `PBKDF2_ITER`, `DELETE_LEGACY_HASH` | Worker Variables | `serverAuth:false` hai — kaam ke nahi, hata sakte ho |
| `TZ_OFFSET_MIN` | Worker Variables | 330 hai to hatao (default wahi hai) |
| `GITHUB_REPO`, `GITHUB_REF` | Worker Variables | Default wahi hai (`SnaptestPro/snaptestpro.github.io`, `main`) — same ho to hatao |
| `PROJECT_ID` | Worker Variables | Optional; service JSON se aa jata hai |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Worker Secrets | Telegram alert nahi chahiye to hatao |
| `SERVICE_ACCOUNT_JSON`, `BANK_KV`, `OWNER_EMAILS` | Worker | **Rakho** |
| `GITHUB_TOKEN` | Worker Secret | Owner Panel ka "APK" button chalana ho to rakho |
| `BROADCAST_SECRET` | Worker + GitHub secret | Update-announce push chahiye to rakho (dono jagah same) |
| Cron trigger (har 15 min) | Worker Triggers | Test reminders chahiye to rakho |
| `ANDROID_KEYSTORE_*`, `ANDROID_KEY_*`, `GOOGLE_SERVICES_JSON_BASE64` | GitHub secrets | **Kabhi mat hatao** (APK signing / push) |
| `OWNER_CLOUD_FUNCTIONS_optional.js` | repo | Deploy mat karo (Blaze chahiye). Chaho to repo se hata do |
| Firebase Storage | Firebase Console | Sirf purana fallback. Naya Storage/Blaze mat kholo. Code se hatana Phase 3 me (Drive ke saath) |
| App Check **Enforce** | Firebase Console | Web ka reCAPTCHA key khaali hai (`webSiteKey:""`) — Firestore par Enforce ON mat rakho jab tak key na ho, warna web users block |
