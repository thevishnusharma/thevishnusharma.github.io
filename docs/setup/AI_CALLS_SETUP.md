# AI voice calls

The AI Call feature sends an in-app audio announcement through FCM. It does not call a phone number or create a VoIP call. Admins review the generated Hindi script before sending. Students can accept or decline, ask a question by voice when the device supports speech recognition, or type a question. The AI is instructed to use only the admin's announcement facts; the admin still needs to check names, dates, times and numbers.

## Worker setup

1. Deploy the updated `push-worker/worker.js` to the existing Cloudflare Worker.
2. Keep its current `SERVICE_ACCOUNT_JSON`, `PROJECT_ID` (if used), and `BANK_KV` binding. `BANK_KV` stores drafts and audio with the `ai-call:` prefix; call audio expires after 35 days.
3. Add `GEMINI_API_KEY` as a **Worker secret**. The key is only used server-side. Optional text model variable: `AI_CALL_MODEL` (default `gemini-3.8-flash`).
4. For the natural shared Hindi audio, enable Cloud Text-to-Speech in the Firebase/Google Cloud project and ensure billing and the service account's Text-to-Speech permission are set. The Worker uses the existing service account with the `cloud-platform` OAuth scope. Optional voice variable: `AI_CALL_TTS_VOICE` (default `hi-IN-Chirp3-HD-Charon`, a Hindi male voice). If TTS is unavailable, students hear the script using the phone's Hindi speech voice when installed.
5. Keep a Cloudflare Cron Trigger on the Worker every 15 minutes for scheduled calls. A scheduled delivery can be up to 15 minutes late. A failed job retries up to six cron runs.

Do not put `GEMINI_API_KEY`, service-account JSON, or any private key in `ai-calls.js`, `app-config.js`, or the website bundle.

## App and student settings

- Deploy the website files and build/install a new Android APK so the AI call screen, notification channel and voice-question permission are present.
- On first use, an eligible student is subscribed to the institute's AI call topic. The separate **Settings → Notifications → AI voice calls** switch opts out; the Worker also checks the saved preference before returning call audio or replies.
- Batch targeting uses the institute's existing `batches/{batchId}/members/{mobile}` enrollment. The admin can choose a batch from the AI Call screen.
- A push received while the app is open opens the call screen. When Android has put the app in the background, the student taps the incoming notification to open that screen. Android may suppress sound, vibration or heads-up display based on device settings and notification permission.
- Voice input is requested only after a student taps **Bolkar sawaal poochhein**. Typed questions remain available when speech recognition is missing or denied.

## Stored data

- The Worker stores the original admin notes and reviewed script in `institutes/{id}/aiCalls/{callId}` so the reply model can stay grounded in the announcement.
- A response record stores the student's name, mobile's last four digits, accepted/declined/completed state and listened seconds. It does not store the student's spoken or typed questions. The existing student account deletion flow removes that student's AI call response records.
- Call audio and scheduled job data live in Worker KV and expire after 35 days. Firestore call history and other students' response records remain as institute history; this release has no admin control for deleting an individual call's history.
- The call notice also appears in the existing student Notifications list.

## Current scope and platform limits

Admins can send immediately or schedule a one-time call up to 30 days ahead, select all opted-in institute students or one batch, and review participation reports. The AI Call panel can also enable an automatic call for the one-hour test reminder and for result publication. The regular text reminder remains enabled, including for students who opted out of AI calls. Absence, birthday and motivation triggers are not wired to this release. Android's standard notification is used; the app does not claim the OS full-screen calling role and cannot guarantee an incoming-call screen or audio while closed.

