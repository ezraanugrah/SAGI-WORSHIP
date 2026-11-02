# Media formats — Phase 5

Version 0.5.0. Media is imported from user-selected local files. Nothing is uploaded, automatically downloaded, or converted by a remote service. Import only material you are authorized to store and present. Keep original files separately; media backup/restore is not implemented.

## Current release compatibility note — Phase 8, 2 November 2026

The Phase 5 statements below are preserved as historical implementation results. Current application 0.7.0 keeps IndexedDB schema v1, uses projector protocol **v4**, writes checkpoint format **4**, reads checkpoint formats **1–4**, and reads override formats **1–2**. Old protocol windows must be closed; reopen operator/projector using matching builds after service. Do not infer current protocol support from the historical v3 paragraphs below.

Portable media backup/restore and conservative Storage Health pin repair were implemented in Phase 7; see [BACKUP-FORMAT.md](BACKUP-FORMAT.md), [RECOVERY.md](RECOVERY.md), and [PHASE-7.md](PHASE-7.md). Direct PPTX remains unsupported; export locally to PDF/images. General orphan destruction/automatic expiry remains excluded.

Phase 8 bounded automated workload and PWA update findings are in [PHASE-8.md](PHASE-8.md). Configured per-file/archive ceilings are not hardware-qualified operational limits. Physical codec/audio/projector acceptance remains [MANUAL QA](HARDWARE-QA.md).

## Supported input

| Format              | Initial limit                                                         | Validation and behavior                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JPG/JPEG, PNG, WebP | 25 MiB/file; 40 million decoded pixels                                | Extension/signature/MIME checks, header dimensions where available, browser image decode, thumbnail. Native browser orientation/color behavior applies.      |
| MP4, WebM           | 256 MiB/file; 40 million pixels/frame; finite duration up to 24 hours | Container signature, metadata and first-frame decode. Requires a codec supported by the actual browser/OS. Extension does not establish codec compatibility. |
| PDF                 | 50 MiB/file; at most 300 pages                                        | Local PDF.js 6.4.299 and its matching bundled worker/support assets. First-page thumbnail on import; selected pages rasterized before presentation.          |
| PPTX                | Evaluation only; direct application import is disabled                | No production PPTX renderer installed. Export locally from PowerPoint/LibreOffice to PDF or images and import those files.                                   |

SVG, GIF, HEIC, legacy PPT, remote URLs, DRM/encrypted media, audio-only files and other containers are unsupported. A JPEG advertised as PNG is rejected; a filename/MIME mismatch is not silently corrected. Empty files, oversized files, malformed signatures and decode failures produce errors rather than visible library entries.

Browser decoding is not a full-file certification. A video can pass first-frame probing and fail later due to damaged frames or unsupported tracks. Files without a finite duration, including some streaming-oriented WebM recordings, are rejected clearly. No transcoding, codec downloads, or guaranteed MP4 profile is provided. Use a compatible locally exported file when a codec fails.

## Library and import

Use **Impor media** to select one or more files. Files are processed sequentially, with per-file success/error reporting. Cancellation stops the active and remaining work; previously committed files remain imported. Each file's metadata, original bytes and thumbnail commit atomically. Quota failures, cancellation and writer loss roll back that file's transaction.

Search matches filenames/titles locally. Filters select images, video or PDF. The library displays at most 24 cards per page; thumbnails load only for displayed cards. Metadata shows type, size, dimensions, duration/page count, compatibility notes and integrity identity. Exact duplicate content is rejected without overwriting the existing asset. Different content receives a new immutable identity even if its filename matches; there is no replace-in-place operation.

Secondary tabs can browse and inspect media but cannot import, delete, clean storage, edit schedules or control LIVE. Images/videos can be prepared locally for Preview. PDF page browsing is read-only; preparing persistent PDF presentation rasters requires the writer tab.

## PDF pages

Use the page-thumbnail picker or **Halaman PDF**, for example `1-3,5`. Selection is unique, ascending and limited to 100 pages. Invalid/reversed/out-of-document ranges fail. No page is silently skipped when preparing the selected sequence.

Thumbnail browsing renders six pages at a time. Presentation rasters contain the entire page, preserving aspect ratio within 1920×1080. Portrait/4:3 pages are letterboxed rather than cropped. Selected derivatives have a combined 64 MiB limit. Page loading/rendering and document loading have bounded timeouts; cancellation discards obsolete results.

Pages are rasterized locally, stored with immutable identities and pinned before use. LIVE and checkpoints reuse those exact pixels rather than rerendering with a later PDF.js version. Original PDF bytes are retained while the library owns them; a frozen presentation only requires its selected rasters.

Passwords/encrypted PDFs are rejected. PDF JavaScript, XFA, interactive forms, annotation widgets, attachment launching and link navigation are not enabled. Only static page content is presented; flatten forms/annotations in a trusted local exporter when those visuals are required. PDF.js fidelity, embedded fonts, unusual color profiles and complex PDFs still need visual review. The app does not certify pixel equivalence with Acrobat/PowerPoint.

## Preview, LIVE and video

Media enters Preview independently. It cannot be edited through the text override box. Go Live is explicit and WriterGate-authorized. Previous/Next crosses the frozen mixed Song/Scripture/media schedule and selected PDF pages; it stops at deck boundaries.

Video enters LIVE paused. Existing video/audio preferences are captured for newly prepared presentations, including LIVE loop, initial mute and volume. Updating Settings does not modify active LIVE. Preview has its own native Play/Pause/Mute/Volume controls and separate Loop Preview checkbox. The operator LIVE monitor is silent; the paired projector produces LIVE audio.

- **Play LIVE / Pause LIVE:** change only the paired LIVE video. The operator reports actual projector feedback rather than assuming playback succeeded.
- **Loop / Mute / Volume LIVE:** authorized changes, with volume bounded to 0–100%. There is no boost, mixing, crossfade or timeline editor.
- **Black:** immediately hides media, pauses video and silences audio without waiting for decoding or a checkpoint write.
- **Restore:** restores visibility, keeping a video paused after Black. Play is explicit.
- **Clear Text:** hides Song/Scripture text, while standalone media stays visible because it has no overlay text.
- **Video end:** holds the final frame unless Loop is enabled. It never advances the schedule automatically.

The browser can reject `play()` or audible playback. The operator receives an actionable status and must resolve the browser permission in the projector window, then issue a fresh authorized Play. Fullscreen permission is separate and browser controlled. No automatic takeover or autoplay workaround is implemented.

## Refresh, interruptions and recovery

A fresh/refreshed projector starts black, receives a validated protocol-v3 snapshot, then loads the referenced local assets. Its reader only opens existing IndexedDB in read-only mode and refuses creation/upgrade. It verifies that each requested asset belongs to the validated presentation snapshot, checks stored integrity, and creates local temporary object URLs. It never receives WriterGate, imports files, edits pins or writes checkpoints.

Established output retains valid media during communication interruptions; a playing video continues under its last accepted settings. Operator controls are not guaranteed to reach an interrupted output, so a timeout must be treated as an operational warning. A refreshed/reopened video loads paused at the last available saved position and requires a new authorized Play targeting that document. Playback is not frame-accurate synchronized across windows.

After operator restart, choose explicit Resume or Discard. Resume never starts video/audio automatically. The durable checkpoint may lag playback position; periodic position snapshots are throttled to approximately five seconds. A normal control checkpoint can be newer. Resume uses the latest complete durable record, not a promise of the final pre-crash frame/time.

## Retention and cleanup

The database remains schema v1. Metadata (`meta:`), blobs (`blob:`), retention pins (`pin:`) and deletion markers (`deleted:`) share the existing `media_assets` store. Metadata-only listing avoids loading all blobs. Files are verified in 4 MiB chunks; their ordered chunk-hash/size manifest has its own SHA-256 identity. This detects accidental changes, not a malicious party able to rewrite both bytes and hashes.

Deleting a library item confirms schedule cleanup but does not erase bytes needed by frozen Preview, LIVE, pending replacement or a durable checkpoint. The library estimates bytes owned by library entries separately from bytes retained by snapshots; figures omit unreferenced payloads and browser overhead. Origin-level storage estimates are advisory.

**Bersihkan media tanpa referensi** only removes blobs with no validated metadata/pin references. Unknown/corrupt records or pins block cleanup. Tombstones prevent stale import identities from reappearing. Retired LIVE pins are released only after successful projector acknowledgement of replacement, and checkpoint pins change atomically with the checkpoint. A failed checkpoint retains its old asset pins.

Crash-orphaned session pins and the latest PDF preparation pins remain conservatively retained. They can keep storage occupied after a library item is deleted. There is no automatic age-based purge or unsafe “delete all retained” button; complete orphan review/repair and portable backup remain future work. Keep source files and avoid clearing site data. Browser storage eviction, profile/origin changes, disk failure and user-cleared data can remove assets despite pin records.

Update the PWA only after service ends. Close old operator/projector windows and reopen matching versions. Checkpoint formats 1/2 remain readable; new writes use format 3. Old projectors do not support protocol v3 and must not be used for media output.
