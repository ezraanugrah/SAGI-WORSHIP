# Protected staging deployment — 2 November 2026

**DEPLOYED FOR TESTING. PRODUCTION RELEASE HOLD. Hosted regression suite is not fully passing.**

## Destination and build

- Private repository: https://github.com/ezraanugrah/SAGI-WORSHIP
- Branch: `staging`; deployed source commit: `655864ffa4b37e8b986146c9a1d60ce878867933`.
- Vercel account: `ezrasaja9-8810`; user-confirmed scope: `jg` (`jg-ef1a`).
- Project: https://vercel.com/jg-ef1a/sagi-worship
- Deployment: `dpl_FPsAGTuHQrwoF2LFdqJtwtLLA1Gi`, target **staging**, state **READY**.
- Tested URL: https://sagi-worship-mwrsd90er-jg-ef1a.vercel.app
- Staging aliases: https://sagi-worship-jg-ef1a.vercel.app and https://sagi-worship-git-staging-jg-ef1a.vercel.app
- Vite framework, repository root, `npm ci`, `npm run build`, output `dist`; Vercel selected Node 26.x. Cloud build succeeded and generated 207 precache entries, including local PDF resources. Existing nonfatal mixed-import warning and nine dependency findings remain.

## Access protection and deployment controls

Vercel Authentication Standard Protection was explicitly set and independently read back before deployment: `ssoProtection.deploymentType = prod_deployment_urls_and_all_previews`. No paid feature or plan upgrade was selected. Independent curl requests without cookies returned HTTP 302 to Vercel authentication for the tested deployment and both aliases. A corrected Playwright probe with explicitly empty cookie/storage state confirmed the same result. The first temporary Playwright anonymous probe inherited configured authentication, so its HTTP 200 was a harness error and not valid evidence of public access.

The private GitHub repository does not itself protect the site. Sign in to Vercel with authorized account access to open the hosted URL. Protection gates online requests; it does not encrypt or remotely erase an already downloaded offline installation or origin-local worship data.

Git integration selected the repository default branch `staging` as its production branch. To prevent production publishing during this testing release, the project has this ignored-build command:

```sh
if [ "$VERCEL_ENV" = "production" ]; then exit 0; else exit 1; fi
```

Automatic custom-domain assignment is disabled. Git commit/PR comments are disabled. The first API request omitted the target, following the API description, but Vercel inferred Production from the Git branch. That request (`dpl_3mQvb6U5f6pfJwZyiDCArrHxJ3ZE`) was **CANCELED**, with no alias assigned; its intended production URL returned 404. The CLI has no cancel command, and a subsequent API cancellation found it already canceled. The API rejected literal target `preview`; the successful request explicitly used supported target `staging`. No Production target is present in the final project metadata.

Future branch mapping/production promotion requires separate review. The production-build guard is a build control, not authorization for production use. This task leaves no ready Production deployment.

For testing, Vercel CLI generated one automation access credential. It remained outside Git and was revoked after the checks; the project API then showed zero automation bypass entries and unchanged access protection. No bypass link or secret is included here. Local `.vercel` metadata and the CLI-created `.env.local` remain ignored. No cloud runtime service was introduced.

## Executed checks

All app data was synthetic and confined to fresh disposable browser contexts or a newly generated temporary persistent profile on the deployed origin. Existing user browser databases were not opened, reset or migrated. Localhost data was not assumed to transfer.

| Check | Result |
| --- | --- |
| Prior local typecheck / production build | PASS |
| Prior local unit tests | PASS — 148 tests, 12 files |
| Prior local Chromium E2E | PASS — 66 tests |
| Hosted Chromium regression run, no retries | **65 PASS / 1 FAIL**, 4.0 minutes |
| Normal Dashboard and Settings, hash-route refresh, IndexedDB | PASS |
| Normal Dashboard/Settings console and page exceptions | PASS — none observed |
| Songs, synthetic Scripture import/search, media, themes and schedules | PASS in hosted regression scope |
| Preview/LIVE isolation, second projector window, refresh, reconnect, explicit checkpoint Resume | PASS in hosted regression scope |
| Normal Black, Clear Text and Restore | PASS |
| Synthetic portable backup/export, fresh-context restore and rollback protections | PASS |
| PWA offline operation and reload | PASS in hosted regression scope |
| Full browser shutdown and offline restart with the same disposable profile | PASS — retained synthetic song and Settings loaded offline |
| Two-page synthetic PDF imported/rendered after offline browser restart | PASS |
| Offline projector pairing, PDF LIVE, Black/Restore and projector refresh | PASS |
| Anonymous online access on deployment and both aliases | PASS — Vercel sign-in required |
| Root service worker / manifest scope and start URL | PASS — `/`, active worker and cache present |
| PDF module worker, CMap, font, WASM, ICC and icon asset requests | PASS — HTTP 200 with suitable MIME types |
| Accidental hosted `.env.local`, `.git/config`, documentation exposure probes | PASS — authenticated requests returned 404 |

The hosted run used temporary copies of existing E2E tests. Only base URL, authentication cookies, fixture import paths, evidence paths, timeouts and the hardcoded fresh-restore localhost URL were adapted. Application and source tests were not modified. Tracing was disabled to avoid retaining authentication headers/cookies in artifacts. The additional browser restart and hosting checks were temporary harnesses, not product features.

## Unresolved hosted regression

`phase5.spec.ts`: **corrupt media cannot replace valid audience output and Black works through checkpoint failure** failed waiting for connection status `Error`; it remained `Menunggu render` for 20 seconds. This failure was preserved, not converted into a passing retry.

A bounded follow-up initially exposed an additional harness timing issue: the initial asset ID could be captured before the valid image finished rendering. After explicitly awaiting that initial valid image, the follow-up still reproduced the connection-label failure. The follow-up continued past that status assertion and independently verified:

- the last valid media asset remained on the audience output;
- emergency Black reached `data-mode=black` even when checkpoint writes threw a synthetic quota error;
- the checkpoint failure warning was visible.

Thus the tested corrupt asset did not replace the retained valid frame, and emergency Black worked in this diagnostic. The connection/error-state regression remains a release blocker requiring separate investigation. No application fix or architecture change was made under deployment authorization.

## Headers, caching and remaining limits

Authenticated HTML, manifest, worker and sampled local PDF resources returned `Cache-Control: public, max-age=0, must-revalidate`, behind the verified Vercel authentication gate. HSTS was present. `sw.js` is at the root, so default directory scope permits `/`; no broader Service-Worker-Allowed override was needed. Offline resources are served by the existing Workbox precache. No hosting header override, CSP/Trusted Types policy, schema migration or service-worker logic change was introduced.

Remaining production gates include the hosted regression above; nine known development-tool dependency findings (2 low, 7 moderate, no high/critical reports in the refreshed pre-deployment audit); installed-PWA update timing qualification; physical projector/fullscreen/audio and sustained rehearsal QA; real storage/eviction/power-failure boundaries; target browser qualification; and the existing PPTX scope decision. See RELEASE-CHECKLIST.md, SECURITY-RELEASE.md and HARDWARE-QA.md. Passing bounded automated tests is not production worship approval.

Local detailed results and screenshots are under ignored `test-results/hosted-*`; JSON reporter files are under `test-results/test-results/`. Credential-bearing account/session files are excluded from committed evidence. No new account authorization is needed for this completed staging deployment; manual sign-in is required to view its protected URL. Further development and any production release require separate instructions.
