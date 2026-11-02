# Phase 6 — Themes & Advanced Settings

Date: 1 November 2026 (Asia/Jakarta). Application version 0.6.0. Status: approved Phase 6 scope implemented for review. No Phase 7 implementation, Git initialization, commit, push, deployment, database migration, new production dependency or unrelated dependency upgrade was performed.

## Implemented features

- Complete built-in/custom Themes Library: create, edit/rename, duplicate, search/filter, explicit delete, Preview application, preparation default and Song/Scripture schedule-item assignments.
- Stable built-ins: Default Black, Sunset, Ocean and Purple. They cannot be edited/deleted; duplication creates an independent custom record. Existing legacy CSS presets are retained unchanged.
- Structured solid/linear-gradient backgrounds and local image/video backgrounds selected from the Media Library. Contain/cover, focal coordinates and bounded dimming are captured. Background cropping never changes the foreground text area.
- Typography: Arial/Georgia/Verdana, bounded size, normal/bold, italic, underline, text color, horizontal/vertical alignment, line height, line limit, per-side margins, bounded outline/shadow and paginate/bounded-shrink fitting.
- Isolated Theme Editor preview with synthetic sample or current Preview text/reference/attribution, solid-color contrast ratio/advisory warnings, unsaved-editor exit confirmation and before-unload warning. Invalid edits do not overwrite a saved theme or publish to LIVE.
- Explicit application to the current Preview text item or all text items; assigning a theme to a schedule item is a separate guarded persistence operation. Standalone media/PDF frames keep their existing appearance.
- Silent video backgrounds with separate Preview/editor/LIVE controls, explicit motion, continuity across matching adjacent text frames, paused Black/refresh/recovery, and actual playback feedback. Foreground media audio controls remain separate.
- Advanced settings: default theme, 1920×1080/1280×720 reference canvas, Fit/no-upscale scaling, reduced-motion Preview preference, contrast warnings, explicit save/reset, screen-selection/fullscreen controls and Preview-only calibration. Existing video/audio defaults, storage estimates and persistent-storage controls remain.
- Frozen presentation render specifications, protocol v4, checkpoint format 4, and legacy checkpoint/override compatibility. No theme/settings mutation silently changes LIVE.

## Architecture and data model

IndexedDB stays at **schema v1**, with the same 12 stores/key paths and no new indexes. The `themes` store existed before this phase; it is now used. No existing Phase 1–5 row is rewritten at startup.

| Boundary             | New behavior                                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `themes`             | Version-1 custom record with stable `theme:` ID, revision, name, structured spec, SHA-256 signature and timestamps. Deleted IDs retain tombstones. Built-ins are code definitions, not seeded rows.        |
| `settings`           | Separate `phase6:settings` record with format/revision, optional default theme, reference/scaling and accessibility values. Legacy `preferences` remains unchanged and readable.                           |
| Schedule items       | Additive optional `themeId` for Song/Scripture items. Assignment checks schedule revision and commits item/schedule changes atomically. Media items cannot receive a text theme.                           |
| Deck                 | Optional render specification v2: captured canvas/scaling, complete theme snapshot table, frame-to-theme mapping and measured effective font sizes. No mutable theme lookup is needed by LIVE or recovery. |
| `slide_overrides`    | Legacy format-1 overrides retain their exact old source-signature interpretation. New themed text overrides use format 2 and `phase6:` keys. Scripture remains read-only.                                  |
| `live_session_state` | Same checkpoint key/revision queue; reads formats 1–4, new writes use format 4. Complete render snapshots and background dependencies survive library deletion.                                            |
| Projector            | Protocol v4, strict render validation and scoped read-only asset access. Older protocol windows cannot silently omit advanced styling or backgrounds.                                                      |

The theme signature covers the full validated appearance specification, including referenced immutable media identities. Stored custom records are checked against that signature when loaded/resolved. Writes capture WriterGate tickets before asynchronous verification, compare expected revisions and the validated old record inside the transaction, and reject stale/deleted identities. Invalid/unknown records are preserved and surfaced.

Theme snapshot DTOs contain only ID, revision, name, spec and signature; persistence-only timestamps/format fields do not enter the render protocol. Colors, font names, numeric ranges and media references are validated. Arbitrary CSS, remote URLs, HTML and font-file imports are not accepted.

Theme saving and its `pin:theme:` update commit together across the existing stores. Theme deletion checks current assignment/default usage against the disclosed counts. Used themes require an explicit replacement; assignment revisions, default settings, tombstone and pin release commit together. Failure rolls everything back.

## Typography and rendering

Legacy decks retain their existing 1920×1080, fixed line-height and CSS-preset path. New themed decks use the shared `appearance` model for Canvas measurement, pagination and renderer styles. Measurement includes family, weight and italic. Margins, line spacing, line limits, outline/shadow padding and Scripture footer reservation constrain the usable body area.

Typography is measured in normalized 1080-reference units, then scaled for the captured 720/1080 canvas. `no-upscale` never enlarges beyond the captured reference canvas. Both modes preserve 16:9 and letterboxing; they do not change the operating system's physical output resolution. Standalone PDF raster resolution remains unchanged.

New pagination retains source text, Unicode, CRLF and spaces. Bounded shrink searches no lower than the saved minimum size, then paginates if the content still needs multiple pages. Effective sizes are recorded per frame so the audience uses the measured choice. Different source sections/verses can have different effective sizes under shrink mode.

Scripture text is not edited or silently corrected. Every continuation retains its original reference, translation and attribution, with a protected black/white footer and minimum normalized footer sizes. Actual body/footer overflow rejects normal output and preserves the preceding valid frame. Black does not depend on those fit checks.

Solid backgrounds show a numerical contrast ratio; gradients/images/video carry an advisory because a single sample cannot certify every region/frame. Dimming is explicit and captured, not automatically applied to LIVE. Fonts remain system fonts; readiness and fit checks cannot certify identical glyph coverage/appearance across systems. Verify target fonts/languages manually.

Applied Song text overrides can persist on new themed pages if they fit the captured layout. Repagination/theme application warns before discarding current Preview edits; old stored override rows remain intact. New frame/signature matching is deliberately conservative: even paint-only theme changes can invalidate a themed override. The implementation does not attempt to transfer edits across repagination or merge page overrides into source lyrics. Legacy signatures remain byte-for-byte compatible, verified by a pre-Phase-6-format override fixture.

## Background lifecycle, pins and cleanup

`mediaRefs` is the shared deck dependency collector for standalone media and every frozen theme's background/poster. Preview pinning, authorized Go Live, durable checkpoints, projector authorization and recovery use this collector. Theme authoring uses the same immutable reference forms and atomic pin mechanism.

Removing a media library source does not delete bytes owned by a saved theme or frozen presentation. Removing/editing a theme only changes its own pin; Preview, active LIVE, retired-unacknowledged output and checkpoint pins retain their dependencies independently. Current-session retired LIVE pins are released only after replacement acknowledgement. Checkpoint and dependency pins commit atomically; failed checkpoint persistence retains the previous record and its pins.

Cleanup remains conservative. It now cross-checks theme records and the durable checkpoint against their expected pins in one transaction before reclaiming payloads. Missing/corrupt theme/checkpoint pins or unknown/corrupt records block cleanup rather than risking referenced bytes. This is dependency validation, not automatic repair. Existing crash-orphaned pins remain retained; no age-based purge, general backup or Phase 7 repair flow was added.

The storage UI counts theme-held dependencies with retained snapshots. Browser quota/eviction, site-data deletion, profile/origin changes and disk failure are still outside pin guarantees. Keep original authorized files.

## Preview, LIVE and projector safety

Editor changes, saved theme edits, assignments/defaults, Settings navigation and Preview playback do not mutate LIVE. Theme resolution and pagination prepare a new independent deck; explicit authorized Go Live publishes it. Source/theme changes mark a Preview stale without rebuilding it automatically.

Background videos are always muted with volume zero and expose no native unmute controls. Preview/editor playback is independent of audience playback. Background identity is stable across adjacent frames with identical captured asset/fit/focal/dim configuration, allowing continuity. Changing to another background or standalone media stops the old decoder. Video remains paused until explicit Play; choosing a video within the editor may start only that local preview when reduced motion is disabled.

Black hides everything, pauses/silences background and foreground video, cancels newer pending publication and does not wait for a decoder/checkpoint. Clear Text hides foreground text and Scripture footer while retaining the background. Restore does not restart a video paused by Black. New/refreshed projector documents cannot reuse an old document's playback permission/command nonce. Resume explicitly restores video backgrounds paused.

Projector messages contain bounded structured render/control state and immutable references, never blobs/base64/object URLs. Before accepting a candidate, projector preflight verifies/decodes the current media/background while the established audience frame remains mounted. Newer sequence/generation checks discard stale completion; failed preflight preserves prior output. Renderer rejection resets pending state so reconnect/retry remains possible. A fresh output starts black until a valid complete state is ready.

The projector never receives WriterGate or mutation services. Its reader aborts database creation/upgrades, opens read-only transactions and only reads references present in the validated snapshot. This is not confidentiality protection against arbitrary malicious same-origin scripts or privileged extensions. SHA-256 detects accidental content changes, not an attacker rewriting both bytes and hashes.

Checkpoints 1–3 retain their legacy interpretation; format 4 is required for advanced render snapshots. Unsupported versions fail safely rather than downgrading. PWA updates remain deferred; close old operator/output windows and reopen matching versions after service. Snapshot recovery is explicit Resume/Discard, never automatic takeover or motion restart. Last durable playback position can lag.

## Verification evidence

Evidence is in `docs/evidence/`:

| Check            | Result / evidence                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript       | Passed: `phase-6-typecheck.txt`.                                                                                                   |
| Unit/integration | 104 passed across 9 files, retaining all previous 90: `phase-6-unit.txt`.                                                          |
| Production build | Passed with existing PDF worker/support assets still offline cached: `phase-6-build.txt`.                                          |
| Playwright       | 54 passed, including all previous 47 scenarios and 7 Phase 6 cases: `phase-6-e2e.txt`. Final editor/source-text and responsive recheck: 1 passed, `phase-6-responsive.txt`.                      |
| Runtime audit    | 0 vulnerabilities: `phase-6-runtime-audit.json`.                                                                                   |
| Full audit       | 9 existing development findings: 2 low, 7 moderate, no high/critical; `phase-6-full-audit.json`. Audit exits 1 for these findings. |

New unit/integration tests cover strict typography/background validation, gradient ordering, contrast math, built-ins, CRUD/reload, stale revisions, tombstone resurrection prevention, immutable presets, settings/assignment authorization, explicit deletion replacement, complete rollback after final write/quota failure, ownership-loss abort, corrupt-record preservation, exact Unicode/CRLF pagination, bounded fitting, 720p snapshots, immutable LIVE during theme edits, protocol/checkpoint compatibility, Scripture attribution, background retention after media/theme deletion, missing-pin cleanup refusal and exact legacy override compatibility.

Phase 6 E2E uses native operator/projector windows and production PWA assets:

1. Offline Theme CRUD, rename/duplicate/search/reload and secondary-tab read-only controls.
2. Image-backed themed output, frozen LIVE through theme edits, source/theme deletion, refresh and explicit checkpoint recovery.
3. Independent Preview/LIVE video background motion, forced silence, Black/Clear Text/Restore, offline refresh and paused recovery.
4. Used-theme deletion disclosure, required explicit replacement and schedule assignment preservation.
5. Advanced resolution/scaling leaving existing LIVE unchanged, themed Scripture references/attribution, and responsive editor/library layout.
6. Corrupt backgrounds unable to replace established output, plus emergency Black during checkpoint quota failure.
7. Unsaved-edit warning, transactional theme-save failure and stale/incompatible protocol rejection.

All original fixtures are synthetic. Unit databases use unique names and are removed individually. E2E contexts are isolated; no tests access/reset the user's browser profile or workspace data. Existing regressions cover Songs, Scriptures, media, storage errors, writer loss, offline operation, fullscreen/popup fallbacks and synchronization interruptions.

Screenshots: `phase6-operator.png`, `phase6-projector.png`, `phase6-mobile.png`. Projector and mobile output were visually inspected; headless checks do not certify physical displays/audio. HTML/trace artifacts remain in the existing Playwright report directories.

## Dependency audit

No production dependency was added and no dependency version was upgraded. Root package/lock version metadata advances to 0.6.0. Runtime audit is clean. The existing Workbox/build-chain findings remain in `workbox-build`, `@rollup/plugin-node-resolve`, `deepmerge`, `@trickfilm400/rollup-plugin-off-main-thread`, `ejs`, `jake`, `filelist`, `glob`, and `minimatch`. No force fixes were applied; reassess remediation separately before release. npm audit is not a complete security review.

## Limitations and remaining manual QA

- Validate real projector readability, contrast, image cropping/dimming, gradients, safe margins and small attribution at the intended viewing distance. Media contrast is advisory, not a universal pass/fail guarantee.
- Verify system-font availability/fallback, bold/italic glyphs, Unicode/CJK/bidi content and effect bounds. No local font-file import, font enumeration permission, bundled font package or cross-machine pixel-equivalence guarantee is provided.
- Font readiness, Canvas metrics and DOM overflow checks have browser/platform limits. Unusual glyph ink, video decoders and complex layouts require manual visual QA. Shrink fitting is bounded and may still paginate; it never hides content to force a fit.
- Test reference canvases, no-upscale, browser zoom and OS DPI scaling on real 4:3/16:9/external displays. Only 720p/1080p reference canvases are supported; physical display modes and higher-resolution PDF regeneration are not controlled.
- Test actual target Chrome/Edge/other intended browsers, fullscreen/user-gesture denial, screen selection, popup blocking, monitor removal and installed-PWA windows. Manual placement/fullscreen remains the fallback.
- Test long-running background videos, sleep/background throttling, source decode failure, application crash and extended communication interruption. Established playback follows its last accepted command during disconnection; an unresponsive operator cannot guarantee command delivery. Backgrounds are silent and looping; foreground media audio is separate.
- Checkpoint recovery may lag the last audience time/frame. Motion is paused on refresh/recovery; explicit Play is required. There is no frame-accurate multi-projector synchronization or crossfade.
- Theme pins and crash-orphaned presentation pins can retain storage after source deletion. Cleanup intentionally refuses ambiguous/corrupt dependencies. Full retained-pin repair/backup is deferred; originals must be kept separately.
- Theme signatures conservatively include paint and layout. Some appearance-only edits require reapplication/repreparation and may not reuse themed overrides; old override records remain preserved. No automatic override migration/merge is attempted.
- Gradient controls edit the structured stops already present (new gradients start with two; built-in Sunset has three). The format accepts up to four stops; arbitrary CSS/radial gradients are excluded.
- Calibration is an isolated synthetic Preview, then explicit Go Live. It does not measure external-projector hardware or certify color calibration. Reduced-motion settings affect local authoring behavior; all audience refresh/recovery remains paused regardless.

## Files and scope notes

New: `src/themes/{models,builtins,themes.test}.ts`, `src/data/themeRepository.ts`, `src/hooks/useThemes.ts`, `src/presentation/appearance.ts`, `src/projector/preflight.ts`, `src/components/{ThemesLibrary,ThemeEditor,TypographyEditor,ThemedFrame,AdvancedSettings}.tsx`, `e2e/phase6.spec.ts`, this report and evidence.

Integration: domain item validation, shared media dependency/cleanup logic, presentation layout/generation/models/controller/protocol/window manager, checkpoint/override repository, projector, shared canvas/media renderer, Preview/LIVE/dashboard/App, styling, README and root version metadata. No store/index/schema changes. The Settings component remains locally implemented without an unnecessary architecture split or dependency.

Built-ins and old preset CSS remain stable. The new renderer is opt-in through a resolved theme/advanced canvas setting; untouched default legacy preparation retains its existing path. Standalone media/PDF appearance is not restyled. Existing dependency audits and deferred PWA updates remain.

Direct PPTX integration, external services/fonts, arbitrary CSS/HTML, transitions/crossfades, audio mixing/boost above 100%, multi-projector synchronization, portable theme/media import-export, backup/restore, destructive repair and Phase 7 work are excluded.

**Stop for Phase 6 review. Phase 7 requires separate explicit authorization.**

The Theme Editor sample displays the first generated page of the chosen sample; preparing the presentation generates and navigates the complete paginated passage. The final focused browser check verifies current Scripture sample text and attribution plus responsive editor widths after this preview option was added.
