# Firestore read and write limits

Firestore individual requests must stay within provider limits for document count, batch writes, request size, indexes and execution time. Keep operations predictable and page large collections; use a cursor from the last document rather than offsets. Review [Firestore quotas and limits](https://firebase.google.com/docs/firestore/quotas) and [query cursors](https://firebase.google.com/docs/firestore/query-data/query-cursors) when changing query sizes.

## Current application bounds

| Data/operation | Bound in source | Notes |
|---|---:|---|
| Student result history | 100 docs per `studentRecords` request | `__getMyRecordsPage(mobile, pageSize, cursor)` exposes a cursor page. The compatibility helper loads all pages sequentially to preserve current history views. |
| Admin live result feed | 200 documents | `_recQuery()` is ordered by submission time and capped. This is a latest-results view. |
| Student mistake items | 300 embedded items | The client keeps only the newest 300 in `studentMistakes/{mobile}`. |
| Test questions | 20 questions per `qchunks/{chunkId}` document | Test metadata stores `questionCount`/`chunkCount`; load only the selected test's chunks. |
| Exam-manager mirror | 100 questions | `EXAMGR_SYNC_MAX_QUESTIONS` prevents copying an oversized test. |
| Notification page | 20 items | `admin-notify.js` reads the newest notifications. |
| Account deletion | Up to 500 docs per batch/page | Worker deletion cascade iterates linked collections and commits bounded batches. |

## Adding a collection read

- Add `.limit(pageSize)` before `.get()` or a live listener. Use a page size of at most 100 by default, and make larger sizes explicit with a reason.
- Add deterministic ordering and `startAfter(lastDocument)` for user-visible history. Keep the snapshot cursor in memory; do not serialize a Firestore `DocumentSnapshot` into local storage.
- Show a `Load more` or next-page control for lists that should not fetch all pages. Do not silently truncate data required for ranking, export or correctness.
- For batches, keep operations below the current Firestore write-operation ceiling and commit/retry each chunk independently. Never place an unbounded child-collection `.get()` inside a bulk operation.
- Update security rules, required composite indexes, deletion scope, `DATA_MODEL.md` and tests with each new collection/query.

`loadStudentsDirectory(true)` intentionally supports an explicit full-scan legacy recovery action. Keep that action clearly marked as slower and avoid invoking it automatically. The migration from load-all result screens to visible cursor-based pagination is incremental; current compatibility views still walk the bounded pages until the full history is loaded.

## v226 read-reduction notes

- Admin leaderboard no longer reads 3000 `studentRecords` on every render. Admin and students share the persisted delta cache (`savya_lb_light_v2`): one full read, then only newer records; full refresh every 6h (admin) / 24h (student).
- Question-bank background auto-fixes (class tag, chapter merge, ID migration) are opt-in: `SNAP_CONFIG.bankAutoFix = true` or run `runBankAutoFixNow()` once from the console. Each migrated question costs 2 reads + 1 write + 1 delete.
- `deletedQuestions` listener is capped at 100 and `pdfDrafts` at 150.
- Student test-attempt map (`savya_attempts_cache_<mobile>`) is reused for 10 minutes (`savya_attempts_ts_<mobile>`); own submissions call `_invalidateMyRecords()` which forces a fresh read.
- Admin startup no longer loads the OMR exam list; it loads when the OMR tab opens.
- v228: opening the app restores the admin's last tab; the heavy tools behind Records > Directory / Fix Mobile no longer auto-run on that restore (`window.__restoringView`). Students Directory record counts are cached 30 min (`snap_srcount_v1_<inst>`); the Fix Mobile scan (whole `studentRecords`) runs only on an explicit click after a restore.
- v228: removed unused code (toggleTestLeaderboard, restoreDeletedTestOnline, deleteBankOnline, handlePdfUpload, renderAnalysis, getSelectedChapters, generateQuestionsForChapters, checkAutoSave, loadProg, loadAvail0, batchConvertMathEquations, needsMathConversion, runAutoDuplicateCheck, qgen helpers).
