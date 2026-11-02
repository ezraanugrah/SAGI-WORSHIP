# Phase 2 — Songs & Scheduling

Date: 31 October 2026 (Asia/Jakarta). Implementation follows the explicitly approved Phase 2 plan. No schema migration, Git initialization, commit, push, deployment, or Phase 3 implementation was performed.

## Implemented behavior

### Songs

- Create, edit, duplicate, search, inspect, and permanently delete songs with IndexedDB persistence.
- Title, optional author/creator, category, language, creation/update timestamps, and aggregate revision.
- Intro, Verse, Chorus, Bridge, and Ending sections with editable labels and lyrics.
- Section definitions retain authoring order independently from the presentation sequence. The sequence can repeat or omit existing sections and can be reordered through drag-and-drop or keyboard-accessible Up/Down buttons.
- Case-insensitive title, lyrics, and author search; React text rendering prevents imported/user-entered lyrics from being interpreted as markup.
- Duplication creates new song/section IDs and remaps repeated presentation references.
- Song deletion explicitly confirms the number of affected schedule entries, then atomically deletes the song, its sections, and all dependent schedule entries. Other source songs remain intact.

### Worship schedules

- Create multiple schedules, rename, duplicate, choose the active schedule, and confirm permanent deletion.
- Add songs, including repeated appearances of the same song, to the active schedule.
- Remove individual schedule items without deleting their source songs.
- Drag-and-drop ordering and labeled Up/Down alternatives with focus restoration and live announcements.
- Schedule duplication creates new schedule/item IDs while retaining references to source songs.
- The active schedule and all committed ordering changes survive reload.

### Autosave and data safety

- A 450 ms debounce coalesces song edits; an explicit save action and editor close also flush pending work. A browser unload warning covers edits not yet durably handled.
- Bounded incomplete drafts live separately in namespaced `settings` records. They do not overwrite the last valid song. Drafts can be reopened or explicitly discarded.
- Validation requires a nonblank canonical title and lyrics, supported section types, bounded fields/collections, unique section IDs, and valid presentation references. Incomplete title/lyrics are allowed only in drafts; structurally invalid drafts are rejected.
- Serial editor jobs advance their expected revision only after successful commits. The UI reports unsaved, saving, saved, draft, and failed states, with retry and an explicit close-without-saving option on error.
- The same durable draft can be reused after a failed canonical save. A stale sequence, stale aggregate revision, changed draft, or missing/deleted source is rejected rather than silently overwritten.
- Song deletion markers prevent a delayed create/draft save from recreating a deleted ID.
- Every repository mutation, including Phase 1 preference writes, requires an active Web Lock authority. Authority is checked before opening a database transaction and again before awaiting its completion. Authorization tickets are invalidated on revocation; tracked transactions are aborted and the held lock is released.
- Missing Web Locks support, lock denial, lock loss, page suspension, and database-version changes leave the tab read-only. The application never steals locks; lock stealing is used only by an isolated E2E test to exercise unexpected ownership loss.
- Multi-store operations use one IndexedDB read/write transaction and await `tx.done`. Exceptions and revocation abort the whole operation. Persisting a recovery draft and committing its canonical song are deliberately separate transactions; the canonical transaction includes draft removal.
- Corrupt or unsupported records are reported and preserved. Healthy unrelated songs remain usable. Mutations that depend on corrupt relationships are blocked. Automatic repair is not attempted.

## Compatibility and architecture

The database remains `sagi-worship`, version **1**, with the original 12 object stores and `id` key paths. There is no clearing, re-seeding, store replacement, or migration. Phase 1 preference records and unrelated theme/data records are retained.

Songs and sections use `songs` / `song_sections`; schedules and references use `schedules` / `schedule_items`. Active selection, recovery drafts, and deletion markers use namespaced keys in `settings`, separate from the original `preferences` key. A song aggregate revision covers its sections and presentation sequence. A schedule revision covers its name and item order.

A local BroadcastChannel sends only change notifications to refresh readers; it does not implement presentation synchronization. If channels are unavailable, focus/reload refresh remains available. Every load reads a consistent multi-store snapshot, and obsolete asynchronous loads cannot replace newer UI data.

The existing black, white, and amber theme, Settings page, hash navigation, PWA manifest, bundled runtime assets, and deferred service-worker update strategy remain. LIVE/projector controls are disabled. Scripture, media, full theme editing, backup/restore, and presentation rendering remain deferred.

Only `@playwright/test` and its test-only dependencies were added. No runtime dependency or external runtime API was introduced.

## Verification

| Check                       | Final result                            | Evidence                                                                                                                             |
| --------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`         | Passed, exit 0                          | Strict TypeScript covers application, unit tests, E2E tests, and config files                                                        |
| `npm run build`             | Passed, exit 0                          | Vite 7.3.7; PWA 1.1.0; 12 precache entries, 315.95 KiB                                                                               |
| `npm test`                  | **34 passed / 5 files**, exit 0         | `src/domain/models.test.ts`, `src/data/repository.test.ts`, `src/data/autosave.test.ts`, `src/data/writer.test.ts`, `src/db.test.ts` |
| `npm run test:e2e`          | **15 passed**, 21.7 seconds, exit 0     | [Final console log](evidence/phase-2-e2e.txt); local HTML report at `../playwright-report/index.html`                                |
| Responsive checks           | Passed at **320, 768, and 1440 px**     | No horizontal document overflow with editor/schedule open; screenshots below                                                         |
| Production dependency audit | Passed, 0 findings                      | `npm audit --omit=dev --json`                                                                                                        |
| Full dependency audit       | 9 existing development findings, exit 1 | Details in Audit below                                                                                                               |

The final E2E run passed without retries. Earlier browser runs exposed form-label lookup issues and focus loss during asynchronous schedule saves. Explicit field labels and focus restoration were added; all affected scenarios and the full suite then passed.

Unit/integration coverage includes input validation and limits, repeated section references, section-definition persistence, search and movement, every repository mutation's authorization check, delayed/revoked authorization, stale/concurrent revisions, deleted-record resurrection prevention, source-safe item removal, song and schedule duplication, draft sequence protection, incomplete draft recovery, timer-based autosave, retry, corrupt-record preservation, Phase 1 compatibility, and closing a blocking connection without data replacement or schema downgrade.

Failure injection verifies complete rollback after section replacement fails, after a schedule update fails following item insertion, after duplicate-schedule creation fails following copied item insertion, and after a later corrupt dependency aborts multi-schedule song deletion. Tracked transactions are also tested under authority revocation.

Browser coverage includes both CRUD flows with confirmation/cancellation, title and lyric search, every section type, repeated section order, native drag-and-drop, keyboard reorder with restored focus, reload persistence, draft recovery, read-only secondary tabs, lock loss via simulated stealing, malformed records, failed-save retry, Phase 1 preference retention, and offline operation. The offline scenario waits for production service-worker activation, disconnects the browser context, reloads the shell, edits existing lyrics, creates a song and schedule, adds/reorders items, and reloads again while offline.

All unit databases use unique random names and are deleted after each test. Every Playwright test receives a fresh isolated browser context. No user browser profile or existing workspace database was reset or populated with test content.

Screenshots use original test-only lyrics and isolated test data:

- [Desktop Dashboard](evidence/phase-2-dashboard.png)
- [Desktop song editor](evidence/phase-2-editor.png)
- [Tablet layout](evidence/phase-2-tablet.png)
- [Mobile layout](evidence/phase-2-mobile.png)

## Audit

- `npm audit --omit=dev --json`: **0 vulnerabilities**, exit 0.
- `npm audit --json`: **9 findings: 2 low, 7 moderate; 0 high or critical**, exit 1.
- The remaining development/build chain is `workbox-build`, `@rollup/plugin-node-resolve`, `deepmerge`, `@trickfilm400/rollup-plugin-off-main-thread`, `ejs`, `jake`, `filelist`, `glob`, and `minimatch`. This matches the Phase 1 finding count. The audit reports fixes available; no force upgrade or unreviewed build-chain replacement was applied as part of Phase 2.
- These are dependency findings, not a full security audit or a release clearance. Reassess the PWA build chain before release.

## Limitations and remaining work

- Automated browser coverage targets Chromium desktop and responsive viewport sizes. Other browsers, installed-PWA operation, storage eviction, OS/browser crashes, and physical projectors are not certified by these checks.
- A sudden crash may lose edits from the current debounce interval or an uncommitted transaction. “Saved” is shown only after commit; persistence still depends on the browser's storage guarantees and available quota.
- Drafts outside the structural/size limits are not persisted. The editor displays the error and keeps the current in-memory input for correction/retry. If writing authority is lost, the application cannot safely persist further edits; the previously durable draft remains available.
- A conflict does not auto-merge content. Reload/reopen the preserved draft and inspect the source; corrupt-record repair and full backup/restore remain Phase 7 work.
- Song deletion markers are retained to reject delayed writes. Cleanup/compaction is deferred rather than risking resurrection.
- Secondary tabs do not automatically acquire the writer role. Close the owner and reload a reader to obtain the lock.
- The schedule shows song type and presentation-section entry counts, not a final rendered-slide count. Slide generation, fit behavior, Preview overrides, Go Live, projector windows, and presentation shortcuts belong to Phase 3 and are not implemented here.
- Song collection import/export is deferred as agreed in the approved plan. Scripture datasets, media, and copyrighted sample material are not included.

## Deviations and review gate

No significant architectural change or scope expansion was required. Small additions within the approved safety scope include retaining section-definition order, making retry idempotent after a partial autosave pipeline failure, and restoring focus after asynchronous reorder saves. The existing database-version-change callback was also corrected to close its database event target (rather than treating it as an open request), and unexpected database termination now revokes writing authority. A regression test exercises a newer schema only in an isolated temporary database; the production database remains v1. Mobile visual QA also led to bounded decorative titles and a compact editor close button.

Review Phase 2 before authorizing further development. **Phase 3 has not begun and requires separate explicit approval.**
