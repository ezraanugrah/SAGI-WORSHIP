# Backup, restore and conservative recovery

Phase 7 preserves production `sagi-worship` schema v1 and its twelve stores. No startup migration, reset, reseed or destructive workspace replacement is performed.

## Operator workflow

1. Save/close editors. **Buat backup .sagibak** captures the durable multi-store snapshot; in-memory drafts and an audience frame newer than its durable checkpoint are not promised.
2. Review restricted-content omissions. A partial archive requires separate confirmation. Store the file safely and reopen it with **Verifikasi file**.
3. On the destination, install/cache a matching application build first. The archive does not contain an executable PWA installer, fonts, codecs, browser permissions or a service-worker cache.
4. Choose the file and **Siapkan restore**. Parsing/integrity validation uses a local worker. An isolated, uniquely named temporary database receives bounded staging batches.
5. Choose **Workspace kosong**, **Merge · pertahankan data tujuan**, or **Merge · simpan keduanya jika aman**. Review the complete plan and licensing/impact confirmation.
6. Explicit **End Session** sends Black where possible, waits for the checkpoint queue, closes the owned output and retires its pairing. Black alone is insufficient. Close unrelated/stale projector windows manually. End Session changes durable state, so preview/confirm again afterwards.
7. Publish the accepted plan. Do not navigate away; cancellation before transaction completion aborts publication. A completed transaction cannot be undone by a late cancel.
8. The operator becomes read-only after successful restore. Reload before editing or selecting recovery. Nothing becomes LIVE automatically. Resume/Discard is explicit and video/background playback starts paused.

Backup and read-only scans can run during LIVE. Restore publication, candidate activation and repairs require an explicitly ended session with no owned projector or preparation underway.

## Atomicity and staging

A staging journal in `backup_manifest` begins `preparing`, with the expected validated snapshot fingerprint and record count. Only after all staging batches finish does it become `ready`. Preview requires readiness, exact count/fingerprint and full validation. An interrupted partial staging set cannot be promoted merely because its surviving records are individually valid.

Destination publication is one tracked read/write transaction across all twelve existing stores. It rechecks destination records inside the transaction, checks WriterGate/maintenance authority and cancellation, writes the planned rows/dependency pins, then writes a completion receipt. Hashing, file reads, staging reads and decoding happen outside that transaction. There are no partial destination batches or database-pointer swaps.

Any transaction failure, quota exhaustion or authority loss rolls back all destination writes, including the receipt and pins. Existing content remains. The isolated staging job may remain; it never becomes canonical user data without successful publication.

The receipt commits with user data. After interruption, a receipt establishes completion; a staging journal alone does not. No operation is automatically replayed after restart. Staging remains discoverable after reload and is removed only by the explicit **Hapus staging** confirmation. There is no automatic expiry or deletion of an arbitrary database name.

Browser quota estimates and persistent-storage permission are best effort. Staging plus publication can require approximately two incoming copies, existing data and browser overhead. IndexedDB atomicity does not guarantee survival of disk failure, OS power loss, browser eviction or clearing site data. Strict transaction durability is requested for publication where supported.

## Conflict policy

- Fresh mode requires an empty content snapshot; operational journals/receipts do not count as user content. Stable content identities and legacy formats are preserved.
- Keep-existing imports only nonconflicting aggregates, reuses exactly equal records, and discloses skipped sources/dependent schedules. It does not silently retarget incoming schedules to a conflicting source.
- Keep-both can remap conflicting songs/sections, schedules/items and custom themes/assignments. Child identities are remapped even if their old bytes happened to match. Source order and repetitions remain unchanged.
- Destination tombstones are retained; permitted keep-both duplication creates a fresh identity. An incoming tombstone cannot erase a destination source.
- Immutable payload conflicts, ambiguous cross-store identities, conflicting Scripture edition identities, conflicting drafts and unsafe override/signature remapping are rejected when the final graph cannot be proven safe. There is no guessing or automatic text merge.
- Merge preserves existing destination settings. Missing settings can be imported and remapped. Fresh restore imports backed-up settings.
- Existing valid checkpoints are never overwritten by an ordinary merge. Incoming checkpoints become recoverable candidates with their own retention pins. Explicit candidate selection preserves the old checkpoint as another candidate, then offers Resume/Discard. Session IDs/playback targets are neutralized for activation and pairing capabilities are newly generated.
- Current implementation conservatively refuses a conflicting merge with overrides when safe source/signature association is not provable. Use a fresh workspace to retain the entire original association.

## Storage Health

Metadata scan checks supported structures/relationships and reports retention ownership; it is not a full byte-integrity certification. Full scan hashes media and verifies content/signatures. Findings distinguish invalid/unknown data, missing/corrupt dependencies, missing pins and apparently unowned payloads. Pins explain theme/checkpoint/candidate/PDF/Preview/LIVE/archive retention; a stale-looking session is not proof of abandonment.

The only automatic repair primitive exposed after explicit review/confirmation is rebuilding a missing/incomplete pin from valid owners and fully verified dependencies. It captures a scan fingerprint, performs another full scan and rechecks state under maintenance authority, then commits pin and repair receipt together. No bytes are erased.

Corrupt/unknown owners block repair and cleanup. Orphan pins/payloads are preserved for review; no age-based release, destructive repair, guessed text, forensic recovery or bulk workspace replacement is provided. Existing user-confirmed unreferenced-media cleanup remains conservative and now also protects recovery candidates; it refuses unknown recovery records.

Keep original authorized media and verified external backups. Browser-local pins and temporary databases are not independent backups.

## Aggregate conflict correction (2 November 2026)

Restore comparison now includes complete Song sections/content and ordered/repeated section references, and complete Schedule items/order plus resolved Song, theme, media and Scripture dependencies. Identical parent metadata alone does not establish compatibility. Child identity collisions also belong to their parent aggregate.

Keep-existing skips conflicting parent/child aggregates and affected incoming schedules rather than attaching them to incompatible destination content. Keep-both duplicates the required parents/children and remaps ordering, source references and theme assignments together. Destination content and tombstones remain preserved; valid immutable media/Scripture references are reused. The final combined graph must validate before publication.

Compatible overrides remain unchanged only when their identities/associations remain unchanged. Incoming overrides combined with unsafe conflict/remapping requirements are explicitly rejected, including child-only or Schedule conflicts. No signature reconstruction or heuristic retargeting is provided. Remove ambiguity or restore into a fresh workspace; a rejected preview has not published data. Atomic publication, maintenance authorization and explicit checkpoint recovery remain unchanged. See the correction evidence in `PHASE-7.md`.
