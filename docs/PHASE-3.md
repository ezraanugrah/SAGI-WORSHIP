# Phase 3 — Preview & Projector

Date: 31 October 2026 (Asia/Jakarta). Version: 0.3.0. Scope: the approved Phase 3 implementation only. Phase 4 has not begun. No Git initialization, commits, pushes, deployments, dependency upgrades, or database migrations were performed.

## Implemented features

### Preparing and inspecting slides

- Select a library song for a standalone deck, or select a schedule item to prepare the complete scheduled deck starting at that item.
- Generate slides in `Song.order` / `Schedule.itemIds` order, retaining repeated sections and repeated songs as distinct occurrences.
- Normalize pages internally so repeated sections reuse text rather than duplicating all content. Each occurrence still has a separate slide identity.
- Measure system fonts against a 1920 × 1080 reference canvas. Wrap words, split oversized tokens at grapheme boundaries, respect explicit line breaks, and paginate at up to six visual lines, constrained by safe margins and font size.
- Cancellable generation protects a newer selection from an older asynchronous result. Limits are 10,000 slide occurrences and a validated 16 MiB serialized deck. Invalid/missing dependencies block preparation and leave the previous presentation intact.
- Preview selection, temporary text, Apply Preview, discard edits, and reset to the prepared source are separate from source-song editing.
- Preview offers the existing font families, bounded font size, and four existing background presets. These do not implement the broader Themes library.
- Applied text overrides are occurrence-specific and persist in `slide_overrides`, with source/layout signatures and revision checks. Only compatible overrides are reloaded. Settings/layout changes can intentionally make old overrides inapplicable.
- Schedule item counts show generated slide counts when the corresponding prepared snapshot is current; otherwise existing section-order counts remain explicitly labeled.

### Independent LIVE state

`PresentationController` is mounted in `App`, above Dashboard/Settings switching. Preview and LIVE are independently copied decks. Library reloads, song autosave/deletion, schedule changes, preference changes, and route navigation do not rebuild or mutate LIVE.

Go Live is an explicit, WriterGate-authorized action taking the applied Preview snapshot. Unapplied Preview text/style changes disable the UI action. Selecting another source only changes Preview. A source-revision warning identifies prepared content that differs from the library.

Previous/Next traverse the frozen deck, including section pages, repeated sections, and schedule-item boundaries. Navigation stops at the first/last slide and does not wrap. It never silently consults a newer source version.

Black, Clear Text, and Restore use an exclusive output mode. Black hides everything; Clear Text retains the captured background; Restore shows the current captured slide. Navigation preserves the output mode. A new explicit Go Live selects normal output. An Emergency Black action remains available in the operator header, including while viewing Settings.

Every LIVE mutation and publication validates the original WriterGate authorization ticket. Ownership loss invalidates pending preparation, prevents further commands, and leaves the audience's last frame unchanged. Secondary tabs remain read-only.

### Projector and synchronization

The projector route is `#/projector?...`. Its role is selected at document bootstrap. It mounts `ProjectorApp` instead of `App`, never starts `useWriter`, and does not read or write IndexedDB. A projector cannot become an operator simply by changing its hash while mounted.

Operator and output share `SlideCanvas`: fixed 1920 × 1080 layout, uniform scaling, letterboxing, captured font/style, plain React text, and measured overflow checks. A newly opened/refreshed projector begins black with no source lyrics. It displays a slide only after receiving a valid complete paired snapshot. Invalid rendering retains the last successful frame and reports an error.

Synchronization uses a session-scoped BroadcastChannel plus an exact-origin, known-window `postMessage` fallback. Both can deliver the same message; the protocol deliberately handles duplicates. The existing `sagi-library-changes` channel remains separate.

Messages include protocol version, session ID, ownership epoch, pairing capability, projector document nonce, sequence, and a typed message kind. Complete STATE snapshots make sequence gaps recoverable. Older or duplicate states, old sessions/nonces, unsupported versions, malformed data, cyclic payloads, and excessive decks cannot replace newer output. Previous projector document nonces are retired when a refreshed document pairs.

ACKs report a committed, layout-checked render. The operator distinguishes the command sequence from the acknowledged output sequence. Heartbeats run approximately every second, retry an unacknowledged full snapshot after approximately two seconds, and mark a connection unresponsive after approximately five seconds. Timer throttling can delay these indicators; timeout never blanks an established output.

Refresh creates a fresh document nonce and handshake. Close/reopen and Reconnect send the current complete LIVE snapshot. Operator restart creates a new session/pairing and does not automatically reconnect, resume, or take over an old projector. An old projector may intentionally continue showing its last frame until the operator closes it or uses the newly paired window.

### Checkpoint recovery

The existing `live_session_state` store holds a versioned `phase3:checkpoint` record. The record contains a self-contained frozen deck, cursor, mode, session/sequence metadata, timestamp, and record revision.

LIVE changes publish immediately in memory. Checkpoint writes are a separate serialized queue; they do not gate Black or other established presentation controls. Repository writes validate WriterGate before opening a transaction and before completion, track transactions for revocation, compare expected revisions, and await `tx.done`.

Storage/quota failures retain the previous durable checkpoint and show a failure status. Emergency Black still publishes when authority remains valid. “Coba checkpoint lagi” retries the current snapshot. The UI never claims that an uncommitted state is durably saved.

After operator reload, a valid checkpoint is offered through explicit **Resume presentasi** or **Discard checkpoint** actions. Nothing resumes automatically. Go Live is blocked while that recovery decision is unresolved. Resume restores the captured output mode; a checkpoint saved during Black therefore resumes black. Discard commits a versioned null checkpoint without deleting source materials. Malformed checkpoints are reported and preserved rather than reset.

### Browser controls and keyboard

Open Projector is directly initiated by an operator click. A blocked popup returns an actionable error. An existing owned window is focused/reused rather than opening another copy.

Fullscreen Projector requests fullscreen, but rejection never interrupts rendering. A local Fullscreen button provides a direct user-gesture fallback inside the projector window. Its controls fade after pointer inactivity and remain keyboard-accessible. Fullscreen state is reported back to the operator; Escape retains browser behavior.

Optional screen selection requests `getScreenDetails()` only after an explicit click. Unsupported/denied access uses manual window placement. Supported screen-change events refresh choices and warn the operator without blanking LIVE. Screen placement is best-effort and selected before opening a new output window. Optional screen monitoring is active while the LIVE panel is mounted; window synchronization/health monitoring persists across Settings navigation. It does not prove a projector is powered on or physically displaying pixels.

Shortcuts are scoped to focused LIVE controls: Left/Right, Space, B, and C. Inputs, textareas, selects, contenteditable/ARIA editors, composition, modifier keys, already-handled events, and repeated B/C keydowns are excluded. Space on ordinary buttons/links retains its standard action. Projectors do not install operator shortcuts.

## Data, offline, and security

- IndexedDB remains `sagi-worship`, schema **v1**, with the same 12 stores and key paths. No reset, re-seeding, or destructive migration occurs.
- Phase 1 preferences and Phase 2 songs/schedules/drafts remain in their existing formats. Presentation persistence uses only `slide_overrides` and `live_session_state`, with namespaced keys and record-format versions.
- No runtime dependencies or external runtime services were added. Package metadata was advanced to 0.3.0; dependency versions were not upgraded.
- The existing production PWA precache and deferred update strategy remain. Both roles use the cached application entry/bundle, including offline popup launch and refresh.
- Lyrics are React text, not HTML; imported code, remote content, or document execution is not used.
- Window messaging checks exact target origin, expected source window where postMessage is used, pairing IDs, document nonce, protocol shape, bounded payloads, and monotonically increasing state sequence.
- Pairing material is in the fragment, not query parameters sent to the static server. It contains no lyrics or source content. Keep output URLs private; pairing is not a defense against malicious scripts already running on the same origin or privileged browser extensions.
- Projector feedback is limited to pairing/health/render/fullscreen messages; it cannot issue operator navigation, source mutations, or checkpoint writes.
- A render ACK verifies the browser application, not external monitor hardware. Background suspension or display unplugging cannot be universally identified by browser APIs.

## Verification

| Check                | Result                       | Evidence                                                                                                                        |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`  | Passed                       | [TypeScript/unit console log](evidence/phase-3-checks.txt)                                                                      |
| `npm run build`      | Passed                       | Vite 7.3.7; PWA 1.1.0; 12 precache entries, 349.31 KiB                                                                          |
| `npm test`           | **50 passed across 6 files** | 34 existing Phase 1/2 regression tests plus 16 Phase 3 tests; [console log](evidence/phase-3-checks.txt)                        |
| `npm run test:e2e`   | **31 Chromium tests passed** | 15 Phase 2 regressions plus 16 Phase 3 scenarios; [complete console log](evidence/phase-3-e2e.txt)                              |
| Offline              | Passed                       | Existing source-data offline scenario plus two-window offline open, navigation, refresh, operator restart and explicit recovery |
| Responsive/rendering | Passed at 320, 768, 1440 px  | No operator horizontal overflow; 1024 × 768 output verifies 16:9 letterboxing                                                   |
| Runtime audit        | Passed; 0 findings           | `npm audit --omit=dev --json`                                                                                                   |
| Full audit           | 9 development findings       | See audit section; no upgrades applied                                                                                          |

The final browser suite runs native `window.open` popups with a real Chromium operator and projector in the same isolated context; it does not substitute a mocked projector component. The automated browser is headless, so OS/display permission behavior still requires the manual checks below. The final run uses zero retries.

New unit/integration assertions cover ordered/repeated sections and schedule items; Unicode wrapping/pagination; invalid/cancelled preparation; isolated Preview, source and LIVE data; frozen navigation boundaries and visibility modes; authorization at LIVE/Apply/Resume/Discard/checkpoint boundaries; checkpoint failure with functional Black; explicit recovery; corruption preservation; revision conflicts and rollback; occurrence-specific overrides; stale preparations; cyclic/oversized payload rejection; and duplicate/out-of-order/session/nonce protocol handling.

Browser scenarios verify every presentation control, source autosave/deletion and Settings/theme changes during LIVE, frozen scheduled navigation, projector refresh and reopen, frame retention during interrupted communication, black startup after interrupted refresh, reconnect, duplicate/stale/wrong-session/wrong-document messages, explicit Resume/Discard, quota failure with emergency Black and retry, popup/fullscreen denial, postMessage fallback with BroadcastChannel disabled, keyboard editing safeguards, secondary-tab/projector read-only behavior, offline recovery, aspect ratio/responsiveness, and ownership revocation.

Initial tests exposed locator mismatches with descriptive LIVE button labels and an incomplete test suspension/reconnection setup; the test fixtures were corrected. Final integration checks also tightened override revisions, ACK validation, source-change notices, fullscreen status and cyclic-payload handling. All final assertions pass.

Visual evidence, using original isolated test text:

- [Desktop operator workspace](evidence/phase-3-operator.png)
- [Projector output with letterboxing](evidence/phase-3-projector.png)
- [Mobile operator layout](evidence/phase-3-mobile.png)
- [Tablet operator layout](evidence/phase-3-tablet.png)

The local HTML report is `playwright-report/index.html`; use `npm run test:e2e:report` to inspect it. Failure traces are retained only on failure, while the saved console log and screenshots above are kept in `docs/evidence/`.

The test suite uses uniquely named temporary unit databases and fresh Playwright browser contexts. Test material is original software-verification text. Tests do not seed or delete the user's browser database.

## Audit findings

- `npm audit --omit=dev --json`: **0 vulnerabilities**, exit 0.
- `npm audit --json`: **9 development findings: 2 low, 7 moderate, 0 high/critical**, exit 1.
- These are the existing Workbox/build-chain findings from Phase 2: `workbox-build`, `@rollup/plugin-node-resolve`, `deepmerge`, `@trickfilm400/rollup-plugin-off-main-thread`, `ejs`, `jake`, `filelist`, `glob`, and `minimatch`.
- No force fixes or unrelated upgrades were applied. Reassess these before release. This dependency check is not a complete security audit.

## Limitations and remaining manual tests

1. Automated two-window coverage targets Chromium. Validate the target Chrome/Edge versions and any other supported browser in a headed session before operational release.
2. Test the actual projector: place the output on the external monitor, compare Preview/LIVE typography, inspect safe margins/letterboxing at the real display resolution, and verify rapid navigation, Black, Clear Text, and Restore.
3. Test real fullscreen permission, Escape, popup blocking, window-management permission denial/grant, operating-system scaling, screen removal/reconnection, browser focus changes, and installed-PWA multi-window behavior. Headless permission/failure tests do not certify OS behavior.
4. Suspend/background the operator and output for an extended period, then reconnect. Timing indicators are best-effort; established output intentionally retains its last valid frame.
5. The last durable checkpoint may lag LIVE during a crash, abrupt termination, or failed storage write. Recovery explicitly uses the saved checkpoint and does not guarantee the exact final audience frame.
6. Corrupt checkpoints/overrides are preserved and blocked from overwriting. Full data repair/backup remains Phase 7 work.
7. Prepared decks are intentionally frozen. Updating source content, layout, or the active schedule requires selecting/preparing again and an explicit Go Live. Unapplied Preview textbox/style edits are temporary UI state; apply or discard before navigating away. Applied overrides and LIVE checkpoints have separate persistence.
8. Pagination uses measured system fonts with a bounded explicit font size; it does not implement the broader Phase 6 typography editor or automatic shrinking of arbitrary source material. Actual renderer overflow rejects a candidate frame and preserves prior output.
9. Compatible text overrides are reloaded only for the same source/layout signature and matching prepared style. Ad-hoc style changes are captured in the current deck and recovery checkpoint, rather than constituting reusable custom themes.
10. Reopened operator sessions deliberately use new pairings. Close the stale output window and use Open Projector Window after explicit recovery; old audience windows are never silently commandeered.

## Scope and deviations

No significant architectural change or schema migration was needed. `Phase2Dashboard.tsx` retains its filename to avoid unrelated rename churn; it now integrates Preview/Live controls. The original unused `LivePlaceholder.tsx` is retained as historical source and is not mounted.

The implementation uses the agreed normalized deck, full-state synchronization, explicit recovery, and asynchronous guarded checkpoint model. Screen monitoring and render-overflow rejection are best-effort browser features with the limits above.

Scriptures, Media, PDF/PPTX, video/audio, full Themes, cloud services, source-song import/export, and Phase 4 work are not included. **Stop for Phase 3 review. Phase 4 requires separate explicit authorization.**
