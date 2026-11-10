# Secret scan

`node scripts/scan-secrets.js` scans tracked and untracked repository text files for private-key blocks, Google service-account private keys, AWS access keys, GitHub tokens, Slack tokens and common Cloudflare token assignments. GitHub Actions runs it in CI.

The scan intentionally does not flag Firebase web API keys or the Android Firebase app ID. Those are public client configuration; Firebase Rules, API restrictions and App Check provide the access controls. It does not scan prior Git history or external Cloudflare/GitHub secrets. The ZIP snapshot and current worktree were checked on 2026-10-15; the unused `google-services (1).json` copy was removed after confirming Android CI reads `GOOGLE_SERVICES_JSON_BASE64` from GitHub Actions secrets.
