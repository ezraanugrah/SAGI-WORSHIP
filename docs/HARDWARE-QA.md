# Physical projector and MacBook acceptance

Phase 8, 2 November 2026. **MANUAL QA — not executed by the automated agent.** No check below is passed until an operator records its result. Headless Chrome, Playwright Chromium and renderer acknowledgements do not establish physical display or audible output.

## Record the run

- Operator/date/build identity: __________
- MacBook/model/RAM/macOS: __________
- Browser/version; browser window or installed PWA: __________
- Projector/model/native resolution/refresh rate: __________
- Adapter/cable/dock; extended-display arrangement: __________
- Audio route (HDMI, USB interface, headphones, mixer): __________
- Authorized fixture names and actual codec profiles: __________
- Result per check: PASS / FAIL / BLOCKED / MANUAL QA; evidence and issue number: __________

Use a dedicated QA browser profile and synthetic/authorized source material. Keep a verified external backup. Never fill the system disk, clear the working operator's site data, or run fault injection during a service.

## Display and fullscreen — MANUAL QA

- [ ] Connect using extended desktop; retain the operator on the MacBook.
- [ ] Test actual 1920×1080 and 1280×720 output where supported. Record native resolution and refresh rate; application reference canvas does not set OS resolution.
- [ ] Test Fit and no-upscale, macOS scaling, letterboxing, projector overscan and any 4:3 venue output. No cropped lyrics or footers.
- [ ] Open output using an operator gesture. Test allowed/denied popup and screen-selection permission. Manual window placement must remain usable.
- [ ] Enter fullscreen directly in the projector, leave using Escape and re-enter. No operator chrome or controls remain visible to the audience after idle fading.
- [ ] Unplug/replug the display and dock; confirm an actionable operator status and an understood manual recovery path. Browser ACK is not a powered-projector detector.

## Typography and content — MANUAL QA

- [ ] Run songs with repeated sections and a mixed schedule with repeated songs, images, video and portrait/landscape PDF pages.
- [ ] Compare song authoring order with presentation order and every repeated occurrence.
- [ ] Inspect Arial, Georgia and Verdana; bold/italic/outline/shadow; smallest/largest intended font sizes and configured safe margins from the back of the room.
- [ ] Inspect combining accents, Indonesian punctuation, required non-Latin languages and long unbroken text. Record unavailable glyphs/font substitution.
- [ ] Present a permitted multi-slide Scripture selection. Every continuation must preserve the exact verse text, reference, edition and attribution. Inspect footer readability and clipping at both resolutions.
- [ ] Test solid/gradient/image/video backgrounds and low-contrast source material. Contrast warnings are advisory, not certification of moving backgrounds.
- [ ] Compare complex PDFs against a trusted local exporter. Flatten interactive forms/annotations before import; direct PPTX is unsupported.

## Video and HDMI audio — MANUAL QA

- [ ] Record actual container/video/audio codecs, frame rate, resolution, bitrate and duration; MP4/WebM extension alone is insufficient.
- [ ] Test venue H.264/AAC MP4 and VP8/Vorbis WebM fixtures plus every intended production codec. The automated fixtures are 3-second 640×360 samples, not broad codec qualification.
- [ ] Confirm video enters LIVE paused. Grant audible playback only through the actual browser gesture/permission path.
- [ ] Route projector audio through HDMI/mixer; confirm no duplicate operator-monitor sound, clipping or unexpected unmute.
- [ ] Test Play, Pause, Mute, volume 0/50/100%, Loop on/off, seek, video end and final-frame hold. No automatic schedule advance.
- [ ] Confirm background video is always silent and independent of foreground video audio.
- [ ] Press Black while foreground/background video plays: reachable output hides and becomes silent/paused. Restore must remain paused until a new explicit Play.
- [ ] Refresh/reopen output and restart the operator. Resume/Discard is explicit; neither video nor audio starts automatically.
- [ ] Play complete intended videos, including late frames and repeated loops. First-frame import success does not certify the remainder.

## Reliability rehearsal — MANUAL QA

- [ ] Run a representative service for at least four hours or twice the planned service duration, whichever is longer. Record memory/CPU/temperature, dropped frames, audio glitches and control latency periodically.
- [ ] Edit source text, change preferences/themes and prepare Preview during LIVE. Existing audience output stays frozen until explicit presentation commands.
- [ ] Test Previous/Next, Clear Text, Black/Restore, Go Live, Reconnect and projector close/reopen.
- [ ] Focus LIVE and test Left/Right/Space/B/C; type the same keys in editors/search and confirm no unintended presentation command.
- [ ] Interrupt communication in a QA setup. Established output may retain its last frame/playback; emergency commands cannot be guaranteed to reach an unavailable window. Practice physical/manual closure.
- [ ] Restart the operator after a saved checkpoint. Close any old output manually; use explicit Resume/Discard and a newly paired output. No automatic takeover.
- [ ] Test denied fullscreen/audio/screen permissions; the documented fallback must be usable.

## Offline, backup, update and storage — MANUAL QA

- [ ] Cache/install the exact build first, disconnect networking, quit/reopen and run the mixed service including PDF and restored media.
- [ ] Export during LIVE, reopen the external file and verify it. Confirm output is unchanged. Store a second verified copy outside browser storage.
- [ ] Restore into a separate QA profile, end the session, review conflicts/rights, publish, reload and choose recovery explicitly.
- [ ] Exercise real save-picker cancellation, overwrite cancellation and test removable-drive removal. Controlled disk-full testing requires a disposable volume, never the system disk.
- [ ] Record origin quota estimates/persistent-storage permission. Test representative real workloads; the configured 2 GiB archive ceiling is not qualified.
- [ ] Test the installed-PWA A→B update after service. Record pending update, close all SAGI windows, and verify matching new builds before reopening output. If the old build persists, record FAIL; do not clear site data or force activation during LIVE. Consult PHASE-8.md for automated update findings.
- [ ] Confirm all source records/settings/media remain after update and recovery. Verify fresh output is paused and requires explicit commands.

## Accessibility and release sign-off — MANUAL QA

- [ ] Keyboard-only navigation, visible focus, dialog focus return, labels/status announcements and macOS VoiceOver.
- [ ] Operator layout at normal and 200% zoom and narrow windows; emergency controls remain reachable.
- [ ] Repeat the required workflow in target Chrome and Edge versions and installed-PWA mode. Safari needs actual Safari testing; Playwright WebKit would not certify it.
- [ ] Record every failure/blocker and explicit limitation acceptance. Obtain security and browser/storage support decisions separately.

Acceptance: no unresolved Critical/High defect, no wrong content/order/attribution, no data loss, usable emergency controls on healthy output, no automatic recovery playback, and all required venue workflows passed. This blank checklist is not release approval.

## Indonesian operator worksheet — release-gate follow-up

For step-by-step actions, expected results, blank PASS/FAIL fields and evidence collection, use [Panduan uji manual operator MacBook](PANDUAN-UJI-MANUAL-ID.md). It distinguishes tests without a projector from physical display/audio acceptance. No manual result was entered by this documentation follow-up. Release remains HOLD.
