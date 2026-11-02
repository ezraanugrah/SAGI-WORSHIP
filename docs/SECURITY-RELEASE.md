# Phase 8 security release assessment

2 November 2026. Application 0.7.0. **Not security clearance or production release approval.** No dependency upgrade/override, audit fix, service-worker replacement, CSP/Trusted Types enforcement, cloud integration or deployment was performed.

## Executed checks

| Check | Status | Evidence |
| --- | --- | --- |
| Runtime audit | PASS — 0 recorded findings | evidence/phase-8/runtime-audit.json |
| Full audit | APPROVAL REQUIRED — 9 development findings: 2 low, 7 moderate, 0 high/critical; expected command exit 1 | evidence/phase-8/full-audit.json |
| Locked dependency paths | PASS — read-only graph inspection executed | evidence/phase-8/dependency-paths.json |
| Upstream metadata | PASS — read-only registry lookups executed, no install | evidence/phase-8/upstream-*.json |
| Repository/maintenance/rollback, archive corruption, licensing and session validation | PASS for automated fixtures | unit.txt, e2e-chromium.txt, e2e-chrome.txt |
| PWA build replacement | PASS after actual B activation; premature reopen/restart drill FAIL to upgrade with data retained | PHASE-8.md, update-activation-*.json and update-persistent-*.json |
| Physical/browser permission and OS failure boundaries | MANUAL QA | HARDWARE-QA.md |

Audit findings are package reports, not nine independent runtime exploits. A runtime audit reporting zero is neither a bundle penetration test nor evidence that the development toolchain is safe against all inputs.

## Dependency paths, exposure and options

All nine affected package reports are development-only according to the refreshed audit. Root paths begin with `vite-plugin-pwa -> workbox-build`.

| Advisory/root issue | Locked path | Exposure assessment and proposed action |
| --- | --- | --- |
| deepmerge prototype poisoning, low | workbox-build 7.4.1 -> @rollup/plugin-node-resolve 16.0.3 -> deepmerge 4.3.1 | Build configuration/plugin option processing. The reviewed configuration is repository-controlled; browser backup/media content does not enter this build step. This reduces observed reachability but does not prove absence of supply-chain/CI exposure. The advisory lists no patch. Latest queried node-resolve remains 16.0.3 with deepmerge ^4.2.2. Seek an upstream removal/fix or separately reviewed replacement. |
| glob cancellation bypass, moderate | workbox-build 7.4.1 -> glob 11.1.0 | Precache filesystem traversal during build. Current glob patterns are static configuration; a cancelled traversal can continue. Glob 14.0.2 is patched but is outside Workbox's ^11.0.1 range. No drop-in compatible patch was established. |
| minimatch amplification, moderate | workbox-build -> glob -> minimatch 10.2.6; and workbox-build -> @trickfilm400/rollup-plugin-off-main-thread 3.0.0-pre1 -> ejs 3.1.10 -> jake 10.9.4 -> filelist 1.0.6 -> minimatch 5.1.9 | Attacker-controlled pattern amplification is a build-tool concern. No path from user-entered runtime lyrics/imported archives to these pattern APIs was observed. Untrusted repository content/configuration remains a concern. Patch 11.0.1 crosses both consumer ranges. No forced major override is justified by audit metadata alone. |

The other propagated package reports are node-resolve, the off-main-thread plugin, EJS, Jake, filelist and workbox-build. Their presence in this table does not imply separate direct advisories against each package.

Read-only upstream results: latest queried Workbox is 7.4.1 (Node >=20), latest node-resolve is 16.0.3, and off-main-thread plugin is 4.0.0 with EJS ^7.0.1. Plugin 4 is outside Workbox's ^3.0.0-pre1 range and changes a template dependency across major versions. Its API/Node/transitive security compatibility was not tested, and it would not by itself remove the independent deepmerge/glob paths. Therefore no verified upstream-compatible complete remediation was found during this assessment.

Sources checked on 2 November 2026: [deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), [glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249). Exact queried metadata and installed paths are retained locally with the evidence.

## Decisions — APPROVAL REQUIRED

1. Prefer a compatible upstream Workbox/plugin release when available. Refresh metadata/audits before proposing exact versions.
2. If no compatible release exists, separately evaluate a narrowly scoped override/replacement in an isolated change, with consumer API and Node-engine tests. No such change is authorized by Phase 8 QA alone.
3. Alternatively, accept the specific development-tool findings temporarily with an owner, expiry date, review trigger and trusted-input/build-environment restrictions. This assessment does not accept risk on the user's behalf.
4. Any remediation must rerun typecheck, build, both audits, unit/E2E suites, offline installation, A→B updates and media/PDF worker paths. Do not use `npm audit fix --force`.
5. CSP/Trusted Types and hosting headers require separate approval and testing for Blob media, module/PDF workers, WASM, styles, and opener/postMessage fallback. No policy is enforced here.
6. The premature-update reopen/restart behavior requires installed-PWA operational qualification. The activation-aware A→B lifecycle passes; any product change to activation/notification or acceptance of a timing-dependent procedure requires separate review. No production service-worker code/policy was modified to make the test pass.

## Residual boundaries — KNOWN LIMITATION

- Hashes detect accidental corruption; they do not authenticate publishers or defend against coordinated rewriting of bytes and hashes.
- Backups are plaintext and may include private worship content. No encryption/password storage, antivirus certification or secure deletion is provided.
- Rights metadata/attestation is not proof of legal entitlement. No real copyrighted Scripture corpus was added to tests.
- Same-origin malicious scripts, privileged extensions and OS attackers exceed the WriterGate/projector boundary. There is no confidentiality sandbox between arbitrary scripts on the same origin.
- Browser parsers/codecs and OS fonts remain part of the platform threat/reliability surface. First-frame validation is not complete media certification.
- Quota, eviction, cleared site data and disk/power failures can defeat local persistence. Pins and staging databases are not external backups.
- No penetration test, exhaustive fuzzing, new policy enforcement or future hosting security validation was performed.

## Release-gate follow-up — proposed disposition, no remediation

See [Disposisi risiko rilis (Indonesian)](DISPOSISI-RISIKO-RILIS-ID.md) for R01–R09, separate compatible-remediation investigation and temporary-risk options, owner/expiry/review conditions and blank approval fields. All options remain pending user approval. Advisory pages were checked read-only; no new npm audit, dependency change or enforcement policy was applied. The existing audit evidence and Phase 8 test results are preserved.
