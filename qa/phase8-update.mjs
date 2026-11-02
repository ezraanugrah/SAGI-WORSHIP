// Two independent QA builds, one isolated random loopback origin, fresh browser context.
import { chromium } from "playwright";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
let active = "A";
const contentTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".wasm": "application/wasm",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://local").pathname,
    );
    const base = path.resolve(`test-results/phase8-build-${active}`);
    const target = path.resolve(
      base,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!target.startsWith(base + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const bytes = await fs.readFile(target);
    res.writeHead(200, {
      "Content-Type":
        contentTypes[path.extname(target)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end("missing");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const result = {
  origin,
  date: new Date().toISOString(),
  status: "RUNNING",
  checks: [],
};
let browser;
const check = (condition, label) => {
  if (!condition) throw new Error(label);
  result.checks.push({ label, status: "PASS" });
};
try {
  browser = await chromium.launch({
    channel: process.env.SAGI_QA_CHANNEL || undefined,
  });
  result.browser = browser.version();
  const context = await browser.newContext({ serviceWorkers: "allow" });
  let page = await context.newPage();
  await page.goto(origin);
  check(
    (await page.locator("meta[name=sagi-qa-build]").getAttribute("content")) ===
      "A",
    "build A HTML loaded",
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor
    .getByLabel("Judul lagu", { exact: true })
    .fill("Update preserved composition");
  await editor
    .getByLabel("Lirik bagian 1", { exact: true })
    .fill("Synthetic frozen update lyrics");
  await editor
    .getByRole("status")
    .filter({ hasText: "Tersimpan lokal" })
    .waitFor();
  await editor.getByRole("button", { name: "Selesai", exact: true }).click();
  await page
    .getByTestId("song-row")
    .getByRole("button", { name: /^Update preserved composition/ })
    .click();
  const popup = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Open Projector Window", exact: true })
    .click();
  const output = await popup;
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await output
    .locator(".slide-lines")
    .filter({ hasText: "Synthetic frozen update lyrics" })
    .waitFor();
  await page.getByText(/Checkpoint tersimpan/).waitFor();
  const snapshot = async (p) =>
    p.evaluate(
      async () =>
        new Promise((resolve, reject) => {
          const q = indexedDB.open("sagi-worship", 1);
          q.onsuccess = () => {
            const db = q.result,
              tx = db.transaction([...db.objectStoreNames], "readonly"),
              data = { version: db.version };
            for (const store of db.objectStoreNames) {
              const r = tx.objectStore(store).getAll();
              r.onsuccess = () => (data[store] = r.result);
            }
            tx.oncomplete = () => {
              db.close();
              resolve(data);
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
    );
  const before = await snapshot(page);
  active = "B";
  const pendingWorker = context.waitForEvent("serviceworker", {
    timeout: 25000,
  });
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r.update();
  });
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration())?.waiting,
  );

  check(
    (await page.locator("meta[name=sagi-qa-build]").getAttribute("content")) ===
      "A",
    "operator remains on A while update waits",
  );
  check(
    (await output
      .locator("meta[name=sagi-qa-build]")
      .getAttribute("content")) === "A",
    "projector remains on A while update waits",
  );
  check(
    (await output.locator(".slide-lines").textContent()) ===
      "Synthetic frozen update lyrics",
    "pending update preserves frozen audience frame",
  );
  check(
    JSON.stringify(await snapshot(page)) === JSON.stringify(before),
    "pending update preserves all durable records",
  );
  await output.close();
  await page.close();
  const updateWorker = await pendingWorker;
  // Activation is asynchronous; keep every application client closed until B is active.
  let activated = false;
  for (let i = 0; i < 200; i++) {
    activated = await updateWorker.evaluate(
      () =>
        !self.registration.waiting &&
        self.registration.active?.state === "activated",
    );
    if (activated) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  check(
    activated,
    "waiting build activates with all application windows closed",
  );
  page = await context.newPage();
  const reopened = await page.goto(origin);
  result.firstReopen = {
    marker: await page
      .locator("meta[name=sagi-qa-build]")
      .getAttribute("content"),
    fromServiceWorker: reopened.fromServiceWorker(),
  };
  result.registration = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return {
      active: r?.active?.state,
      waiting: r?.waiting?.state,
      controller: navigator.serviceWorker.controller?.state,
    };
  });
  result.cachedHTML = await page.evaluate(async () => {
    const rows = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys())
        if (new URL(request.url).pathname === "/index.html") {
          const response = await cache.match(request);
          rows.push({
            cache: name,
            url: request.url,
            marker: (await response.text()).match(/sagi-qa-build[^>]+/)?.[0],
          });
        }
    }
    return rows;
  });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("meta[name=sagi-qa-build]")?.content === "B",
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  check(
    JSON.stringify(await snapshot(page)) === JSON.stringify(before),
    "build B preserves schema and all durable records",
  );
  await page.getByRole("region", { name: "Pemulihan presentasi" }).waitFor();
  check(
    await page
      .getByRole("button", { name: "Go Live", exact: true })
      .isDisabled(),
    "build B requires explicit recovery",
  );
  await context.setOffline(true);
  await page.reload();
  check(
    (await page.locator("meta[name=sagi-qa-build]").getAttribute("content")) ===
      "B",
    "build B restarts offline from cache",
  );
  await page
    .getByRole("button", { name: "Resume presentasi", exact: true })
    .click();
  const freshPopup = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Open Projector Window", exact: true })
    .click();
  const fresh = await freshPopup;
  await fresh
    .locator(".slide-lines")
    .filter({ hasText: "Synthetic frozen update lyrics" })
    .waitFor();
  check(true, "explicit recovery opens fresh projector offline");
  result.status = "PASS";
  await context.close();
} catch (e) {
  result.status = "FAIL";
  result.error = e.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await fs.writeFile(
    "docs/evidence/phase-8/update-" +
      (process.env.SAGI_QA_CHANNEL || "chromium") +
      ".json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
}
