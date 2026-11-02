# Initial staging deployment audit

Date: 2 November 2026. Status: **PRIVATE GITHUB PUSH VERIFIED; VERCEL SCOPE CONFIRMATION PENDING. PRODUCTION HOLD.**

## Deployment continuation

The user subsequently confirmed private destination `ezraanugrah/SAGI-WORSHIP` and the personal Vercel account connected to GitHub `ezraanugrah`. Production release remains **HOLD**. GitHub and Vercel CLI device authentication have been initiated; identity verification must complete before remote creation. Local Git was initialized on branch `staging`, with no previous history or remotes to preserve.

The pre-upload candidate audit was repeated: 446 files, approximately 7.9 MB total, no file over 1 MiB, no symlinks and no credential-pattern matches. Candidate extensions and binary files were inventoried. Documentation images show the application and synthetic test materials; licensed PDF support assets retain license notices. Browser databases/profiles, backup archives, environment files, build output, dependencies and disposable test artifacts are excluded. No personal dataset or real Scripture corpus was found among the source fixtures. Explicit staging and a final staged-file audit are still required before upload. The original audit below is retained as the historical record.

## Verified GitHub result and Vercel blocker

- GitHub CLI API verified login `ezraanugrah`, ID `173744606`.
- Created https://github.com/ezraanugrah/SAGI-WORSHIP and independently verified visibility **PRIVATE**.
- Pushed branch `staging`; remote ref independently verified as `096967142b6892929bbec8e9b3181c61b7f413d5`, the initial audited source commit. No force push or history rewrite. The repository default branch is `staging`.
- Vercel CLI 65.9.0 authenticated as `ezrasaja9-8810`. Available scope is `jg`, slug `jg-ef1a`, Hobby plan. User metadata alone did not establish the GitHub connection. Confirmation of this actual scope was requested before project creation.
- No Vercel project, Git connection or deployment was created; no hosted smoke checks were executed. Protection availability/cost and actual GitHub integration still need verification before publishing. Do not import with a flow that silently publishes the default branch as production.
- The previously completed local checks remain applicable: no application source, dependencies, schema or PWA policy changed in this continuation. Production status remains HOLD, including the existing security/manual QA gates.

The sections below preserve the pre-upload audit and its then-outstanding gates as historical evidence; the verified result above supersedes their account-selection and GitHub-upload status.

The user authorized an initial private GitHub repository and a Vercel testing/staging deployment. At the original audit checkpoint no repository or deployment had been created, and nothing had been uploaded.

## Local checks executed

- `npm run typecheck`: PASS.
- `npm test`: PASS, 12 files / 148 tests.
- `npm run build`: PASS. Vite's mixed static/dynamic import warning for media/models is nonfatal.
- `npm run test:e2e`: PASS, 66 Chromium tests, 2.1 minutes, no retries. Fresh disposable contexts exercised synthetic Songs, Scriptures, Media, Themes, schedules, IndexedDB persistence, offline loading, PDF rasterization, two-window presentation, Black/Clear/Restore, checkpoint recovery and backup/restore. These are localhost results, not hosted smoke checks.
- Fresh `npm audit --json`: 9 reports (2 low, 7 moderate, 0 high, 0 critical), unchanged development-tool dependency families described in SECURITY-RELEASE.md. No dependency remediation or risk acceptance was performed. Raw fresh audit retained locally in the temporary directory, outside upload candidates.
- File scan excluding dependencies/build/test-output directories: 446 files, no credential-pattern matches and no file above 1 MiB. Pattern scanning is not a guarantee of secret absence. Reviewed Scripture and generated media fixtures are original synthetic test material. PDF support files include their upstream license notices.

## Git and upload boundaries

No `.git` directory or existing remote was present. Git has not been initialized, staged or committed. Connected GitHub accounts are `riversidestudioid` and `ezraanugrah`; owner selection is pending. Local `gh auth status` reports an invalid token for active account `ezraanugrah`.

`.gitignore` now also excludes environment files, deployment credentials, local credential directories, browser profiles/auth state, temporary data, backup archives and local databases. Existing source fixtures and documentation remain present. Future staging must use an explicit audited file list and review the staged diff; ignore patterns alone are insufficient. Existing E2E scripts regenerate historical screenshot paths under docs/evidence as well as ignored test output.

## Hosting/PWA inspection

Existing Vite configuration builds to `dist` with `npm run build`. Generated manifest start URL and scope are `/`; root `sw.js` uses prompt registration and navigation fallback `/index.html`. Build precaches 207 entries, including the bundled PDF worker and local CMaps, fonts, WASM and ICC resources. Dashboard/Settings use hash routing. No Vercel configuration, local project link, CLI or connector was available. No hosting headers or PWA policy were changed.

Vercel account/team selection and authorization remain pending. Confirm access protection before any deployment; private GitHub visibility does not protect a hosted website. Do not silently select production deployment, billing or visibility options. Actual response headers, caching, worker scope and deployed asset paths must be verified on the eventual hosted origin.

## Outstanding gates

GitHub owner, valid push authorization, repository creation/visibility verification, branch/commit and Vercel scope/project authorization remain outstanding. No repository URL, commit hash or hosted URL exists from this task. All hosted-origin checks requested by the user remain unexecuted, including console/network inspection, disposable IndexedDB, offline restart, pairing and safe backup/restore. Localhost data does not automatically transfer to a deployed origin.

Retain the documented development dependency findings, installed-PWA update timing limitation, manual hardware/browser/storage qualification and PPTX scope decision. See RELEASE-CHECKLIST.md, SECURITY-RELEASE.md and HARDWARE-QA.md. This audit does not resolve those production release gates. No schema migration, cloud integration, application feature or security-policy weakening was introduced.
