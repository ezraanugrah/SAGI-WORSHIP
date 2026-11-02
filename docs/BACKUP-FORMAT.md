# SAGI portable backup format v1

Phase 7, application 0.7.0. Extension `.sagibak`; binary application data, not an application installer. No compression, encryption, ZIP, base64 media, executable content, external URLs, archive paths, or new production dependency.

## Layout

All offsets/lengths count bytes. Header: eight ASCII bytes `SAGIBAK1`, then an unsigned 32-bit little-endian manifest length. Immediately followed by the manifest's canonical UTF-8 JSON, the concatenated entry bodies, a 64-byte lowercase hexadecimal SHA-256 of the manifest bytes, and eight ASCII bytes `SAGIEND1`.

Manifest exact fields:

- `format: "sagi-backup"`, `version: 1`.
- `id`, `createdAt`, `appVersion` (producer metadata, not a trust assertion).
- `entries`: ordered entry descriptors.
- `bytes`: exact combined entry-body length.
- `complete`: true only when `omissions` is empty.
- `omissions`: bounded human-readable descriptions of aggregate exclusions.

Descriptor exact fields: `store`, `id`, `offset`, `length`, `hash`, `kind`; binary descriptors additionally have `index`. `kind` is `json` or `chunk`; offsets are contiguous, relative to the entry-body start. Every descriptor has a SHA-256 of its exact bytes. The whole file must have exactly the declared length, with no gaps, overlap or trailing data.

Every row begins with one JSON entry. Media payload JSON preserves id, format, size, MIME, digest and chunk hashes, excluding its Blob. Contiguous `chunk` entries immediately follow that row, numbered from zero, with at most 4 MiB each. Restore reconstructs a typed Blob from slices; it never requires a whole-video ArrayBuffer. The row's size, MIME, ordered hashes and existing asset digest are checked independently.

Existing media digest algorithm is preserved: SHA-256 of UTF-8 `JSON.stringify({size, chunks})`, where each chunk hash is SHA-256 of a 4 MiB slice (last slice shorter). It is not a whole-file SHA-256. Archive entry hashes and the manifest hash are separate integrity layers.

JSON is canonical: recursively sorted object keys, JSON escaping, original string values, ordered arrays, no insignificant whitespace. Optional undefined object properties are omitted using JSON semantics. Reader rejects noncanonical encodings, duplicate/ambiguous fields, prototype-related keys, malformed UTF-8, unexpected fields and unsupported required versions. Scripture text is never normalized or corrected.

## Supported records

Container v1 defines the supported Phase 1–7 record schemas; record `format` fields retain their individual versions. Songs and sections, schedules/items, Scripture manifests/verses, media metadata/payloads/pins/tombstones, custom themes/tombstones, known settings/drafts/song tombstones, override formats 1–2 and checkpoint formats 1–4 are validated. Theme signatures and Scripture content/verse hashes are recalculated.

`backup_manifest` exports supported recovery candidates. Operational staging journals, publication receipts and repair receipts are validated and excluded from recursive archives. Unknown rows are not silently skipped: normal backup/restore refuses them, preserving the source. Built-in themes remain application definitions. Transport pairing capabilities and window references are not portable state.

Normal restore rejects corrupt or future-version archives. No heuristic format conversion or partial salvage is implemented. Original files remain untouched.

## Bounds

- Archive: 2 GiB including headers/trailer.
- Manifest: 8 MiB.
- Combined serialized row metadata: 64 MiB.
- Rows: 250,000; payloads: 4,096.
- Binary entry/hash slice: 4 MiB.
- JSON entry: 17 MiB (room for a bounded 16 MiB legacy deck plus its checkpoint/candidate wrapper).
- Browser download fallback: 256 MiB; larger exports need the optional user-selected streaming file sink.
- Existing application limits remain: image 25 MiB, video 256 MiB, PDF 50 MiB, dataset 32 MiB/100,000 verses, deck 16 MiB/10,000 frames, and existing typography/selection limits.

These are refusal ceilings, not hardware/browser performance certifications. Metadata and Blob handles are held in bounded collections; metadata/structured-clone overhead and browser-internal Blob copies consume additional memory/storage. The automated multi-chunk test uses 9 MiB, not a 2 GiB production corpus. Near-limit publication and file-save testing on target hardware remains manual QA. If atomic publication proves unreliable, lower limits or another architecture require review; never switch to partial destination commits.

## Completeness and permissions

Scripture export permission is checked on datasets and frozen checkpoint/candidate license tables, including snapshots whose source dataset was removed. Restricted datasets, their verses, complete dependent schedules/items, affected active selection and restricted checkpoints/candidates are excluded as whole aggregates. A partial export requires explicit confirmation and retains its omission manifest on import preview. It is never described as a complete backup.

Song/media legal entitlement is not mechanically verifiable. Restore confirmation includes entitlement and license compliance. Hashes do not authenticate a publisher or prevent coordinated rewriting of both content and hashes. No encryption or password prompt is implemented.

## Verification

Reopen the saved file using **Verifikasi file**. The worker checks the complete container, records, relationships, Scripture licenses/content, theme signatures and payload integrity. It does not merely check the filename. Successful download initiation alone is not proof that an external copy was saved. Keep verified copies outside browser storage.
