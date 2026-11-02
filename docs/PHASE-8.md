# Phase 8 — Final QA and release-readiness assessment

Date: 2 November 2026 (Asia/Jakarta). Application metadata remains **0.7.0**. Scope: approved non-destructive QA, tests, documentation and local readiness assessment. **NOT PRODUCTION-READY. Stop for Phase 8 review.** Hardware, browser coverage, operational storage limits and security decisions remain unresolved.

## Baseline and scope

Read the original PRD, Phase 1–7 reports, recovery/security/media documents and prior evidence. Baseline: 145 unit/integration tests, 64 Chromium scenarios, schema v1/twelve stores, projector protocol v4, checkpoint writes format 4 (reads 1–4), runtime audit zero and nine development findings. The original PRD is a historical draft; its direct-PPTX criterion remains unimplemented under accepted Phase 5 scope. Local PDF/image conversion is the documented fallback; release-scope acceptance remains APPROVAL REQUIRED.

No production application logic, schema, dependency metadata/lockfile or security policy changed. `protected-files-before.json` / `protected-files-after.json` compare SHA-256 for 79 application/config/dependency files: zero mismatches. New tests and QA tooling are separate. Fixture databases/contexts are disposable; persistent update profiles use newly generated temporary directories reported in their JSON. No pre-existing browser profile/user data was accessed, reset, repaired or migrated. No dependency install/upgrade, cloud integration, Git initialization/commit/push or Vercel action occurred.

## Executed results

Evidence paths below are relative to `docs/evidence/phase-8/`. PASS applies only to the executed scope, never to an unexecuted hardware/OS/browser scenario.

| Check | Classification / result | Evidence |
| --- | --- | --- |
| TypeScript | PASS | typecheck.txt |
| Production build/PWA generation | PASS; 207 precache entries | build.txt |
| All unit/integration | PASS; **148 tests, 12 files** | unit.txt |
| Existing Chromium baseline before new E2E additions | PASS; 64 scenarios | e2e-baseline.txt |
| Focused new Chromium E2E | PASS; 2 scenarios after correcting a harness assertion | e2e-targeted.txt |
| Final complete bundled Chromium run | PASS; **66 scenarios**, no retries | e2e-chromium.txt |
| Final complete installed Chrome macOS run | PASS; **66 scenarios**, no retries | e2e-chrome.txt |
| A→B activation-aware lifecycle, bundled Chromium and installed Chrome | PASS for marked same-JS QA builds after actual B activation | update-activation-chromium.json, update-activation-chrome.json |
| Premature reopening/browser termination before verified B activation | FAIL to upgrade in those drills; old A/data retained; medium operational qualification gap | update-chrome-immediate-reopen.json, update-persistent-*.json, update-instrumented-chrome.json |
| Synthetic media/storage/download/stream adapter/verify/fresh restore | PASS for bounded workload described below | storage.json, storage.txt |
| Runtime audit | PASS; zero recorded findings | runtime-audit.json |
| Full audit | APPROVAL REQUIRED; nine development findings, 2 low/7 moderate, no high/critical; exit 1 expected | full-audit.json |
| Required physical display/audio/installed-PWA rehearsal | MANUAL QA | HARDWARE-QA.md |
| Edge / Playwright Firefox / Playwright WebKit | BLOCKED; unavailable executable/engines, no installation | browsers.json |
| Actual Safari and VoiceOver | MANUAL QA; not executed | HARDWARE-QA.md |

No new Critical/High product defect was established by these runs. The failed update drills were not silently converted into passes. They are distinguished from the successful activation-aware lifecycle; the installed-PWA operator update procedure still requires qualification.

## Added focused coverage and retained regressions

`src/backup/phase8.test.ts` adds three tests:

1. Restricted actual multi-slide Unicode Scripture after source deletion: both frozen checkpoint and recovery candidate omitted, partial omissions explicit, no restricted verse text in archive.
2. Exportable counterpart: multi-slide text/attribution preserved, both records remain portable, fresh restore preserves exact Unicode text with a new session ID.
3. Recomputed valid manifest hash does not excuse invalid entry offsets; trailing bytes are rejected.

`e2e/phase8.spec.ts` adds two production-browser scenarios:

1. Equal Song/Schedule parents with child-only content conflict: browser backup, keep-existing dependency disclosure, keep-both duplication and atomic publication; verify two songs/two schedules/four occurrence items, correct relationships, unchanged destination lyrics and schema v1.
2. Unicode rendering, focused B/Restore shortcuts, 320/768/1440-width overflow checks, saved frozen presentation, no automatic Go Live after reload and explicit recovery into a new output.

Full regression runs retain prior coverage for complete mixed backup/fresh restore, malformed/corrupt archives, maintenance authorization, stale plans/revisions, cancellation and ownership loss, final-receipt quota rollback, conservative repairs, media/theme retention after deletion, Preview/LIVE isolation, protocol mismatch/stale messages, reconnect, failed decoding preserving output, Black/Restore, offline operation, legacy checkpoints, Scripture references/attribution and paused video/background recovery. This is a coverage map to executed existing tests, not a claim that each path was newly implemented or exhaustively tested.

Unit Scripture pagination uses deterministic test measurement; browser Unicode text assertions do not certify glyph fidelity on a physical projector. Responsive checks test overflow/controls, not complete accessibility conformance. Refreshed existing screenshot artifacts `phase7-mobile.png` and `phase5-pdf-projector.png` were visually inspected: settings remain within the narrow page and the synthetic PDF page is visible. Their historical filenames come from existing E2E tests; historical report text/logs were preserved.

## Browser/environment observations

Host: macOS 26.6.2, build 25G83, x86_64; Darwin 25.6.0. Node v26.0.0, npm 11.12.1, Playwright 1.64.1. Tests use headless automated contexts, not installed-PWA windows or the operator's normal profile.

| Browser | Classification | Version and observation |
| --- | --- | --- |
| Installed Google Chrome macOS | PASS for executed suite/probes | 156.0.8078.79; Web Locks, service workers, save picker, screen-details and storage estimate APIs present |
| Bundled Chromium | PASS for executed suite/probes | 156.0.8078.4; same API-presence observations |
| Microsoft Edge macOS | BLOCKED | Expected /Applications/Microsoft Edge.app executable absent |
| Playwright Firefox | BLOCKED | Matching firefox-1555 binary absent; installed Firefox.app is not substituted for the patched automation engine |
| Playwright WebKit | BLOCKED | Matching webkit-2370 runner absent |
| Safari | MANUAL QA | No Safari execution/compatibility claim |

Chrome/Chromium `canPlayType` reported "probably" for the tested H.264/AAC and VP8/Vorbis declarations. That is an API hint; actual small-fixture decoding was separately tested. API presence is not permission approval or native picker/display/audio qualification. No browser or dependency was downloaded.

## PWA update experiment and failure disposition

A and B were separately generated with a QA-only HTML build marker, distinct index precache revisions and, for final diagnostics, a marker in each temporary QA worker artifact. Production `src/main.tsx`, `vite.config.ts` and generated `dist/sw.js` policy were not changed. App JS/protocol/schema were identical: this qualifies this shell/precache lifecycle, not an arbitrary future executable/format migration. A random loopback origin and fresh contexts or unique temporary persistent profiles isolate all data.

PASS in both final activation-aware runs:

- A operator/projector remain on A while B waits; audience text and every durable store record remain unchanged.
- Close all application clients while leaving the test browser alive; observe the **specific B worker's own state** become activated.
- Reopen B, verify matching marker and exact durable-record snapshot/schema, then restart B offline.
- Explicit Resume is required; a fresh paired output renders the frozen presentation offline. Existing video-recovery E2E separately proves paused video; the A→B fixture itself is text.

FAIL / medium operational gap: immediate reopen or closing the entire browser during the pending transition could return A, including after a full disposable-profile restart. No tested content was lost or automatically made LIVE. Initial diagnostic code incorrectly inferred B activation from `registration.active.state`, which could describe A; that claim is invalid and superseded by explicit worker-identity evidence. The first one-off immediate Chromium pass is not a reliability guarantee.

No skipWaiting/unregister/cache clearing, worker replacement or product correction was used. Manual installed-PWA/browser close/reopen timing, permissions and operator-visible matching-build verification remain required. Any product change to update activation/notification requires separate approval. Do not update during a service or assume a waiting worker means the new build is active.

## Highest successfully tested bounded workload

Installed Chrome 156.0.8078.79, unique disposable context; no deliberate quota/disk exhaustion. `qa/phase8-storage.mjs` generated/imported unique random-noise PNGs and used original local FFmpeg fixtures (FFmpeg 9.0.2 already installed).

| Level | Stored Blob bytes | Search observation | JS heap observation |
| --- | ---: | ---: | ---: |
| 8 images | 8,033,489 | 42.4 ms | 14,405,596 bytes |
| 24 images | 24,101,089 | 58.1 ms | 93,028,844 bytes |
| 48 images | 48,201,930 | 48.1 ms | 76,096,040 bytes |

Final library: **51 assets / 102 payloads / 48,677,295 Blob bytes**: 48 PNGs (512×512), 3-second 640×360 H.264/AAC MP4 (311,263 bytes), 3-second VP8/Vorbis WebM (107,937 bytes), and a two-page PDF. Both videos advanced playback without a decoder error during a 1.1-second sample; actual audible output/full duration/soak was not tested here. PDF selected pages were prepared through the application.

- **Archive: 48,787,385 bytes (~46.5 MiB)**, fallback download completed, reopened and fully verified.
- Download observation ~941 ms; worker verification ~826 ms; stage/preview/publication workflow ~3,169 ms. Single local samples, not percentile guarantees.
- Streaming adapter consumed real archive bytes, maximum observed write 1,769,472 bytes (<4 MiB), then reopened and fully verified. Native OS picker/disk semantics remain MANUAL QA.
- Fresh-context restore matched source asset/payload counts and byte totals, then passed read-only full-integrity Storage Health with no error findings.
- JS heap before ~4.0 MB, after download/verify ~66.5 MB and after workflows ~68.5 MB. Samples are nonmonotonic and include application, harness, transient buffers/caches and GC timing. They exclude total process/GPU/worker/native/Blob memory. No leak-free or long-running memory certification is made.

Configured ceilings remain 2 GiB archive, 256 MiB fallback/video, 25 MiB image and 50 MiB PDF with other documented bounds. **None of those maximum sizes was operationally qualified.** The sample PNGs are ~0.86 MiB each; no near-limit individual file, >256 MiB streaming export or 2 GiB publication was tested. The highest successful sample is not a recommended maximum. Intended venue-scale qualification and sustained responsiveness remain MANUAL QA.

Controlled quota failures are injected transaction exceptions, not actual disk-full/eviction experiments. No system-disk fill, repair, migration or unsafe cleanup occurred.

## Harness corrections and traceability

Evidence preserves failed attempts rather than overwriting their meaning:

- `browsers-initial-harness-error.json`: probes depended on a preview server that had already stopped; self-contained random-port server corrected the harness.
- `e2e-targeted-initial-assertion-error.txt`: Black keeps lyrics mounted but hidden; the initial test incorrectly expected DOM removal. Final assertion uses output data-mode, consistent with existing renderer tests.
- `storage-initial-preview-race.json`: measurement started before the newly prepared video replaced the previous source. Final harness waits for changed source and decoded data.
- `storage-initial-large-buffer-transport.json`: large buffer transport through automation timed out. Final harness uploads the saved synthetic archive by local path.
- Update diagnostic attempts and final identity-aware results are retained as described above.

These are not unapproved product fixes. PASS rows refer to final executed evidence with the narrower scope specified.

## Release gates, limitations and approvals

| Item | Classification | Required next action |
| --- | --- | --- |
| Physical projector/HDMI audio/fullscreen/device disconnect/venue fonts | MANUAL QA | Complete HARDWARE-QA.md with actual outcomes |
| Installed PWA and pending-update/reopen workflow | MANUAL QA; premature-update drill FAIL | Qualify matching-build procedure; propose changes separately if needed |
| Edge, Firefox, WebKit tooling | BLOCKED | User provides/authorizes appropriate tooling; no install performed |
| Actual Safari, VoiceOver and comprehensive accessibility | MANUAL QA | Run on target environment; keyboard/overflow checks are only partial evidence |
| Four-hour/twice-service playback and sustained memory/CPU | MANUAL QA | Run representative hardware rehearsal |
| Near-limit files/archives, storage pressure, OS crash/power loss/native save failures | MANUAL QA | Use disposable profiles/volumes; do not fill system disk |
| Nine development dependency reports | APPROVAL REQUIRED | Remediation or time-bounded exception, SECURITY-RELEASE.md |
| Broader CSP/Trusted Types/update-policy changes | APPROVAL REQUIRED | No enforcement/replacement authorized |
| Direct PPTX versus original PRD | APPROVAL REQUIRED | Confirm PDF/image release scope or authorize separate implementation |
| Unsafe override remapping, plaintext backups, origin-bound evictable storage, no remote erasure of stale output | KNOWN LIMITATION | Operational acceptance and verified external backup |
| GitHub/Vercel | APPROVAL REQUIRED | No work started; readiness checklist only |

No application production-ready claim is made. No existing user data was altered. See RELEASE-CHECKLIST.md for severity/release policy, HARDWARE-QA.md for the practical MacBook checklist and SECURITY-RELEASE.md for exact advisory paths/options.

## Reproduction and files

New tests: `src/backup/phase8.test.ts`, `e2e/phase8.spec.ts`. Test-only harnesses/config and reproduction instructions: `qa/README.md`. Generated QA artifacts, local metrics and browser/version/worker/cache diagnostics are recorded in the evidence directory; `artifacts.json` identifies build artifacts and final logs. The QA worker markers are confined to `test-results/phase8-build-{A,B}`.

Documentation: this report, RELEASE-CHECKLIST.md, HARDWARE-QA.md, SECURITY-RELEASE.md and an additive current-version note in MEDIA-FORMATS.md. Historical Phase 1–7 implementation reports remain unchanged. **Stop for Phase 8 review and explicit authorization for any subsequent work.**
