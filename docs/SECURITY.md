# Phase 7 security review

Application 0.7.0, offline-only. This is an application threat-model review and automated evidence, not a penetration-test certification or release approval.

## Boundaries and reviewed threats

- WriterGate remains based on a real origin-scoped Web Lock. Repository-level maintenance permits block ordinary tickets, reject active tracked writes, invalidate earlier asynchronous tickets and abort tracked transactions on revocation. Presentation tickets are refreshed after maintenance; successful restore requires reload before further mutation.
- Projector bootstrap never acquires WriterGate or constructs restore/repair services. Its asset reader remains read-only and scoped to validated presentation references. Session retirement closes the owned window and generates new session/epoch/pair identities. Exact-origin/known-window postMessage, paired BroadcastChannel, nonce/version/sequence checks remain.
- Checkpoints are data, not restored authority. Old IDs may remain as inert historical metadata in candidate records; old pairing capabilities, window handles and playback permission are never reused. New output begins black, recovery is explicit and paused.
- The worker rejects malformed UTF-8, noncanonical/duplicate-field JSON, prototype-related keys, unexpected versions/fields, duplicate rows, invalid offsets/order/lengths, oversized inputs, incomplete trailers and hash mismatches. There is no archive path extraction, generic object merge, script evaluation or arbitrary CSS/HTML insertion.
- Imported text/names/notices use React text rendering. Media uses the existing bounded parsers/decoders and scoped Blob URLs. No remote asset/conversion service, runtime CDN, analytics or automatic upload was added.
- Scripture export checks include frozen datasets/checkpoints/candidates. False permission is not bypassed by deleting the source dataset, declaring a backup complete, or rewriting a container header. Rights attestation is required by the restore confirmation. Authenticity and legal entitlement cannot be proved by locally supplied metadata/hashes.
- A consistent backup is read-only and does not flush/mutate LIVE. Decode, hash, staging and final publication have cancellation/intent boundaries. Restoration cannot publish while LIVE/owned output is active. Black stays independent of storage/decoding during normal authorized presentation.
- Media retention covers theme, checkpoint and candidate dependencies. Missing/corrupt pins block reclamation; repair adds verified protection rather than deleting ambiguous owners. Journals/receipts do not recursively archive themselves.

## PWA and storage review

The existing prompt/deferred-update service worker configuration is preserved. Backup worker bundles and existing local PDF assets are precached through the existing JS/static patterns. User backups are download/file-handle objects, never added to a runtime cache or public application directory. Temporary staging databases and application data remain origin/profile-local IndexedDB, not service-worker Cache Storage.

A fresh origin must cache/install the application before fully offline restore. No archive restores permissions, service workers, external display selection or executable application code. Never update one presentation window independently during a service. No service-worker replacement or deployment was performed.

Quota, eviction, private browsing, cleared site data and browser/OS storage durability remain platform risks. Staging uses additional origin quota. Failed destination publication rolls back; a retained incomplete staging database may still consume space until explicitly removed.

## Dependency findings

Runtime and full audit JSON are in `docs/evidence/phase-7-{runtime,full}-audit.json`. Current checks: runtime **0**, full **9 development findings (2 low, 7 moderate; 0 high/critical)**. Full audit exits 1 because findings remain. No dependency upgrades, overrides, `audit fix`, production renderer or new production package were applied; only application version metadata changes to 0.7.0.

Locked affected chain:

| Package | Locked version | Review |
| --- | --- | --- |
| workbox-build | 7.4.1 | Propagates affected node-resolve, off-main-thread plugin and glob paths |
| @rollup/plugin-node-resolve | 16.0.3 | Depends on deepmerge ^4.2.2 |
| deepmerge | 4.3.1 | Prototype-poisoning advisory; reviewed advisory lists no patched version |
| @trickfilm400/rollup-plugin-off-main-thread | 3.0.0-pre1 | Pulls EJS/Jake build tooling |
| ejs | 3.1.10 | Propagates Jake/filelist/minimatch finding |
| jake | 10.9.4 | Legacy filelist dependency |
| filelist | 1.0.6 | Nested minimatch ^5.0.1 |
| glob | 11.1.0 | Cancellation advisory; patched advisory version 14.0.2 is a major change |
| minimatch | 10.2.6 and nested 5.1.9 | Amplification advisory; patch listed at 11.0.1 crosses existing major ranges |

Nine affected package reports derive from three underlying advisory families; they are not nine independent audience-runtime exploits. Build-time placement limits direct runtime reachability but remains a build-system/supply-chain concern.

References: [deepmerge](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).

Remediation proposal: first evaluate upstream compatible Workbox/node-resolve/plugin patch releases with their dependency/Node engine constraints; then test reviewed scoped overrides only where API compatibility is demonstrated. Do not force glob 14 or minimatch 11 into legacy consumers based solely on `fixAvailable: true`. Deepmerge needs an upstream removal/fix or separately reviewed replacement. A service-worker build replacement or significant build-chain change requires separate approval. Any approved remediation must rerun production generation, offline activation/update behavior, all tests and both audits.

## Residual risks and exclusions

SHA-256 detects accidental content changes, not a malicious party rewriting bytes and hashes together. No publisher signature trust store, antivirus, digital-rights enforcement, encryption/password backup, secure deletion or OS forensic recovery is supplied. Backups contain sensitive plain data; keep them in trusted storage with appropriate access controls. Browser codecs/fonts differ between machines, and first-frame/integrity validation cannot certify every later media frame.

A hostile same-origin script, compromised executable build, privileged extension, developer tools or OS attacker exceeds the isolation offered by WriterGate and projector capabilities. Read-only database access is not a confidentiality sandbox. Network-origin checks do not authenticate an arbitrary same-origin malicious script.

CSP/Trusted Types enforcement was reviewed as a future hardening option but not introduced without target-browser testing for local Blob media, module/PDF workers, WASM and the current style renderer. No claim of comprehensive CSP enforcement is made.

Physical projector/audio, installed-PWA permissions, actual file-system cancellation/disk-full behavior, power interruption and near-limit storage/memory testing remain manual QA. Phase 8 is not implemented.

## Targeted restore integrity correction (2 November 2026)

Review identified that row-level parent equality could hide conflicting Song sections or Schedule items, allowing a structurally valid imported schedule to resolve to different destination lyrics. Restore planning now compares canonical complete aggregates and resolved dependencies, promotes child collisions to parent conflicts, and applies whole-aggregate skip/duplication rules. Skipped Schedule/child conflicts also trigger conservative unsafe-override rejection. Signatures are cached local integrity comparisons, not publisher authentication.

Four failing-before-fix regressions and subsequent aggregate/publication tests are recorded in `docs/evidence/phase-7-merge-*.txt`. Populated-destination tests verify receipt-quota/cancellation/ownership rollback, stale-revision rejection and maintenance protection. No WriterGate, transaction boundary, schema, checkpoint or normal presentation change was made. Fresh runtime/full audits report 0 runtime and the same 9 development findings (2 low, 7 moderate); no dependency or security remediation was applied. Existing hardware/platform/rights and near-limit performance risks remain. This is a targeted integrity correction, not a renewed full security certification or release approval.
