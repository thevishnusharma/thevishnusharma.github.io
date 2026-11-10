# Phase 3 — Result privacy (switchable)
Default **OFF**: app exactly as before. Turn ON only after the checklist below.

## What it does when ON (`config/privacy` -> `recordsLockdown: true`)
- `studentRecords` can be read only by: owner, admin, the student himself (`mobile` == his verified session mobile),
  or a verified student of the SAME institute (`instituteId`). Anonymous / no-session users: denied.
- Student devices automatically add `where instituteId == myInstitute` to rank-board/leaderboard queries (`records-lockdown.js`).
- Create stays open; update/delete admin only (unchanged). Rollback = set the field to `false` (no redeploy).

## Steps (in this order)
1. Deploy the files (this zip) and publish `firestore.rules` (Firebase Console > Firestore > Rules > Publish).
2. As each Admin: Admin Settings > MANAGE > **Result Privacy Fix** (tags old results with instituteId). Run once per institute.
3. Firebase Console > Firestore > Indexes > Composite > add: collection `studentRecords`, fields `instituteId` Ascending, `savedAt` Descending, query scope Collection.
   (Or just open the app after turning ON; Firestore shows an error link in the browser console to create it.)
4. Firebase Console > Firestore > Data > collection `config`, document `privacy`, field `recordsLockdown` (boolean) = `true`.
5. Test with a student account of each institute: Home, My Progress/History, Rank board, Leaderboard, Start Test, Result.
6. If anything breaks: set `recordsLockdown` = `false` (instant rollback).

## Known limits (Phase 4 fixes these)
- Student identity still depends on `studentSessions` (password-hash proof). Phase 4 replaces it with server-verified login.
- Admin read of all records is still allowed (admins are not yet restricted to their own institute on reads).
- Students who never re-logged in after v168 may have no session doc -> they must log in again once.
