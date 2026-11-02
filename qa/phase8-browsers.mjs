import { serve } from "./serve.mjs";
import { chromium, firefox, webkit } from "playwright";
import fs from "node:fs";
import os from "node:os";
const probes = [];
const server = await serve();
for (const [name, type, options] of [
  ["Chrome macOS", chromium, { channel: "chrome" }],
  ["Edge macOS", chromium, { channel: "msedge" }],
  ["Playwright Chromium", chromium, {}],
  ["Playwright Firefox", firefox, {}],
  ["Playwright WebKit", webkit, {}],
]) {
  let browser;
  try {
    browser = await type.launch({ headless: true, ...options });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.origin);
    await page
      .getByRole("button", { name: "Tambah lagu", exact: true })
      .waitFor();
    const capabilities = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      webLocks: !!navigator.locks,
      serviceWorker: "serviceWorker" in navigator,
      savePicker: "showSaveFilePicker" in window,
      screenDetails: "getScreenDetails" in window,
      storageEstimate: !!navigator.storage?.estimate,
      mp4H264: document
        .createElement("video")
        .canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'),
      webmVP8: document
        .createElement("video")
        .canPlayType('video/webm; codecs="vp8, vorbis"'),
    }));
    probes.push({
      name,
      status: "PASS",
      scope: "launch and application shell/capability probe only",
      version: browser.version(),
      capabilities,
    });
    await context.close();
  } catch (e) {
    probes.push({ name, status: "BLOCKED", error: e.message });
  } finally {
    await browser?.close();
  }
}
fs.writeFileSync(
  "docs/evidence/phase-8/browsers.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      os: os.platform(),
      release: os.release(),
      arch: os.arch(),
      node: process.version,
      probes,
    },
    null,
    2,
  ),
);
console.log(
  probes
    .map((p) => `${p.name}: ${p.status} ${p.version ?? p.error.split("\n")[0]}`)
    .join("\n"),
);

await server.close();
