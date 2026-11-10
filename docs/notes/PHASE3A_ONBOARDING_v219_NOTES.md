# Phase 3A — Onboarding wizard + Drive status (v219, web 1.4.14)

## Deploy (is order me)
1. Firebase Console -> Firestore -> Rules: `firestore.rules` paste -> **Publish** (naya Drive-status rule).
2. Zip ko GitHub `updates/` folder me upload karo.
3. Owner app me "+" (Naya Institute) -> wizard khulega.

## Rollback
`app-config.js` me `onboarding: false` (purana single form + banner band) ya commit Revert. Naye institute fields optional hain.

## Phone test checklist
- Owner: + dabao -> 6 step -> "Institute banao". Card par Branding/Drive/YouTube chips dikhen.
- Admin: Batch Management -> upar "Setup adhoora" banner (Drive jura nahi). Institute Settings -> "Mera Storage".
- (Client ID lagne ke baad) Drive jodein, folder kholein, disconnect.

## Kya chalaya nahi gaya
Google popup / Drive jodna, `npm run test:rules` (5 naye emulator test), phone UI.

## Dhyan
- Wizard admin email nahi leta: admin card ke "Admin Add" se jodo (Auth account banane ka purana flow).
- `driveRequired` default false: abhi koi upload band nahi hota.
- Admin session me institute doc ka 1 extra read (Drive status) aata hai.
- `scripts/build-www.js` ki OWNER_APP list me `owner-ui.js` pehle nahi thi; ab jodi gayi.
