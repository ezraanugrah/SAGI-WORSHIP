# Phase 4 — Scriptures implementation review

Status: implemented for review; Phase 5 has not started. Application version 0.4.0. This work extends the reviewed Phase 1–3 foundation and uses the PRD and existing phase reports as its baseline. No Git initialization, commits, pushes, deployment, external runtime services, dependency upgrades, or database migration were performed.

## Implemented features

- Local authorized dataset import through the Alkitab library: select JSON, validate in a worker, inspect metadata/notice/attribution/checksum, explicitly attest rights, then commit. Cancel terminates validation or aborts the active import transaction. Imports remain coordinated above dashboard routes.
- Translation/book/chapter browsing, individual and multiple checkbox selection, chapter/range/reference selection using imported aliases, and offline Unicode literal text search. Maximum 500 selected verses; selections deduplicate and follow catalog order. Numeric ranges containing missing coordinates fail explicitly.
- Immutable editions imported side by side; identical/conflicting edition imports never overwrite an existing dataset. Dataset deletion explicitly confirms permanent source removal and associated schedule cleanup.
- Mixed song/Scripture schedules use existing create/rename/duplicate/delete, item removal, drag-and-drop and keyboard-accessible move buttons. Scripture items preserve dataset checksum and selected verse identities.
- Scripture Preview and LIVE use the established deck/controller/16:9 renderer. Every verse begins a new sequence; long verses paginate into exact original-text slices. Every continuation carries reference, translation abbreviation/edition, required attribution, and part number. Scripture text is read-only in Preview; supported style changes affect only Preview until Go Live.
- Source import/deletion, schedule changes, search, preferences, and Preview navigation cannot mutate frozen LIVE. Frozen checkpoints retain selected verse text and license metadata after source deletion. Emergency Black and explicit Resume/Discard remain governed by the Phase 3 authority model.
- Responsive black/white/amber library, offline production shell, and local worker assets. No copyrighted Bible dataset is bundled or downloaded. Automated material is original synthetic text only.

## Architecture and data model

IndexedDB remains **schema v1** with the same 12 object stores and no new indexes. Existing song, preference, draft, override, and schedule records are not rewritten at startup.

| Store / boundary         | Phase 4 behavior                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripture_translations` | One `format: 1`, `revision: 1` record per immutable edition: generated local ID, full supplier metadata/license, catalog manifest, content/file SHA-256, verse count, file size, import/attestation timestamps.                                              |
| `scripture_verses`       | One record per original coordinate/text, scoped to local dataset ID, with catalog order and per-verse coordinate/text SHA-256. Primary-key prefixes supply chapter/dataset range scans without schema indexes.                                               |
| `schedule_items`         | Existing `type: song` records remain unchanged; new `type: scripture` union holds dataset ID, checksum, ordered verse IDs, and canonical display label.                                                                                                      |
| Presentation decks       | Legacy song shape remains accepted; typed Scripture frames add exact original text, references, translation, attribution and continuation data. A license table retains complete selected-edition usage metadata.                                            |
| `live_session_state`     | Existing checkpoint key remains. Legacy song-only `format: 1` checkpoints are read without rewriting; new explicit presentation writes use `format: 2`.                                                                                                      |
| Projector protocol       | New windows speak v2 full-state messages. Session/epoch/pair/document nonce/sequence validation remains. v1 cannot carry Scripture decks; incompatible windows fail safely rather than displaying an incomplete citation. Reload both windows after updates. |

Import validates before opening its write transaction, then adds manifest and all verses in **one** transaction across both stores. WriterGate captures an ownership epoch at entry, revalidates it across asynchronous preparation, tracks the transaction, and aborts on revocation. Cancellation is specific to the import. All duplicate/conflict checks occur inside the transaction; failures preserve previous data. Free-space estimation is a conservative preflight, with transaction rollback handling actual storage failures.

Adding a Scripture item resolves and hashes selected content first, then checks schedule revision and unchanged source content inside a guarded multi-store transaction. Deleting a dataset updates all affected schedules/items and deletes verse/translation records in one transaction; any final-write failure rolls back earlier changes. Existing revision checks protect schedule operations and existing autosave remains unchanged.

Presentation preparation resolves only required sources from a consistent read transaction, then checks selected verse hashes. Global workspace loads contain translation metadata, not entire corpora. Prepared/LIVE decks are independent clones. Source removal marks the Preview stale but does not replace it or LIVE. Changes require preparing again and explicit authorized Go Live.

Search uses a disposable worker-local normalized cache for one translation, bounded to an estimated 64 MiB. Larger corpora or unavailable worker construction fall back to bounded database batch scans. Results are paged at 100; request/generation guards discard obsolete responses. Search is literal substring matching, not a persistent full-text/linguistic index.

## Files

New modules: `src/scriptures/{models,importFormat,importCoordinator,import.worker,references,search.worker,searchClient}.ts`, `src/data/scriptureRepository.ts`, `src/hooks/useScriptures.ts`, `src/components/{ScriptureImportDialog,ScripturesLibrary}.tsx`, and `src/presentation/scriptureAdapter.ts`.

Integration changes: `src/domain/models.ts`, `src/data/{repository,presentationRepository}.ts`, `src/presentation/{models,layout,generateSlides,controller,protocol,windowManager}.ts`, `src/projector/ProjectorApp.tsx`, `src/components/{SlideCanvas,PreviewWorkspace,SchedulePanel,Phase2Dashboard}.tsx`, `src/App.tsx`, and `src/style.css`. Package/lock root version metadata is 0.4.0; dependency versions are unchanged.

Tests/documentation: `src/scriptures/{testFixtures,scriptures.test}.ts`, `e2e/phase4.spec.ts`, `docs/SCRIPTURE-DATASET.md`, this report, README and evidence. One existing protocol rejection test now uses version 99 because version 2 is supported. Existing Phase 1–3 test coverage is retained.

## Validation and security

The exact format, limits and canonical hashing procedure are documented in [SCRIPTURE-DATASET.md](SCRIPTURE-DATASET.md).

Validated rejection cases include malformed UTF-8/JSON, unknown format/version/fields, invalid permissions, unsupported licensing fields, empty/oversized input, invalid language/catalog IDs, ambiguous aliases, duplicate/reordered/missing verse content, manifest mismatches, checksum tampering, unpaired Unicode surrogates, conflicting edition identities, and corrupted stored metadata/text. Partial manifests are allowed as explicit supplier declarations; no canonical Bible dataset is assumed or used to silently fill gaps.

Text is stored/displayed without normalization or correction. Search alone normalizes copies. Pages concatenate exactly to original verse text, including CRLF and spaces. Projection validation verifies all continuation parts reconstruct the original and match retained attribution/translation. Overrides cannot replace Scripture text. Actual body/footer overflow rejects normal output and preserves the last rendered frame rather than clipping required attribution silently. Black and Clear Text hide the entire body/footer and bypass fit checks, so overflowing hidden text cannot block these controls.

SHA-256 is an integrity check, not publisher authentication or proof of rights. Permission declarations plus user attestation are recorded, but the application cannot establish legal entitlement or verify supplier completeness. Licenses requiring conditions outside offline storage/projection/local snapshots and a fixed displayed attribution need a separate review; they must not be bypassed by editing metadata. `export` permission is retained but does not enable export. Source/reference strings are plain text, never automatically opened or fetched. React escapes imported text; no HTML/script execution path is added.

All dataset/schedule/checkpoint/LIVE mutations require WriterGate at the repository/controller boundary. Secondary tabs can browse/prepare Preview but cannot import/delete or replace LIVE. Projector bootstrap continues to avoid acquiring writer authority or opening the workspace database. Existing exact-origin postMessage and paired BroadcastChannel paths remain; pairing is coordination within a trusted same-origin application, not protection against arbitrary malicious same-origin code or developer-tools modification of both data and hashes.

## Verification evidence

Final verification commands and results are recorded under `docs/evidence/`:

| Check            | Result / evidence                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| TypeScript       | Passed: `phase-4-typecheck.txt`.                                                                                   |
| Unit/integration | 76 passed across 7 files: `phase-4-unit.txt`.                                                                      |
| Production build | Passed; service worker precaches both import/search workers: `phase-4-build.txt`.                                  |
| Playwright       | 40 passed (56.9s): `phase-4-e2e.txt`; all 31 Phase 2/3 regressions plus 9 Phase 4 tests.                           |
| Runtime audit    | 0 vulnerabilities: `phase-4-runtime-audit.json`.                                                                   |
| Full audit       | 9 development findings (2 low, 7 moderate; no high/critical): `phase-4-full-audit.json`. Exit 1 reflects findings. |

Unit/integration tests cover strict import content/permission validation, exact Unicode/CRLF pagination, reload and schema-v1 preservation, reference aliases/ranges/missing verses, offline text matching, read-only and revoked authorization, duplicate/conflicting editions, quota rollback preserving an existing dataset, cancellation/ownership-loss rollback, mixed schedule operations, failure at the final dataset-deletion write rolling back schedule revisions/items, corruption preservation, immutable LIVE after deletion, and legacy song checkpoint compatibility. Malformed deck collections fail validation without throwing.

Playwright uses fresh contexts and production PWA assets. Phase 4 coverage includes consent/cancellation/duplicate protection, offline file import/search/reload, real operator/projector windows, source deletion retaining frozen LIVE, projector refresh, explicit offline checkpoint Resume, stale/duplicate/malformed/legacy-version messages, quota refusal, stored corruption, read-only secondary tabs, mixed schedule duplication/keyboard/drag order and navigation across song/Scripture boundaries, mobile layout, exact long-passage reconstruction across ten audience frames, and emergency Black after footer overflow. Existing regressions additionally exercise interrupted communication, window close/reopen, popup/fullscreen denial, fallback transport, writer loss, Black during checkpoint failure, and offline recovery.

Unit tests use unique temporary databases and delete only those names. E2E uses isolated browser profiles; no tests read or erase the user's browser workspace. No external translation text is used. Desktop/mobile/projector screenshots are `phase4-desktop.png`, `phase4-mobile.png`, and `phase4-projector.png` in `docs/evidence/`; mobile and projector screenshots were visually inspected. Playwright HTML/trace artifacts remain in the configured report/test-results directories.

## Dependency findings

Unresolved development/build-chain findings remain in `workbox-build`, `@rollup/plugin-node-resolve`, `deepmerge`, `@trickfilm400/rollup-plugin-off-main-thread`, `ejs`, `jake`, `filelist`, `glob`, and `minimatch`. They match the existing Phase 3 audit totals. No force fixes or unrelated upgrades were applied. Reassess and approve the build-chain remediation separately before release. The npm audit is not a full security assessment.

## Known limitations and remaining manual QA

- Only the documented JSON v1 is supported. There is no USFM/OSIS/SQLite import, automatic conversion, download, cross-translation comparison, nonnumeric verse identity, or inferred canonical completeness. Metadata `complete` is not independently certified.
- Test fixtures are small except the long-passage case. Validate a real authorized corpus near the 32 MiB/100,000-verse bounds on the intended low-memory device; inspect parse/hash duration, storage amplification and search responsiveness. Limits intentionally reject larger files; no unapproved staging architecture or migration was added.
- Storage estimates are advisory and browser quota/eviction behavior differs. Browser profile/origin changes or cleared site data lose imported data. Persistent-storage permission is best effort. Keep original authorized files; dataset backup/export/repair remain future work. Corrupt data is preserved and reported rather than repaired automatically.
- A dataset's removal does not erase existing frozen quotations/checkpoints. This is why local snapshot permission is required. Use explicit checkpoint discard and stop/replace LIVE when retention is no longer appropriate; there is no dataset-wide legal revocation/secure-erasure workflow.
- A verse can occupy multiple slides; body/font metrics and footer capacity are bounded. Large fixed attribution or unusual fonts may be rejected at render time. Verify every target language, bidi/script behavior, grapheme wrapping, system font fallback, exact reference and attribution on a real projector. No automatic reduction/hiding of attribution is implemented.
- Runtime corpus integrity checks detect missing/tampered records encountered by reads, not hostile coordinated rewriting of data/hashes. No digital signature trust store is provided.
- Automated browser coverage targets headless Chromium. Manually test target Chrome/Edge and other intended browsers, installed PWA windows, popup permission, fullscreen entry/Escape, monitor selection/removal, OS scaling, extended disconnect/background recovery, and a real second display. Browser permission tests do not certify physical projector behavior.
- Legacy song records/checkpoints remain readable, but an old application build cannot understand v2 Scripture records/protocol. Close old output and reload both windows after accepting a PWA update; never use a stale output to display Scripture. A fresh/refreshed output starts black until a valid full snapshot arrives; established output retains its last valid frame during interruption.
- Durable checkpoints may lag the last audience frame after crash/storage failure; recovery is explicit and uses the last complete saved snapshot. No automatic resume/takeover was added.

## Scope and deviations

No destructive migration or significant architectural expansion was needed. Primary-key range scans preserve schema v1, and worker search uses bounded cache/batch fallback rather than adding persistent search indexes. Existing dashboard/file names remain to avoid unrelated refactoring. Only root application version metadata changed; no dependency versions changed.

Media, PDF/PPTX, video/audio, cloud APIs, broad Themes, backup/repair, and Phase 5 are excluded. **Stop for Phase 4 review. Phase 5 requires separate explicit authorization.**
