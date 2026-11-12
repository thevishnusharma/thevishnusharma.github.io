# v309 — AI voice calls

- Added an admin-reviewed Hindi/Hinglish AI announcement flow with batch or institute targeting and optional one-time scheduling.
- Added in-app ringing, accept/decline, Hindi audio playback, optional spoken student questions with typed fallback, and participation reports.
- Added a student AI call opt-out, auto voice test reminders one hour before a test, and an optional result-published voice announcement.
- Student account deletion removes that student's AI call response records along with the existing linked account data.
- Added Cloudflare Worker endpoints for Gemini, optional Google Cloud Text-to-Speech, Firestore call records, secured playback, replies and reports.
- New Worker configuration is documented in `docs/setup/AI_CALLS_SETUP.md`. Worker updates and cloud services must be configured/deployed separately from the website.
- Android uses its standard high-priority notification and opens the in-app call screen after the student taps it; it does not place a phone/VoIP call or guarantee a full-screen ring while closed.
