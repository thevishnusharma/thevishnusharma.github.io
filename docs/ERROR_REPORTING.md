# Error reporting and data minimization

`error-reporter.js` removes email addresses, Indian mobile numbers, bearer/JWT tokens, sensitive URL query values and values attached to common credential/student field names before building an alert payload. The same scrubber runs over message, source, stack, institute context and other string fields. A unit test injects representative PII and verifies the outbound payload is redacted.

Error messages and stacks can still contain arbitrary user-provided text without a recognizable field label. Keep new reports to error codes and technical context; never pass names, answers, credentials, document contents or raw request bodies to `SnapAlert.report`. Avoid adding new identifying fields to the payload. Review the Cloudflare Worker `/alert` logs and downstream push/Telegram integrations for their separate retention and access controls.
