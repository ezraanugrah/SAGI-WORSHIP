# Release gate checklist — Phase 8

2 November 2026. **NOT PRODUCTION-READY.** This is a local readiness assessment; no GitHub or Vercel work has begun.

Status vocabulary: PASS = executed and verified for stated scope; FAIL = reproduced failure; BLOCKED = missing environment/tooling/hardware; MANUAL QA = operator action needed; KNOWN LIMITATION = documented design boundary (release acceptance still required where material); APPROVAL REQUIRED = outside current authorization. Never convert an unexecuted item to PASS.

## Candidate baseline

Current application metadata remains 0.7.0. IndexedDB schema v1, twelve existing stores, projector protocol v4, new checkpoint writes format 4; checkpoint reads formats 1–4 and overrides formats 1–2. Historical reports retain their original version statements. See PHASE-8.md for executed test counts and exact evidence.

## Automated and operational gates

| Gate | Status | Required disposition |
| --- | --- | --- |
| TypeScript, production build, unit/integration, complete Chromium/Chrome E2E | See PHASE-8.md | Require final logs, zero unexplained failures; no retry-only pass |
| Restricted/exportable deleted-source frozen Scripture and candidates | PASS | Exact text/attribution and licensing covered by new isolated tests |
| Song/Schedule equal-parent child conflicts | PASS | New browser regression plus prior aggregate tests |
| Atomic rollback, maintenance, stale-session rejection, retained media/theme, offline recovery | PASS for automated fixtures | Real OS termination/storage and hardware remain separate |
| A→B PWA update | See PHASE-8.md | Scope-specific results; do not infer universal update qualification |
| Installed PWA, real fullscreen/display/audio, four-hour rehearsal | MANUAL QA | Complete HARDWARE-QA.md |
| Edge macOS | BLOCKED | Browser not installed; no download performed |
| Firefox/WebKit exploration | BLOCKED | Matching Playwright engines unavailable; installed Firefox alone is not the Playwright-patched binary |
| Actual Safari | MANUAL QA | No Safari compatibility claim from Chromium/WebKit |
| Storage capacity and sustained memory behavior | MANUAL QA | Bounded sample is not a supported ceiling or leak-free soak |
| Runtime dependency audit | PASS for recorded audit | Refresh again at eventual release freeze |
| Nine development findings | APPROVAL REQUIRED | Remediation or explicit time-bounded exception; SECURITY-RELEASE.md |
| Direct PPTX requirement | APPROVAL REQUIRED | Original PRD criterion 9 is not implemented. Accepted Phase 5 fallback is local PDF/images; explicitly narrow release scope or separately authorize PPTX |
| Current-version documentation | PASS | MEDIA-FORMATS current compatibility note added without rewriting historical results |

## Severity and acceptance

- Critical: data loss/partial publication, authorization bypass or restricted-content disclosure. Stop testing dependent workflows, report, and obtain correction authorization.
- High: wrong audience content/order, stale-session takeover, loss of emergency controls on healthy output or failed core offline operation. Stop and report before correction.
- Medium: recoverable workflow/update/performance failure with data preserved. Track as a release gate; fix or approve an explicit scoped exception.
- Low: cosmetic/documentation issue without operational impact. Track and disposition.

Release requires: all mandatory candidate tests PASS, no open Critical/High findings, target hardware/browser/installed-PWA acceptance, a qualified intended workload, security disposition, requirements-scope agreement and operator recovery rehearsal. Current unresolved gates prevent production-ready status.

## Known boundaries requiring informed operational use

- KNOWN LIMITATION: origin/profile-local evictable storage; no cloud sync, encrypted backup, publisher authentication or secure deletion.
- KNOWN LIMITATION: backup contains durable supported records, not unsaved editor memory, executable caches/fonts/codecs/permissions or guaranteed final pre-crash playback position.
- KNOWN LIMITATION: unsafe draft/override remapping is rejected; ambiguous/orphan pins are retained rather than automatically erased.
- KNOWN LIMITATION: only one paired projector; no frame-accurate multi-output synchronization. Unreachable output can retain its frame/audio until manually closed.
- KNOWN LIMITATION: first-frame media validation and hashes do not certify every later frame, codec, font or legal entitlement.

## Future GitHub/Vercel review — APPROVAL REQUIRED, not executed

- [ ] Separately authorize repository creation/visibility, Git initialization and any commit/push. None occurred in Phase 8.
- [ ] Before publishing, inspect the exact repository/export for secrets, user backups, copyrighted material, temporary profiles and generated test artifacts. This gate is not claimed complete here.
- [ ] Review runtime/build Node requirements, lockfile reproducibility, CI design, license notices and security exceptions before connecting a build service.
- [ ] Separately authorize Vercel/account connection, project/domain selection and deployment. No cloud service was contacted for hosting.
- [ ] Review HTTPS, static routing, worker/WASM/font MIME types, service-worker scope/cache headers and any proposed CSP/Trusted Types/COOP policy. Do not break Blob/PDF workers or opener-based projector fallback.
- [ ] Plan origin-specific data transfer via verified backup/restore. Localhost, preview URLs, production domains and browser profiles do not share IndexedDB.
- [ ] Plan executable rollback without database clearing/downgrade and a separately authorized hosted/offline smoke test. Local QA cannot certify future hosting behavior.

## Release-gate follow-up — documentation only

[Indonesian manual QA worksheet](PANDUAN-UJI-MANUAL-ID.md) provides operator actions, expected results, device requirements and unfilled result/evidence fields. [Proposed risk disposition and PPTX scope](DISPOSISI-RISIKO-RILIS-ID.md) lists all nine development package reports, compatible-remediation investigation versus temporary-risk options, and approval forms. No exception or PPTX scope is accepted automatically. No manual test was executed by this follow-up; HOLD remains.
