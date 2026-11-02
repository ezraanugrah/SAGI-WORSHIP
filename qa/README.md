# Phase 8 local QA harnesses

These scripts use synthetic data and fresh disposable contexts or newly generated temporary profiles. They never select an existing browser profile. No package installation is required; unavailable browser engines are reported BLOCKED. Results go to `docs/evidence/phase-8/`, generated builds/fixtures to `test-results/`. No production application source or runtime security policy is changed.

## Regression

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e -- --output=test-results/phase8-chromium`
- `npm run test:e2e -- --config qa/playwright.phase8.config.ts` (installed Chrome)
- `node qa/phase8-browsers.mjs` (self-contained capability probes)

Use normal execution approval for local server/browser launch. Run the two full E2E commands sequentially: both use preview port 4174. The original historical tests also write their existing screenshot paths in docs/evidence; their historical text logs are retained.

## Two-build update

Generate distinct builds with unchanged app JS and QA-only HTML identity markers:

```
SAGI_QA_BUILD_ID=A npm run build -- --config qa/phase8-build.config.mjs --outDir test-results/phase8-build-A
SAGI_QA_BUILD_ID=B npm run build -- --config qa/phase8-build.config.mjs --outDir test-results/phase8-build-B
```

For activation-aware diagnostics, prepend `self.__SAGI_QA_BUILD = "A";` / `"B";` to the respective **generated QA** `sw.js` files. This is instrumentation of temporary test artifacts, not a production worker/policy change. The tested artifacts include those markers. Their hashes are recorded in artifacts.json.

- `SAGI_QA_CHANNEL=chrome node qa/phase8-update-activation.mjs`
- `node qa/phase8-update-activation.mjs` (bundled Chromium)

The activation-aware harness checks the actual B worker's own state. It does not call skipWaiting, unregister workers, clear caches or reset IndexedDB. A and B differ in HTML/precache/worker identity; application JS, database and protocol remain the same. It tests this update lifecycle, not a future arbitrary JS/format migration.

`phase8-update.mjs`, `phase8-update-persistent.mjs` and `phase8-update-instrumented.mjs` preserve diagnostic attempts. Immediate reopening or stopping the browser while B was still waiting could retain A. Initial activation inference (`registration.active.state`) was insufficient because it could describe A. Do not interpret those attempts as B activation, data loss, or a successfully qualified update. PHASE-8.md records their disposition.

## Bounded workload

With already-installed ffmpeg: `sh qa/phase8-fixtures.sh`, then `node qa/phase8-storage.mjs`.

The script imports 48 unique 512×512 PNGs, actual 3-second H.264/AAC MP4 and VP8/Vorbis WebM, and a two-page synthetic PDF in installed Chrome. It records 8/24/48-image levels, JS heap observations, search timing, real download bytes, adapter streaming, worker verification, staging/atomic restore and destination integrity/count checks. It does not exhaust quota/disk or qualify a maximum workload, native file picker, audible output, long playback or leak-free sustained memory behavior.

A local static server uses a random loopback port. Disposable persistent update profiles remain at random `sagi-phase8-update-*` paths reported in JSON; they contain synthetic data only. No pre-existing data is repaired or migrated. Review evidence and restrictions before future reruns.
