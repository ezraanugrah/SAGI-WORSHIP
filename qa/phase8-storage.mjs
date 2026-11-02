import { chromium } from "playwright";
import fs from "node:fs/promises";
import { syntheticPDF } from "../e2e/mediaFixtures.ts";
import { serve } from "./serve.mjs";
const server = await serve(),
  result = {
    date: new Date().toISOString(),
    status: "RUNNING",
    levels: [],
    checks: [],
    scope:
      "short synthetic workload; no system-disk exhaustion; not a storage ceiling or soak qualification",
  };
const check = (ok, label) => {
  if (!ok) throw new Error(label);
  result.checks.push({ label, status: "PASS" });
};
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
  result.browser = browser.version();
  const context = await browser.newContext({ serviceWorkers: "allow" });
  await context.addInitScript(() =>
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(server.origin);
  await page.getByRole("tab", { name: /Media/ }).click();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const heap = async () =>
    (await cdp.send("Performance.getMetrics")).metrics.find(
      (m) => m.name === "JSHeapUsedSize",
    ).value;
  result.heapBefore = await heap();
  const counts = async (target = page) =>
    target.evaluate(
      async () =>
        new Promise((resolve) => {
          const q = indexedDB.open("sagi-worship", 1);
          q.onsuccess = () => {
            const db = q.result,
              tx = db.transaction("media_assets", "readonly"),
              r = tx.objectStore("media_assets").getAll();
            tx.oncomplete = () => {
              db.close();
              resolve({
                assets: r.result.filter((v) => v.id.startsWith("meta:")).length,
                blobBytes: r.result.reduce(
                  (n, v) => n + (v.blob?.size ?? 0),
                  0,
                ),
                payloads: r.result.filter((v) => v.blob).length,
              });
            };
          };
        }),
    );
  let fileBytes = 0;
  for (let i = 0; i < 48; i++) {
    const encoded = await page.evaluate((seed) => {
      const c = document.createElement("canvas");
      c.width = c.height = 512;
      const ctx = c.getContext("2d"),
        img = ctx.createImageData(512, 512);
      let x = seed + 1;
      for (let k = 0; k < img.data.length; k += 4) {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        img.data[k] = x & 255;
        img.data[k + 1] = (x >>> 8) & 255;
        img.data[k + 2] = (x >>> 16) & 255;
        img.data[k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL("image/png").split(",")[1];
    }, i);
    const buffer = Buffer.from(encoded, "base64");
    fileBytes += buffer.length;
    await page
      .getByLabel("File media", { exact: true })
      .setInputFiles({
        name: `noise-${String(i).padStart(2, "0")}.png`,
        mimeType: "image/png",
        buffer,
      });
    await page
      .getByRole("button", { name: "Impor media", exact: true })
      .waitFor({ state: "visible" });
    await page.waitForFunction(
      () => !document.querySelector('input[aria-label="File media"]').disabled,
    );
    if ([8, 24, 48].includes(i + 1)) {
      const start = performance.now();
      await page.getByLabel("Cari media", { exact: true }).fill("noise-00");
      await page
        .getByRole("button", { name: "Pilih media noise-00.png", exact: true })
        .waitFor();
      result.levels.push({
        images: i + 1,
        originalBytes: fileBytes,
        ...(await counts()),
        searchMilliseconds: performance.now() - start,
        heapUsed: await heap(),
      });
      await page.getByLabel("Cari media", { exact: true }).fill("");
    }
  }
  check(
    (await counts()).assets === 48,
    "48 independently decoded synthetic PNG files imported",
  );
  const paths = [
    "test-results/phase8-fixtures/synthetic-h264-aac.mp4",
    "test-results/phase8-fixtures/synthetic-vp8-vorbis.webm",
  ];
  result.media = [];
  for (const file of paths) {
    const name = file.split("/").at(-1);
    await page.getByLabel("File media", { exact: true }).setInputFiles(file);
    await page.waitForFunction(
      () => !document.querySelector('input[aria-label="File media"]').disabled,
    );
    await page.getByLabel("Cari media", { exact: true }).fill(name);
    await page
      .getByRole("button", { name: `Pilih media ${name}`, exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: `Pilih media ${name}`, exact: true })
      .click();
    const previousSrc = (await page
      .getByLabel("Video Preview", { exact: true })
      .count())
      ? await page
          .getByLabel("Video Preview", { exact: true })
          .getAttribute("src")
      : null;
    await page
      .getByRole("button", { name: "Preview media", exact: true })
      .click();
    await page.waitForFunction((old) => {
      const v = document.querySelector('video[aria-label="Video Preview"]');
      return v && v.getAttribute("src") !== old && v.readyState >= 2;
    }, previousSrc);

    // Find the Preview video by its application label, without relying on layout CSS.
    const probe = page.getByLabel("Video Preview", { exact: true });
    await probe.waitFor();
    await probe.evaluate((v) => v.play());
    await page.waitForTimeout(1100);
    check(
      await probe.evaluate((v) => v.currentTime > 0 && !v.error),
      `actual decoding/playback ${name}`,
    );
    await probe.evaluate((v) => v.pause());
    result.media.push({
      file: name,
      bytes: (await fs.stat(file)).size,
      secondsObserved: 1.1,
    });
  }
  await page.getByLabel("Cari media", { exact: true }).fill("");
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles({
      name: "phase8.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(syntheticPDF()),
    });
  await page.waitForFunction(
    () => !document.querySelector('input[aria-label="File media"]').disabled,
  );
  await page.getByLabel("Cari media", { exact: true }).fill("phase8.pdf");
  await page
    .getByRole("button", { name: "Pilih media phase8.pdf", exact: true })
    .click();
  await page.getByLabel("Halaman PDF", { exact: true }).fill("1-2");
  await page
    .getByRole("button", { name: "Preview media", exact: true })
    .click();
  await page.getByRole("list", { name: "Daftar slide Preview" }).waitFor();
  check(true, "two-page synthetic PDF prepared");
  await page.getByRole("link", { name: "Pengaturan", exact: true }).click();
  const download = page.waitForEvent("download"),
    exportStart = performance.now();
  await page
    .getByRole("button", { name: "Buat backup .sagibak", exact: true })
    .click();
  const file = "test-results/phase8-fixtures/workload.sagibak";
  await (await download).saveAs(file);
  result.archiveBytes = (await fs.stat(file)).size;
  result.downloadMilliseconds = performance.now() - exportStart;
  await page.getByLabel("File backup", { exact: true }).setInputFiles(file);
  const verifyStart = performance.now();
  await page
    .getByRole("button", { name: "Verifikasi file", exact: true })
    .click();
  await page.getByText(/Verifikasi lulus:/).waitFor();
  result.verifyMilliseconds = performance.now() - verifyStart;
  result.heapAfterDownloadVerify = await heap();
  await page.evaluate(() => {
    window.phase8Chunks = [];
    window.showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async (bytes) => window.phase8Chunks.push(bytes),
        close: async () => {},
        abort: async () => {
          window.phase8Chunks = [];
        },
      }),
    });
  });
  await page
    .getByRole("button", { name: "Buat backup .sagibak", exact: true })
    .click();
  await page.getByText(/Backup lengkap diserahkan/).waitFor();
  const streamed = await page.evaluate(() => ({
    bytes: window.phase8Chunks.reduce((n, c) => n + c.length, 0),
    maxChunk: Math.max(...window.phase8Chunks.map((c) => c.length)),
  }));
  check(
    streamed.bytes > 0 && streamed.maxChunk <= 4 * 1024 ** 2,
    "stream adapter receives bounded real byte chunks",
  );
  result.streamed = streamed;
  await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="File backup"]'),
      dt = new DataTransfer();
    dt.items.add(
      new File(window.phase8Chunks, "streamed.sagibak", {
        type: "application/octet-stream",
      }),
    );
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page
    .getByRole("button", { name: "Verifikasi file", exact: true })
    .click();
  await page.getByText(/Verifikasi lulus:/).waitFor();
  check(true, "streamed bytes reopened and fully verified");
  const destination = await browser.newContext({ serviceWorkers: "allow" }),
    p = await destination.newPage();
  p.setDefaultTimeout(30000);
  await p.goto(server.origin);
  await p.getByRole("link", { name: "Pengaturan", exact: true }).click();
  await p.getByLabel("File backup", { exact: true }).setInputFiles(file);
  const restoreStart = performance.now();
  await p.getByRole("button", { name: "Siapkan restore", exact: true }).click();
  await p.getByLabel("Mode restore", { exact: true }).selectOption("fresh");
  p.once("dialog", (d) => d.accept());
  await p
    .getByRole("button", {
      name: "End Session untuk restore / repair",
      exact: true,
    })
    .click();
  await p
    .getByRole("button", { name: "Tinjau konflik restore", exact: true })
    .click();
  await p
    .getByLabel("Saya memahami dampak restore dan pilihan konflik")
    .check();
  await p
    .getByRole("button", { name: "Publikasikan restore", exact: true })
    .click();
  await p.getByText(/Restore atomik selesai/).waitFor();
  result.restoreMilliseconds = performance.now() - restoreStart;
  result.destination = await counts(p);
  check(
    JSON.stringify(result.destination) === JSON.stringify(await counts()),
    "restored asset count, payload count and byte totals match source",
  );
  await p
    .getByRole("button", { name: "Scan integritas penuh", exact: true })
    .click();
  await p
    .getByText("Scan integritas penuh selesai.", { exact: true })
    .waitFor();
  check(
    (await p.getByText(/^error:/).count()) === 0,
    "restored workload passes full-integrity Storage Health scan",
  );
  check(
    true,
    "complete synthetic workload staged and atomically restored in fresh context",
  );
  result.heapAfterWorkflows = await heap();
  result.source = await counts();
  result.status = "PASS";
  await destination.close();
  await context.close();
} catch (e) {
  result.status = "FAIL";
  result.error = e.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
  await fs.writeFile(
    "docs/evidence/phase-8/storage.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
}
