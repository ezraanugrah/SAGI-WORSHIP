# Phase 7 — Backup, Restore, Recovery & Security

Date: 1 November 2026 (Asia/Jakarta). Application 0.7.0. Implements the conditionally approved Phase 7 architecture. No production schema migration, reset/reseed, destructive workspace replacement, cloud service, encryption, production dependency addition/upgrade, Git initialization/commit/push, deployment or Phase 8 work.

## Implemented features

- Portable version-1 `.sagibak` archives with canonical UTF-8 records, integrity manifest, ordered raw binary chunks, completion trailer, bounded processing and explicit completeness/omissions.
- Consistent durable multi-store backup, including eligible songs/sections, repeated ordering, schedules/items, authorized Scripture, original media/thumbnails/PDF rasters, themes, settings, drafts, tombstones, override formats 1–2 and checkpoint formats 1–4. Operational receipts are excluded from recursive archives; supported recovery candidates are included.
- Backup can run during LIVE without publishing/flushing/replacing audience state. File output uses an optional user-selected writable stream, with a smaller download fallback. A separately selected file is reopened and fully verified, not trusted from its extension.
- Local verification worker, cancellation, explicit partial-backup confirmation and Scripture-license filtering through datasets, snapshots and checkpoints, including snapshots whose sources were deleted.
- Isolated staging database and discoverable journal. Readiness requires all batches to finish; source fingerprint/count must match before a restore preview can be used.
- Fresh restore, keep-existing merge, and bounded safe keep-both remapping. Plans disclose created/retained/duplicated/skipped aggregates; unsafe identity/draft/override/edition associations fail closed.
- Explicit impact/rights confirmation, End Session/projector-closure requirement and a single atomic destination transaction including pins and completion receipt. Publication never changes a running LIVE snapshot.
- Incoming checkpoint candidates, explicit candidate selection preserving the previous checkpoint, new presentation pairing, paused recovery and required reload after successful restore to block queued stale editor work.
- Read-only Storage Health metadata/full-integrity scans, retained-owner explanations, corrupt/unknown/missing/orphan findings and individually confirmed missing-pin repairs. No automatic orphan expiry, guessed text, unknown-record erasure or destructive repair.
- Offline/responsive Settings UI in the existing black/white/amber design. Existing PWA prompt/update behavior and schema-v1 stores remain.

## Architecture and safety guarantees

Production database remains `sagi-worship`, version **1**, same twelve stores/key paths, no new indexes. `backup_manifest` now holds namespaced staging journals, publication/repair receipts and recovery candidates. Temporary staging databases use unique `sagi-phase7-stage-UUID` names and the same store layout. Only explicitly registered staging names can be deleted through this UI.

WriterGate adds exclusive maintenance permits. Entry rejects active tracked transactions, advances the ticket epoch, and prevents ordinary repository tickets while publication/repair is active. Older async tickets cannot mutate under the new epoch. Every final transaction is tracked for abort on ownership loss. Restore/repair plans are private service-held snapshots; callers publish a confirmed plan ID rather than arbitrary mutable row data. New previews replace old cached plans.

All archive/staging/source hashes and expensive work occur before destination publication. Destination rows are compared again inside the transaction to catch changes between preview/validation and maintenance entry. Writer authorization, session readiness and cancellation are rechecked. Any final-write/quota/revocation failure aborts the entire destination transaction. User data and completion receipt commit together. Strict durability is requested where supported; this is not protection from disk failure, site-data clearing or browser eviction.

Staging starts `preparing` with expected fingerprint/count and becomes `ready` only after all batches complete. Failed/interrupted staging may consume isolated storage but cannot become an implicit partial workspace restore. There is no automatic replay or database-pointer switch. The durable receipt distinguishes completed publication from a retained staging journal. The UI requires original-file revalidation to begin again after restart; staging cleanup is explicit.

End Session sends Black where possible, drains checkpoint work, closes the owned output and retires session/epoch/pairing. A newer presentation intent cancels a delayed End Session. It does not overwrite an active LIVE snapshot with restored content. End Session changes durable state and therefore invalidates the prior restore preview/confirmation. An inaccessible old projector may retain its last frame; close it manually.

Fresh restored checkpoints remain explicit recovery decisions. Merge preserves the destination checkpoint and adds incoming candidates. Candidate selection preserves an old valid checkpoint as another candidate; pins protect both. Playback targets are neutralized and video/background motion is paused on activation/recovery. No saved transport pairing capability or old window is commandeered. After successful restore the operator is read-only until reload, preventing old editor jobs from acquiring fresh authority against restored content.

The media cleanup collector now validates recovery candidates/pins and known operational journal types as well as prior theme/checkpoint roots. Unknown/corrupt recovery records block cleanup. Imported session/preparation pins receive conservative retained ownership rather than being reactivated as current sessions. No automatic cleanup runs as part of restore.

## Validation and licensing

Exact supported fields, aggregate relationships, legacy versions, theme signatures, verse/catalog/content hashes, asset references and payload bytes are validated. Canonical JSON disallows duplicate/ambiguous fields; prototype-related keys, future formats, malformed/truncated files, duplicate rows, unknown records, invalid offsets/order/lengths and excess processing sizes fail safely.

A complete backup is possible only for eligible supported content within limits. Restricted Scripture causes explicit whole-aggregate omissions: dataset/verses, affected schedules/items/active selection and frozen checkpoints/candidates. Their quoted text is not exported through a checkpoint loophole. Partial manifests remain visible during restore preparation. User attestation does not establish legal entitlement or publisher authenticity; unsupported rights conditions need review. No restricted sample corpus is bundled.

Media integrity checks do not certify a target machine's codec availability, future video frames, fonts or audible output. Existing parser/decoder/render guards continue to preserve established output when a candidate cannot render.

## Verification evidence

All evidence is under `docs/evidence/`:

| Check | Result / file |
| --- | --- |
| TypeScript | Passed, `phase-7-typecheck.txt` |
| Unit/integration | **131 passed, 10 files**: all previous 104 plus 27 Phase 7 tests, `phase-7-unit.txt` |
| Production build | Passed; backup worker and existing PDF assets offline precached, `phase-7-build.txt` |
| Playwright | **64 passed**: all previous 54 plus 10 Phase 7 scenarios, `phase-7-e2e.txt` |
| Runtime audit | **0**, `phase-7-runtime-audit.json` |
| Full audit | **9 development findings: 2 low, 7 moderate, 0 high/critical**, `phase-7-full-audit.json` |

Unit/integration tests cover full mixed round trips, native Blob bytes and 9 MiB multi-chunk processing, exportable Scripture/theme/checkpoint preservation, restricted/deleted-source snapshot filtering, malicious/truncated/corrupt/future files, readonly authorization, maintenance epochs, quota rollback at the final receipt, cancellation/revocation inside publication, changed source/destination plans, safe keep-both child mapping, tombstones/unsafe overrides, staging interruption/removal, pin repair, corruption preservation, explicit candidate selection and legacy checkpoints 1–3/drafts/tombstones. Databases use unique temporary names and cleanup targets only those fixture databases.

Phase 7 browser scenarios use production PWA assets and isolated profiles:

1. Offline transfer of song override, mixed schedule, exportable synthetic Scripture, image, PDF/retained page rasters, theme and settings to a fresh profile on a second local origin.
2. Backup during LIVE, unchanged audience content, restore refusal until End Session, projector retirement and explicit recovery after reload.
3. Restricted Scripture partial-export disclosure with no verse text in the archive.
4. Malformed archive, cancelled confirmation and read-only secondary-tab refusal.
5. Safe keep-both song/section merge with both source and destination preserved.
6. Discoverable staging after reload, confirmed removal, unknown-record health finding and responsive layouts.
7. Portable video checkpoint, explicit offline Resume, separate real projector window and paused refresh/recovery.
8. Bounded streaming file-sink writes and reopening produced bytes for verification.
9. Real IndexedDB final-receipt quota injection proving whole-transaction rollback and explicit retry.
10. Full-integrity missing-theme-pin review/repair with no byte deletion.

Fixtures are original synthetic text/images/video/PDF; no copyrighted translation is added. Existing Phase 1–6 regression scenarios remain unchanged. The first complete run exposed a property-order-dependent style comparison: canonical backup JSON retained an override but prevented its application. Controller loading now compares styles canonically; a dedicated portable-override regression covers it. No tests access or reset a user's browser profile. Headless file-sink tests use a controlled writable adapter; actual OS file-picker/disk semantics remain manual QA. `phase7-mobile.png` was visually inspected; 320/768/1440 viewport checks passed.

## Dependency/security results

No dependency version was changed. Package/lock root metadata advances to 0.7.0. Runtime audit is clean; the nine existing Workbox/build-chain affected-package findings remain. The three underlying advisory families, locked versions, API/Node compatibility risks and approval-gated remediation options are documented in [SECURITY.md](SECURITY.md). No force fixes, major overrides, service-worker replacement or new production package were applied.

Threat review covers parser/resource limits, repository/maintenance authorization, stale jobs, projector isolation/new pairings, licensing, integrity/retention and PWA/storage boundaries. Hashes detect accidental changes, not coordinated malicious rewriting. Read-only projector capability is not confidentiality against arbitrary same-origin scripts, privileged extensions or a compromised executable build.

## Limits, deviations and remaining manual QA

- Initial ceilings: 2 GiB archive, 64 MiB row metadata, 8 MiB manifest, 250,000 rows, 4,096 payloads, 4 MiB binary chunks, 17 MiB JSON wrapper entry and 256 MiB non-streaming download fallback. Existing per-media/dataset/deck limits remain. Limits are refusal bounds, not performance guarantees.
- Staging plus publication requires extra origin quota; browser-internal Blob copies/structured clones and metadata overhead can amplify memory/storage. Automated tests include 9 MiB chunked content and injected failures, not a 2 GiB hardware qualification. Benchmark near-limit real authorized workspaces on target low-memory devices. If atomic publication proves unreliable, stop for architectural/limit review; never adopt partial publication silently.
- Keep-both intentionally rejects unsafe overrides/drafts, ambiguous identities and conflicting immutable/Scripture identities rather than guessing. Existing settings win during merge. There is no automatic overwrite mode, arbitrary field merge or salvage adapter for corrupt/future archives.
- Only verified missing/incomplete retention pins can be repaired. Unknown/corrupt data and potentially orphaned session pins remain preserved; there is no bulk destructive repair, secure deletion, undelete/forensics or automatic garbage collection. Diagnostics do not reconstruct missing source text/media bytes.
- The local worker verifies archives. Backup creation/diagnostics use asynchronous bounded hashing but some metadata canonicalization/graph work remains on the operator thread. Large-library latency and memory must be measured on target hardware.
- A backup contains durable records, not unsaved editor memory, executable application caches, OS permissions, browser fonts/codecs or arbitrary in-memory Preview. The saved checkpoint can lag LIVE. File transfer requires the destination app to be installed/cached first.
- Native OS file-save cancel/disk-full/removable-drive behavior, real storage pressure, browser/OS termination and power interruption remain manual QA. Successful download initiation alone is not verified external retention. Reopen the saved file.
- Test supported Chrome/Edge/installed-PWA variants, private/evictable storage, physical projector/audio, mixed image/video themes, different fonts/OS scaling, and stale unreachable output windows. Old output cannot be remotely erased across an unavailable session/origin.
- Password protection/encryption, cloud sync, scheduled backup, production PPTX, destructive replacement and Phase 8 are excluded. No dependency remediation requiring separate approval was attempted.

The approved staging/atomic architecture is preserved. Conservative implementation choices include fresh-only exact override association where conflicting merges cannot be proved safe, retained ambiguous pins, and post-restore read-only-until-reload. These protect data rather than silently broadening restore behavior.

## Files

New: `src/backup/{models,container,validation,bookkeeping,workerClient,backup.worker,backup.test}.ts`, `src/recovery/{restorePlan,diagnostics}.ts`, `src/data/{backupRepository,restoreRepository,healthRepository}.ts`, `src/components/BackupRecovery.tsx`, `e2e/phase7.spec.ts`, this report, [BACKUP-FORMAT.md](BACKUP-FORMAT.md), [RECOVERY.md](RECOVERY.md), [SECURITY.md](SECURITY.md), and evidence.

Modified: WriterGate maintenance, presentation controller/window lifecycle, override validator export, media retention/candidate collector, App/Settings integration, stylesheet, README and root version metadata. Production database schema and dependency versions are unchanged.

**Stop for Phase 7 review. Phase 8 requires separate explicit authorization.**

## Targeted merge correction — 2 November 2026

The final review found a blocking defect in the original implementation: conflict detection compared individual Song/Schedule parent rows. Equal parents with different child sections/items could be reused incorrectly. Keep-existing could import a dependent schedule against destination lyrics; keep-both could remap a child without its parent and fail final validation. Child-only conflicts could also bypass the unsafe-override check. The original passing evidence above did not cover this case and was not sufficient for Phase 7 approval.

Before implementation changes, four new regression tests failed against the original planner (`docs/evidence/phase-7-merge-before.txt`). The focused correction is confined to `src/recovery/restorePlan.ts`:

- Canonical, cached SHA-256 aggregate signatures include Song metadata, every owned section and content, section identity/order and repeated playback order. Schedule signatures include metadata, every owned item, item order, repeated song occurrences, assignments and resolved Song/theme/media/Scripture-translation dependencies. Existing full validation checks media bytes and Scripture verse/content hashes before signatures are used. Binary Blobs are not serialized into signatures.
- Conflicting child IDs promote conflict handling to their incoming parent, including collisions under new parent IDs. Keep-existing skips the entire conflicting parent/children and dependent schedules. Keep-both duplicates parents and all children, remapping section lists/order, schedule item lists, parent/source references and theme assignments. Final graph validation remains mandatory.
- Unsafe override refusal now includes skipped Schedule/section/item conflicts. No override-signature migration was added: unchanged identities retain compatible overrides; a conflicting/remapped graph with incoming overrides is explicitly rejected. Draft/ambiguous-identity refusal remains conservative.

Regression coverage adds eight in-memory aggregate tests and six repository integration tests. It covers equal-parent/different-child conflicts, repeated sections/occurrences, ordered section lists, theme assignments, child collisions under new parents, unchanged compatible overrides, unsafe override refusal, successful mixed-content merge, destination/tombstone preservation, immutable media/Scripture reference reuse, and populated-destination rollback under receipt quota failure, cancellation, ownership loss, stale destination revision and the maintenance barrier. Existing legacy-checkpoint, authorization and failure tests remain.

Only restore planning, tests, these review documents and evidence were edited. No database/schema, publication transaction, WriterGate, checkpoint validator, presentation behavior or dependency manifest/lock changes were made. Fixture databases have unique temporary names; no existing browser profile or production user data was opened/reset. The successful mixed-content integration test checks schema version 1 and the same twelve stores after publication.

Correction verification evidence (supersedes initial counts for this revision):

| Check | Result / file under `docs/evidence/` |
| --- | --- |
| Before-fix regression | 4 expected failures, `phase-7-merge-before.txt` |
| Targeted backup/merge tests | 41 passed, `phase-7-merge-targeted.txt` |
| All unit/integration | 145 passed, 11 files, `phase-7-merge-unit.txt` |
| TypeScript | Passed, `phase-7-merge-typecheck.txt` |
| Production build | Passed, PWA generated, `phase-7-merge-build.txt` |
| Full Chromium E2E | 64 passed, `phase-7-merge-e2e.txt` |
| Runtime dependency audit | 0 findings, `phase-7-merge-runtime-audit.json` |
| Full dependency audit | 9 development findings, 2 low / 7 moderate, no high/critical; expected exit 1, `phase-7-merge-full-audit.json` |

Network-restricted audit attempts and local-server sandbox restrictions required rerunning with authorized network/server access. No dependency installation, upgrade or remediation occurred. Audit reports match the initial affected-package/severity findings.

Remaining limits: aggregate hashing adds preview work; near-limit target-hardware performance remains unqualified. Unsafe override/draft remapping still fails closed, and rejected preview does not publish any destination data. Physical hardware, actual OS file-picker/disk-full/power-loss behavior and cross-browser qualification remain manual QA. No Phase 8 work, Git operation or deployment was performed. **Stop for Phase 7 re-review; this correction is not release approval.**
