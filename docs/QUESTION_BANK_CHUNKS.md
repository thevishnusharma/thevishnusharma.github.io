# Question-bank chunks

The previous `question-bank.json` was one 7,486,127-byte JSON array with 7,695 questions. It is replaced in the app bundle by a small manifest and per-class/per-subject JSON chunks under `question-bank/chunks/`.

## Measurement and content check

- Original source SHA-256: `eca72afead29429fe4c9ebaffa742c149504d325fa74f4a51648cc68070ce0a8`.
- 7,695 questions and 7,695 unique IDs were verified against the source before it was removed; all question objects matched by ID exactly.
- 14 groups were generated. Largest chunk is 1,042,664 bytes; loading one subject transfers about 86% less than the old monolithic array. The sum of all minified chunks is 7,486,140 bytes, so choosing “all subjects” preserves the original dataset size and behavior.
- Student practice loads the selected class/subject on demand, caches chunks separately in IndexedDB, and can use static chunk files when Worker chunks are not deployed. Admin bank editing continues to use the full `/bank` endpoint.
- Question chunks are intentionally not in the service-worker precache; only the small loader and index are cached for offline navigation.

## Update and rebuild

1. Export the current question array to a temporary JSON file.
2. Run `node scripts/split-question-bank.js path/to/export.json`.
3. Review `question-bank/manifest.json` and all changed chunk files; run `node tests/unit/test_question_bank_chunks.js`.
4. Deploy the updated `push-worker/worker.js` so an admin publish writes server-side class/subject chunks. Static fallback remains available until the Worker is updated.

To reconstruct a single JSON export for another tool, run `node scripts/join-question-bank.js path/to/output.json`.
