# Phase 5 — Media Library review

Date: 1 November 2026 (Asia/Jakarta). Status: approved image/video/PDF scope implemented for review; PPTX remains evaluation-only and requires a separate production decision. Application version 0.5.0. Phase 6 has not started.

## Starting state and scope

Inspection on continuation found a partially implemented Phase 5: media modules, a pinned PDF.js dependency, presentation/checkpoint/protocol integration, synthetic tests and temporary PPTX evaluation evidence. There was no Phase 5 report or format guide. The last regression failure compared ephemeral object URLs rather than immutable retained content. That assertion was corrected to check asset identity; no audience-content corruption was hidden or accepted.

The implementation follows the approved IndexedDB-Blob approach, scoped read-only projector access and explicit authorization model. No database migration, reset/reseed, Git initialization, commit, push, deployment, cloud conversion, production PPTX renderer or unrelated dependency upgrade was performed.

## Implemented features

- Local multi-file image/video/PDF imports, sequential per-file validation, progress/status, cancellation, duplicate protection and atomic commit.
- JPG/JPEG, PNG and WebP signatures, MIME/extension checks, size/pixel limits, browser decode and thumbnails.
- Compatible MP4/WebM metadata/first-frame probing, duration/dimension bounds, poster thumbnails and explicit compatibility status. No claim that every codec or later frame is playable.
- Locally bundled PDF.js 6.4.299, matching worker, CMaps, standard fonts, ICC profile and WASM/decoder assets; no CDN runtime.
- Search/filter, metadata, paged cards, confirmed deletion, library/retained-byte estimates and conservative explicit cleanup.
- PDF page-thumbnail browsing, individual/range selection, bounded local rasterization, page navigation and immutable persisted presentation rasters.
- Mixed Song/Scripture/image/video/PDF schedules using existing duplicate, remove, drag ordering, keyboard alternatives and revision protections.
- Separate Preview media elements and video controls, explicit Go Live, silent operator LIVE monitor, projector-only LIVE audio, authorized Play/Pause/Loop/Mute/Volume.
- Black hides output and pauses/silences video immediately. It does not depend on decode success, storage estimation or checkpoint persistence. Restore does not automatically restart video.
- New/refreshed video output and explicit recovery start paused; old document playback commands cannot start a refreshed projector.

Supported formats, limits, retention and operational behavior are documented in [MEDIA-FORMATS.md](MEDIA-FORMATS.md).

## Architecture and persistence

IndexedDB remains `sagi-worship` **schema v1**, with the same 12 stores and original key paths. Existing Phase 1–4 records, preferences, drafts, overrides and legacy checkpoints are preserved. No startup migration rewrites them.

| Record / component         | Behavior                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `media_assets`: `meta:`    | Version-1 immutable asset metadata, title/filename/type, dimensions, finite duration or page count, compatibility, timestamps, original/thumbnail references.                         |
| `media_assets`: `blob:`    | Original bytes, thumbnail or PDF raster Blob, MIME/size and ordered 4 MiB SHA-256 chunk manifest/digest.                                                                              |
| `media_assets`: `pin:`     | Immutable references needed by prepared PDF pages, current Preview, LIVE decks and durable checkpoint. No blob copies inside pins.                                                    |
| `media_assets`: `deleted:` | Tombstones preventing late writes from restoring a deleted import identity.                                                                                                           |
| Schedule items             | New `type: media` union with immutable asset identity/checksum and bounded ordered page selection. Existing item forms remain accepted.                                               |
| Deck frames                | New media variant references immutable payload identity, expected dimensions/MIME/size and source/page identity. Existing Song/Scripture rendering and text overrides remain.         |
| LIVE playback              | Explicit frame/command revision, requested pause/position/loop/mute/volume and target projector nonce. Telemetry is separately validated.                                             |
| Checkpoints                | Read formats 1, 2 and 3; new writes use format 3. Existing key/revision ordering is retained. Checkpoint and its media pins commit atomically across two stores.                      |
| Synchronization            | Protocol v3; full snapshots contain references/control state, never Blob/base64/object URLs. Older formats remain supported for stored legacy content, not stale projector operation. |

Library loading reads metadata prefixes only. Hashing reads bounded slices and uses asynchronous Web Crypto rather than constructing a whole-file ArrayBuffer. Import captures a WriterGate ticket before asynchronous work, rechecks it at commit, and tracks the transaction for abort on ownership loss. All metadata and payload rows for one file commit together. Multi-file cancellation preserves already committed files and cancels unfinished files; the queue is not presented as a single atomic batch.

PDF selection renders outside write transactions, verifies source identity again, then commits all selected raster payloads and their preparation pin together. Combined selected raster bytes are bounded to 64 MiB. A stale/cancelled selection cannot become the current Preview. PDF preparation in a secondary tab is disabled because persistent raster writes require authority; read-only page browsing remains available.

Preparing a media deck pins Preview dependencies. Go Live pins LIVE dependencies before publication and checks a separate intent generation, so a delayed pin operation cannot override a newer Black/navigation action. Frozen asset identities do not retarget when library files are deleted or another same-named file is imported. Schedule deletion cleanup is atomic with metadata deletion; pin-protected bytes remain available.

Current-session retired LIVE pins are released only after the projector acknowledges replacement. Durable checkpoint pins remain independent; a failed replacement checkpoint retains the preceding checkpoint and dependencies. Cleanup computes references conservatively and refuses unknown/corrupt records. Crash-orphaned pins are retained, not expired automatically. This is deliberate data preservation rather than a complete Phase 7 repair system.

## Rendering, synchronization and recovery

`SlideCanvas` retains the 1920×1080 reference and existing text/Scripture paths. Media is contain-fit on black. A new media candidate is read/verified/decoded before replacing displayed media; stale loading generations are discarded. Invalid payloads, dimension mismatches and unsupported decoders preserve established output and report an error. Black bypasses decode requirements.

The projector's asset reader accepts only references present in the validated paired snapshot, uses read-only transactions, aborts database creation/upgrades and verifies integrity before decoding. It imports no WriterGate/mutation repository. Read-only access is a code boundary, not confidentiality against arbitrary same-origin scripts or privileged browser extensions.

Session, epoch, pair capability, document nonce and monotonically increasing state sequence checks remain. Playback commands additionally use frame identity, revision and target document nonce. Duplicate/full-state retries do not restart playback; control changes do not repeatedly seek an already loaded video. Feedback reports actual time, paused/ended status and errors. Invalid or stale feedback cannot change newer intent. Position checkpoints are throttled to about five seconds.

Established playback continues under the last accepted settings during interruption; a disconnected operator cannot guarantee delivery of Black or Pause. Newly opened/refreshed output starts black until a complete valid state arrives and video is paused until a fresh authorized Play for that document. Operator restart never takes over an existing audience window. Explicit Resume restores the saved frozen deck, with video paused. Last durable position may lag the crash.

Existing preferences supply defaults for newly prepared video; changing Settings does not mutate active LIVE. Preview has independent native playback/audio controls and a Loop Preview toggle. Browser autoplay/audio permission rejection is surfaced instead of being reported as successful playback. Headless success does not certify actual sound routing or fullscreen permissions.

## Verification

Evidence files are in `docs/evidence/`:

| Check            | Result / evidence                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| TypeScript       | Passed; `phase-5-typecheck.txt`.                                                                                          |
| Unit/integration | 90 passed across 8 files, including all 76 Phase 1–4 tests; `phase-5-unit.txt`.                                           |
| Production build | Passed; PDF worker/support assets precached; `phase-5-build.txt`.                                                         |
| Playwright       | 47 passed: all 40 Phase 1–4 scenarios plus 7 media scenarios; `phase-5-e2e.txt`.                                          |
| Runtime audit    | 0 vulnerabilities; `phase-5-runtime-audit.json`.                                                                          |
| Full audit       | 9 existing development findings: 2 low, 7 moderate, no high/critical; `phase-5-full-audit.json`. Exit 1 denotes findings. |

Unit/integration coverage includes unique-database isolation, schema-v1/preference preservation, metadata-only listing, exact duplicate refusal, scoped reads, blob integrity corruption, rollback when a final metadata write exceeds quota, cancellation and ownership loss inside a transaction, read-only mutation boundaries, mixed schedules, atomic source deletion rollback, immutable LIVE after deletion, checkpoint dependency failures preserving previous state, malformed pin cleanup refusal, delayed Go Live versus emergency Black, reference-aware reclamation and size/pixel limits. Legacy Song/Scripture checkpoint and override tests remain intact; their new-write format expectation now reflects format 3.

Playwright runs production assets with native operator/projector windows in fresh contexts. Media scenarios cover:

1. Image import/search/filter, Preview/LIVE isolation, deletion, cleanup, projector refresh and explicit checkpoint recovery.
2. Offline image/PDF import, selected-page rasterization, mixed media schedule duplication/keyboard/drag order, PDF navigation and projector refresh.
3. Synthetic video playback controls, pause/loop/mute/volume, Black/Restore and offline projector/operator recovery paused.
4. Invalid input/PPTX refusal, read-only secondary tabs and 320/768/1440 responsive layouts.
5. Corrupted media retaining the preceding valid audience asset, plus Black during checkpoint quota failure.
6. Duplicate/stale video snapshots unable to undo a newer Pause or replace current output.
7. Cancelled decode and quota preflight leaving no partial library entry, including reload.

Original synthetic images/video/PDF are generated by `e2e/mediaFixtures.ts`; no copyrighted media is bundled. Tests use random temporary unit database names and isolated browser profiles, not the user's browser workspace. Existing regressions additionally cover Song/Scripture workflows, source autosaves, writer loss, transport interruptions, stale messages, popup/fullscreen fallbacks and offline use.

Screenshots: `phase5-desktop.png`, `phase5-mobile.png`, `phase5-pdf-projector.png`. Mobile and PDF output were visually inspected. A focused responsive/read-only check also passed after the final input-field styling adjustment (`phase-5-responsive.txt`). HTML/trace artifacts use the existing Playwright report directories. Remaining hardware checks are below.

## PPTX feasibility gate — evaluation only

Isolated candidates: `@office-kit/pptx` **0.28.0** and `@office-kit/pptx-preview` **0.21.0**, MIT licenses. They were downloaded/installed only under `/tmp/sagi-pptx-evaluation`, with lifecycle scripts disabled. They are absent from SAGI's production package/lock dependency graph. No production importer, SVG injection path or PPTX playback feature was added.

The candidate's browser entry can render an in-memory presentation to SVG without its Node-only rasterizer. The evaluated package also declares Node-side `fontkit`/`@resvg/resvg-js` dependencies; a production review would need to distinguish browser bundle contents from the complete install graph. The isolated audit reported zero known dependency vulnerabilities, not a security clearance.

An original two-slide fixture exercised text, a missing font, rotated multiline Unicode/CJK text and a chart. Browser evaluation loaded/saved the PPTX, rendered pure-SVG images, rejected malformed ZIP input and an intentionally exceeded entry limit, made no nonlocal requests and rerendered after the browser context went offline. Bundle size was approximately 693 kB minified / 177 kB gzip. Timings and the coarse heap observation are in `phase5-pptx-evaluation.json`; these are small-fixture observations, not large-file guarantees.

The prototype was corrected to use the documented `font` and text-measurement APIs before preserving final results; an earlier harness mismatch is not evidence of a renderer defect. Missing fonts are substituted. There is no PowerPoint/LibreOffice visual-diff baseline, complete complex-layout validation or exhaustive hostile ZIP/XML test corpus. Animation, transition, embedded media, OLE/macros and external-resource safety have not passed a production gate. The candidate documents configurable archive expansion/XML limits, but the evaluation only verifies the simple bounds above.

**Conclusion:** basic offline browser rendering is feasible; production fidelity/security is not established. Do not install/integrate a production PPTX renderer without separate approval. Recommended operational fallback: export locally to PDF or slide images, then use the approved PDF/image pipeline. PPTX-specific implementation stops at this decision gate; this is not a claim that direct PPTX support is complete.

Evaluation evidence: `phase5-pptx-evaluation.json`, `phase5-pptx-evaluation.png`, `phase5-pptx-audit.json`, `phase5-pptx-build.txt`, and the synthetic prototype/browser harness sources. Candidate references: [core/preview repository](https://github.com/office-kit/pptx), [Mozilla PDF.js](https://mozilla.github.io/pdf.js/getting_started/).

## Security, dependencies and manual QA

PDF.js **6.4.299** is exact-pinned, Apache-2.0, with matching local worker/support assets and retained license notices. Application code uses only document/page rendering; it does not mount a viewer or execute PDF scripting/XFA, links, forms or attachments. File type declarations are not trusted without signatures/decoding. Imported names/text render through React text. Media is never sent to a cloud API.

Integrity is a size/ordered-chunk SHA-256 manifest, not publisher authenticity, antivirus scanning or protection against coordinated same-origin data/hash rewriting. Same-origin pairing is not a sandbox against arbitrary malicious code already running in the application origin. Browser parser/decoder vulnerabilities remain part of the dependency/platform threat surface.

The nine unresolved development findings remain in the Workbox/build chain: `workbox-build`, `@rollup/plugin-node-resolve`, `deepmerge`, `@trickfilm400/rollup-plugin-off-main-thread`, `ejs`, `jake`, `filelist`, `glob`, and `minimatch`. No force audit fix or unrelated upgrade was applied. Review remediation separately before release.

Remaining manual QA / limitations:

- Test actual target Chrome/Edge/other supported browser versions, installed PWA operation, real projector/audio devices, fullscreen permissions, output placement, Escape and device disconnection. Chromium headless does not verify audible output or physical displays.
- Benchmark near-limit images/videos/PDF selections, repeated imports, quota exhaustion, large libraries, long playback, memory pressure and low-memory hardware. Small synthetic tests do not certify 256 MiB/24-hour files or every codec.
- Verify real MP4/WebM video/audio track combinations; first-frame acceptance does not guarantee later frames. Corrupt playback is paused/reported; there is no transcoder or automatic repair.
- Visually compare PDFs with fonts, complex colors, portrait/landscape pages and static forms flattened by a trusted exporter. Interactive annotations/forms are omitted; raster output is not editable/searchable text.
- Browser background throttling, sleep/crash, autoplay policy and last-position recovery remain best effort. Audio/video never resumes automatically after restart/refresh. A disconnected operator cannot guarantee delivery to the old output.
- Crash-orphaned/last-preparation pins can retain bytes. Cleanup intentionally avoids deleting them based on age. General retained-pin inspection/repair and portable backup are deferred; retain original authorized files.
- Storage is origin/profile-local and evictable. Persistent-storage requests are best effort; pins do not survive site-data deletion. Conservative free-space estimates can refuse an import that might otherwise fit.
- Only one active paired projector is supported. There is no frame-accurate multi-output synchronization, crossfade, external player, native helper or cloud conversion.

## Files and implementation notes

New: `src/media/{models,integrity,assetReader,validation,importCoordinator,pdfAdapter,media.test}.ts`, `src/data/mediaRepository.ts`, `src/hooks/useMedia.ts`, `src/components/{MediaLibrary,MediaCanvas,DocumentPagePicker}.tsx`, `e2e/{mediaFixtures,phase5.spec}.ts`, local PDF assets/licenses and the two Phase 5 documents/evidence.

Integration: domain/repository unions and metadata reads; existing generator/controller/model/protocol/window-manager/checkpoint files; projector and shared canvas; Preview/LIVE/schedule/dashboard/App; stylesheet, Vite precache configuration, README and package/lock metadata. No schema/store/index changes. Existing filenames remain rather than unrelated renames.

Bounded chunk hashing uses asynchronous Web Crypto and Blob slices rather than an added hash-worker dependency. PDF.js performs parsing in its own worker; browser image/video decoding is cancellable by generation/result discard. The UI uses paged cards and six-page thumbnail batches rather than an unbounded gallery. These choices retain the approved architecture without OPFS or staging-store expansion.

**Stop for Phase 5 review and the separate PPTX decision. Phase 6 requires explicit authorization.**
