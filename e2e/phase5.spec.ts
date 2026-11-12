import { test, expect, type Page } from "@playwright/test";
import { projectorWindow } from "./projectorHelpers";
import { previewPosition, previewReady } from "./previewHelpers";
import { dragToWeek, mediaCard, openWeek } from "./dragHelpers";
import {
  imageFile,
  videoFile,
  syntheticPDF,
  nodeBuffer,
} from "./mediaFixtures";
async function library(page: Page) {
  await page.getByRole("tab", { name: /Media/ }).click();
}
async function image(page: Page, name = "synthetic.png", color = "#e9ad52") {
  await library(page);
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await imageFile(page, name, color));
  await expect(
    page.getByRole("button", { name: `Pilih media ${name}`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Pilih media ${name}`, exact: true })
    .click();
}
async function prepare(page: Page) {
  await page
    .getByRole("button", { name: "Preview media", exact: true })
    .click();
  await previewReady(page);
}
async function output(page: Page) {
  return projectorWindow(page);
}
async function live(page: Page) {
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});
test("image import/search/filter, immutable two-window output, source deletion, cleanup and reload recovery", async ({
  page,
}) => {
  await image(page);
  await prepare(page);
  const p = await output(page);
  await expect(p.locator(".media-canvas img")).toHaveCount(0);
  await live(page);
  await expect(p.locator(".media-canvas img")).toBeVisible();
  const old = await p.locator(".media-canvas img").getAttribute("src");
  await image(page, "next.png", "#ff0000");
  await prepare(page);
  expect(await p.locator(".media-canvas img").getAttribute("src")).toBe(old);
  await page.getByLabel("Cari media", { exact: true }).fill("synthetic");
  await expect(
    page.getByRole("list", { name: "Daftar media" }).locator("li"),
  ).toHaveCount(1);
  await page.getByLabel("Cari media", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Pilih media synthetic.png", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Hapus media", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Pilih media synthetic.png",
      exact: true,
    }),
  ).toHaveCount(0);
  // Deleting frees the file's space at once, except what LIVE still uses.
  await expect(page.getByTestId("media-usage")).toContainText(
    /Media di laptop ini: [\d.]+ MB · [\d.]+ MB lagi masih dipakai tema\/LIVE/,
  );
  await p.reload();
  await expect(p.locator(".media-canvas img")).toBeVisible();
  await expect(page.getByText(/Checkpoint tersimpan · LIVE/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Pemulihan presentasi" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resume presentasi", exact: true })
    .click();
  const recovered = await output(page);
  await expect(recovered.locator(".media-canvas img")).toBeVisible();
});
test("PDF rasterizes selected pages offline and mixed schedules duplicate/reorder/remove", async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await openWeek(page, 1);
  await image(page);
  await dragToWeek(mediaCard(page, "synthetic.png"));
  // PDFs are imported in Presentations; the Media tab takes images/videos.
  await page.getByRole("tab", { name: "Presentations", exact: true }).click();
  await page.getByLabel("File presentasi", { exact: true }).setInputFiles({
    name: "original.pdf",
    mimeType: "application/pdf",
    buffer: syntheticPDF(),
  });
  await expect(
    page.getByRole("button", { name: "Pilih media original.pdf", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pilih media original.pdf", exact: true })
    .click();
  await page.getByLabel("Halaman PDF", { exact: true }).fill("1-2");
  await dragToWeek(mediaCard(page, "original.pdf"));
  await expect(page.getByTestId("schedule-item")).toHaveCount(2);
  await page.getByLabel("Naikkan item 2", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("schedule-item").first()).toContainText(
    "original.pdf",
  );
  await page
    .getByTestId("schedule-item")
    .first()
    .dragTo(page.getByTestId("schedule-item").last());
  await expect(page.getByTestId("schedule-item").first()).toContainText(
    "synthetic.png",
  );
  await expect(page.getByTestId("schedule-item")).toHaveCount(2);
  await prepare(page);
  await expect(previewPosition(page)).toHaveText(/ of 2$/);
  const p = await output(page);
  await live(page);
  await expect(p.locator(".media-canvas img")).toBeVisible();
  const first = await p.locator(".media-canvas img").getAttribute("src");
  await page
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(p.locator(".media-canvas img")).not.toHaveAttribute(
    "src",
    first!,
  );
  await p.reload();
  await expect(p.locator(".media-canvas img")).toBeVisible();
  await page.screenshot({
    path: "docs/evidence/phase5-desktop.png",
    fullPage: true,
  });
  await p.screenshot({ path: "docs/evidence/phase5-pdf-projector.png" });
});
test("video Preview and LIVE are independent; playback controls, Black, refresh paused and offline persistence", async ({
  page,
  context,
}) => {
  await library(page);
  const fixture = await videoFile(page);
  await page.getByLabel("File media", { exact: true }).setInputFiles(fixture);
  await expect(
    page.getByRole("button", {
      name: "Pilih media synthetic.webm",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pilih media synthetic.webm", exact: true })
    .click();
  await prepare(page);
  const p = await output(page);
  await live(page);
  const video = p.getByLabel("Video LIVE", { exact: true });
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await page.getByRole("button", { name: "Play LIVE", exact: true }).click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false);
  await page.getByLabel("Loop LIVE", { exact: true }).check();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.loop))
    .toBe(true);
  await page.getByRole("button", { name: "Pause LIVE", exact: true }).click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await page.getByLabel("Volume LIVE", { exact: true }).fill("35");
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.volume))
    .toBeCloseTo(0.35);
  await page.getByLabel("Mute LIVE", { exact: true }).uncheck();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.muted))
    .toBe(false);
  // Above 100%: the projector keeps the element at full volume and adds the
  // rest with the volume boost (active after one click in that window).
  await page.getByLabel("Volume LIVE", { exact: true }).fill("150");
  const liveControls = page.getByRole("region", {
    name: "LIVE projector control",
  });
  await expect(liveControls).toContainText("150%");
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.volume))
    .toBe(1);
  await p.getByTestId("slide-canvas").click();
  await expect(
    liveControls.getByRole("status").filter({ hasText: /Paused|Playing/ }),
  ).not.toContainText("menunggu satu klik");
  // With the boost running the level is carried by Web Audio: the element
  // itself stays at 100% even when the operator turns the volume down.
  await page.getByLabel("Volume LIVE", { exact: true }).fill("35");
  await expect(liveControls).toContainText("35%");
  await page.waitForTimeout(500);
  expect(await video.evaluate((v: HTMLVideoElement) => v.volume)).toBe(1);
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(p.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.muted))
    .toBe(true);
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await p.reload();
  await expect(p.getByLabel("Video LIVE", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      p
        .getByLabel("Video LIVE", { exact: true })
        .evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Resume presentasi", exact: true })
    .click();
  const recovered = await output(page);
  await expect(
    recovered.getByLabel("Video LIVE", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      recovered
        .getByLabel("Video LIVE", { exact: true })
        .evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(true);
});
test("malformed inputs, unsupported PPTX, read-only secondary window and responsive layout", async ({
  page,
  context,
}) => {
  await library(page);
  await page.getByLabel("File media", { exact: true }).setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: nodeBuffer.from("not an image"),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "signature" }),
  ).toBeVisible();
  await page.getByLabel("File media", { exact: true }).setInputFiles({
    name: "test.pptx",
    mimeType: "application/octet-stream",
    buffer: nodeBuffer.from("PK"),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "PPTX" }),
  ).toBeVisible();
  await image(page);
  const reader = await context.newPage();
  await reader.goto("/");
  await library(reader);
  await expect(
    reader.getByRole("button", { name: "Impor media", exact: true }),
  ).toBeDisabled();
  await reader
    .getByRole("button", { name: "Pilih media synthetic.png", exact: true })
    .click();
  await expect(
    reader.getByRole("button", { name: "Hapus media", exact: true }),
  ).toBeDisabled();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/evidence/phase5-mobile.png",
    fullPage: true,
  });
});

test("corrupt media cannot replace valid audience output and Black works through checkpoint failure", async ({
  page,
}) => {
  await image(page);
  await prepare(page);
  const p = await output(page);
  await live(page);
  // Wait until the projector shows the first image before remembering it.
  await expect(p.locator(".media-canvas")).toHaveAttribute(
    "data-asset-id",
    /.+/,
  );
  const old = await p.locator(".media-canvas").getAttribute("data-asset-id");
  await image(page, "corrupt.png", "#00ff00");
  await prepare(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("sagi-worship", 1);
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("media_assets", "readwrite"),
        s = tx.objectStore("media_assets"),
        r = s.getAll(IDBKeyRange.bound("meta:", "meta:\uffff"));
      r.onsuccess = () => {
        const a = r.result.find((a) => a.filename === "corrupt.png"),
          payload = s.get(a.original.id);
        payload.onsuccess = () =>
          s.put({
            ...payload.result,
            blob: new Blob(["corrupted"], { type: "image/png" }),
          });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Error");
  expect(await p.locator(".media-canvas").getAttribute("data-asset-id")).toBe(
    old,
  );
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "live_session_state")
        throw new DOMException("injected quota", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(p.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await expect(page.getByText(/Checkpoint gagal:/)).toBeVisible();
});

test("duplicate and stale media states cannot undo playback Pause or newer output", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    const Original = window.BroadcastChannel;
    (window as unknown as { sent: unknown[] }).sent = [];
    window.BroadcastChannel = class extends Original {
      postMessage(data: unknown) {
        (window as unknown as { sent: unknown[] }).sent.push(
          structuredClone(data),
        );
        super.postMessage(data);
      }
    };
  });
  await page.reload();
  await library(page);
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await videoFile(page));
  await page
    .getByRole("button", { name: "Pilih media synthetic.webm", exact: true })
    .click();
  await prepare(page);
  const p = await output(page);
  await live(page);
  await page.getByRole("button", { name: "Play LIVE", exact: true }).click();
  await expect
    .poll(() =>
      p
        .getByLabel("Video LIVE", { exact: true })
        .evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(false);
  const old = await page.evaluate(() =>
    (window as unknown as { sent: { type: string; pair: string }[] }).sent
      .filter((m) => m.type === "STATE")
      .at(-1)!,
  );
  await page.getByRole("button", { name: "Pause LIVE", exact: true }).click();
  await expect
    .poll(() =>
      p
        .getByLabel("Video LIVE", { exact: true })
        .evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(true);
  for (const m of [old, old, { ...old, seq: 999, nonce: "old-document" }])
    await page.evaluate((message) => {
      const c = new BroadcastChannel(`sagi-projector:${message.pair}`);
      c.postMessage(message);
      c.close();
    }, m);
  await expect
    .poll(() =>
      p
        .getByLabel("Video LIVE", { exact: true })
        .evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(true);
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
});

test("cancelled decode and quota preflight never publish a partial import", async ({
  page,
}) => {
  await library(page);
  await page.evaluate(() => {
    const original = window.createImageBitmap;
    window.createImageBitmap = (async (
      ...args: Parameters<typeof createImageBitmap>
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return original(...args);
    }) as typeof createImageBitmap;
  });
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await imageFile(page, "cancelled.png"));
  await page
    .getByRole("button", { name: "Batalkan impor media", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Pilih media cancelled.png",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator.storage, "estimate", {
      configurable: true,
      value: async () => ({ quota: 10, usage: 9 }),
    });
  });
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await imageFile(page, "quota.png"));
  await expect(
    page.getByRole("status").filter({ hasText: "Storage tidak mencukupi" }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Daftar media" }).locator("li"),
  ).toHaveCount(0);
  await page.reload();
  await library(page);
  await expect(
    page.getByRole("list", { name: "Daftar media" }).locator("li"),
  ).toHaveCount(0);
});
