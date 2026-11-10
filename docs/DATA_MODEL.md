# Data model

This is a source-level map of the Firestore paths used by The Vishnu Sharma. Field sets vary by app version and older records may omit newer fields; treat the rules and current code as the schema authority when changing a collection.

## Top-level collections

| Path | Purpose and key data |
|---|---|
| `admins/{email}` | Admin status, institute binding and optional migration metadata. Owner-managed. |
| `institutes/{instituteId}` | Institute profile, active/plan limits, allowed classes, enrollment counters and feature settings. |
| `students/{mobile}` | Student profile keyed by normalized mobile; includes institute/class, consent metadata and profile fields. |
| `studentSecrets/{mobile}` | Password/PIN verifiers. Never expose verifier values to other students or logs. |
| `studentSessions/{uid}` | Auth UID to normalized student-mobile binding used by rules and Storage membership checks. |
| `tests/{testId}` | Test metadata, institute/class ownership, timing, marks and publication state. Large question sets can be stored in nested `qchunks/{chunkId}` documents. |
| `questionBank/{questionId}` | Shared, class-tagged question bank; class access is controlled by rules and admin eligibility. |
| `studentRecords/{recordId}` | Submitted answers, score, timing, student/test identifiers and review data. |
| `studentMistakes/{mobile}` | Bounded mistake-review items for one student. |
| `studentScanReports/{reportId}` | OMR scan results linked to a student and test. |
| `deletedQuestions/{questionId}`, `deletedTests/{testId}` | Soft-delete/recycle-bin metadata used by admin restore flows. |
| `pdfDrafts/{draftId}`, `examManagerExams/{examId}` | Question-paper drafts and OMR/exam-manager setup. |
| `instituteJoinCodes/{instituteId}`, `instituteJoinCodeChecks/{mobile}` | Join-code configuration and short-lived registration verification. |

## Institute subcollections

`institutes/{instituteId}/batches/{batchId}` contains batch metadata and related subcollections, including `members`, `items`, `chat`, `hands`, `files/{fileId}/parts`, `requests`, `subjects/{subjectId}/chapters`, `assignments/{assignmentId}/submissions`, `progress`, `attendance`, and `testLinks`. `teachers`, `auditLogs`, `batchSettings`, `payments`, `notifications`, and version records are also scoped below an institute.

## Important relationships

- Student IDs are normalized mobile numbers. `studentSessions/{uid}` binds the signed-in UID to that mobile; the app also supports legacy records without a session document.
- `studentRecords` and `studentScanReports` are joined to the student by mobile and to tests by `testId`.
- Batch membership documents are keyed by the student's mobile and live under an institute and batch path.
- Question-bank chunks are shipped in static files under `question-bank/chunks/` and may be published to the Cloudflare Worker KV. They are not Firestore documents at runtime for student practice.
- Student deletion is a Worker operation that pages through linked Firestore records and batch memberships; it cannot remove third-party exports or instantly expire provider backups.

## Access and lifecycle

`firestore.rules` is the authoritative access policy. Admin writes are institute-scoped; student result and mistake access is tied to the authenticated student/session. The app keeps a legacy email-based admin fallback during custom-claim migration. `storage.rules` separately governs institute batch files and checks strict-mode membership. Add new collections only with matching rule tests and update this map, account-deletion scope and retention documentation together.

Retention and backup expiry are owner-configured. The source does not declare a fixed retention period, so the Play Data Safety form must be matched to actual Firebase, Cloud Storage and Cloudflare configuration.
