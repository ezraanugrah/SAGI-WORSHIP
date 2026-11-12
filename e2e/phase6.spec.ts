import { test, expect, type Page } from "@playwright/test";
import { previewReady } from "./previewHelpers";
import { dragToWeek, openWeek } from "./dragHelpers";
import { imageFile, videoFile } from "./mediaFixtures";
import { APPLY_THEME, createTheme } from "./themeHelpers";
const lyric =
  "Original synthetic theme song.\nA clear second line for testing.";
async function song(page: Page) {
  await page.getByRole("tab", { name: /Songs/ }).click();
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  await page.getByLabel("Judul lagu", { exact: true }).fill("Theme rehearsal");
  await page.getByLabel("Lirik bagian 1", { exact: true }).fill(lyric);
  await expect(
    page.getByRole("region", { name: "Editor lagu" }).getByRole("status"),
  ).toHaveText("Tersimpan lokal");
  await page
    .getByRole("button", { name: "Simpan sekarang", exact: true })
    .click();
  await page
    .getByTestId("song-row")
    .getByRole("button", { name: /^Theme rehearsal/ })
    .click();
  await previewReady(page);
}
async function themes(page: Page) {
  await page.getByRole("tab", { name: /Themes/ }).click();
}
const create = createTheme;
async function apply(page: Page) {
  await page.getByRole("button", { name: APPLY_THEME, exact: true }).click();
  // Applied to the Preview item and straight on to Live Output.
  await expect(
    page
      .getByRole("region", { name: "LIVE projector control" })
      .locator(".themed-lines"),
  ).toBeVisible();
}
async function output(page: Page) {
  const pending = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  const p = await pending;
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  return p;
}
async function live(page: Page, p: Page) {
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(p.locator(".themed-lines")).toBeVisible();
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});
test("themes come from Impor media, persist offline and are read-only in a secondary tab", async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await create(page, "Amber service");
  await page.reload();
  await themes(page);
  // No search, filter or "Buat tema": Impor media is the only way in.
  await expect(page.getByLabel("Cari tema")).toHaveCount(0);
  await expect(page.getByLabel("Filter tema")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Buat tema" })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Pilih tema Amber service", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Detail tema" }).getByRole("button"),
  ).toHaveText([APPLY_THEME]);
  const reader = await context.newPage();
  await reader.goto("/");
  await themes(reader);
  await expect(
    reader.getByRole("button", { name: "Impor media", exact: true }),
  ).toBeDisabled();
  await reader
    .getByRole("button", { name: "Pilih tema Amber service", exact: true })
    .click();
  await expect(
    reader.getByRole("button", { name: APPLY_THEME, exact: true }),
  ).toBeDisabled();
});
test("image theme retains frozen LIVE/checkpoint through source deletion, refresh and recovery", async ({
  page,
}) => {
  await song(page);
  await create(page, "Image background", "image");
  await apply(page);
  const p = await output(page);
  await live(page, p);
  await expect(p.locator(".themed-lines")).toHaveText(lyric);
  await expect(p.locator(".theme-background img")).toBeVisible();
  await page.getByRole("tab", { name: /Media/ }).click();
  await page
    .getByRole("button", { name: "Pilih media synthetic.png", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Hapus media", exact: true }).click();
  await p.reload();
  await expect(p.locator(".themed-lines")).toHaveText(lyric);
  await expect(p.locator(".theme-background img")).toBeVisible();
  await expect(page.getByText(/Checkpoint tersimpan · LIVE/)).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Resume presentasi", exact: true })
    .click();
  const recovered = await output(page);
  await expect(recovered.locator(".theme-background img")).toBeVisible();
  await page.screenshot({
    path: "docs/evidence/phase6-operator.png",
    fullPage: true,
  });
  await recovered.screenshot({ path: "docs/evidence/phase6-projector.png" });
});
test("video backgrounds play silently by themselves, pause for Black and resume, also after refresh and recovery", async ({
  page,
  context,
}) => {
  await song(page);
  await create(page, "Silent background", "video");
  await apply(page);
  // The panel already loops the background while it waits for Go Live.
  const panelVideo = page
    .getByRole("region", { name: "LIVE projector control" })
    .locator(".theme-background video");
  await expect
    .poll(() => panelVideo.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false);
  const p = await output(page);
  await live(page, p);
  const video = p.locator(".theme-background video");
  await expect(video).toBeVisible();
  const playing = () => video.evaluate((v: HTMLVideoElement) => !v.paused);
  await expect.poll(playing).toBe(true);
  expect(
    await video.evaluate((v: HTMLVideoElement) => ({
      muted: v.muted,
      volume: v.volume,
      controls: v.controls,
      loop: v.loop,
    })),
  ).toEqual({ muted: true, volume: 0, controls: false, loop: true });
  // The operator can still pause and play it.
  await page
    .getByRole("button", { name: "Pause background LIVE", exact: true })
    .click();
  await expect.poll(playing).toBe(false);
  await page
    .getByRole("button", { name: "Play background LIVE", exact: true })
    .click();
  await expect.poll(playing).toBe(true);
  await page.getByRole("button", { name: "Clear Text", exact: true }).click();
  await expect(p.locator(".themed-lines")).toBeHidden();
  await expect(video).toBeVisible();
  await expect.poll(playing).toBe(true);
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(p.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await expect.poll(playing).toBe(false);
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect.poll(playing).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await p.reload();
  await expect(p.locator(".theme-background video")).toBeVisible();
  await expect
    .poll(() =>
      p
        .locator(".theme-background video")
        .evaluate((v: HTMLVideoElement) => !v.paused),
    )
    .toBe(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Resume presentasi", exact: true })
    .click();
  const recovered = await output(page);
  await expect(recovered.locator(".theme-background video")).toBeVisible();
  await expect
    .poll(() =>
      recovered
        .locator(".theme-background video")
        .evaluate((v: HTMLVideoElement) => !v.paused),
    )
    .toBe(true);
});
test("a theme shows on the Live Output panel first; once LIVE it reaches the projector at once and Black stays", async ({
  page,
}) => {
  await song(page);
  const p = await output(page);
  await themes(page);
  for (const gone of [
    "Edit / rename tema",
    "Duplikasi tema",
    "Terapkan ke semua teks Preview",
    "Jadikan default persiapan",
    "Hapus tema",
    "Simpan tema pada item",
  ])
    await expect(page.getByRole("button", { name: gone })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Pilih tema Sunset", exact: true })
    .click();
  await expect(page.getByLabel("Item jadwal untuk tema")).toHaveCount(0);
  await page.getByRole("button", { name: APPLY_THEME, exact: true }).click();
  const panel = page.getByRole("region", { name: "LIVE projector control" });
  // Before the first Go Live: on the panel only, marked "Belum tayang".
  await expect(panel.locator(".themed-lines")).toHaveText(lyric);
  await expect(panel.getByTestId("staged-badge")).toBeVisible();
  await expect(p.locator(".themed-lines")).toHaveCount(0);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(p.locator(".themed-lines")).toHaveText(lyric);
  await expect(panel.getByTestId("staged-badge")).toHaveCount(0);
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  // Once LIVE, a theme goes to the projector at once; Black stays dark.
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(p.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await page
    .getByRole("button", { name: "Pilih tema Ocean", exact: true })
    .click();
  await page.getByRole("button", { name: APPLY_THEME, exact: true }).click();
  await expect(panel.getByTestId("staged-badge")).toHaveCount(0);
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  await expect(p.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(p.locator(".theme-background")).toHaveCSS(
    "background-image",
    /rgb\(16, 42, 50\)/,
  );
  await expect(p.locator(".themed-lines")).toHaveText(lyric);
});
test("advanced resolution/scaling affects preparation only and the theme editor previews the current text", async ({
  page,
}) => {
  await song(page);
  await create(page, "Typography");
  await apply(page);
  const p = await output(page);
  await live(page, p);
  await page.getByRole("link", { name: "Pengaturan", exact: true }).click();
  await page
    .getByLabel("Reference canvas", { exact: true })
    .selectOption("720");
  await page
    .getByLabel("Display scaling", { exact: true })
    .selectOption("no-upscale");
  await page
    .getByLabel("Default theme", { exact: true })
    .selectOption({ label: "Typography" });
  await page
    .getByRole("button", { name: "Simpan pengaturan lanjutan", exact: true })
    .click();
  await expect(
    page.getByText("Pengaturan lanjutan tersimpan lokal", { exact: true }),
  ).toBeVisible();
  await expect(p.locator(".slide-reference")).toHaveCSS("width", "1920px");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  // A new preparation uses the saved 720p reference canvas.
  await page.getByRole("tab", { name: /Songs/ }).click();
  await page
    .getByTestId("song-row")
    .getByRole("button", { name: /^Theme rehearsal/ })
    .click();
  await previewReady(page);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(p.locator(".slide-reference")).toHaveCSS("width", "1280px");
  await expect(p.locator(".themed-lines")).toContainText(
    "Original synthetic theme song.",
  );
  await page.getByRole("tab", { name: /Themes/ }).click();
  await page
    .getByLabel("File media tema", { exact: true })
    .setInputFiles(await imageFile(page, "sample.png", "#334155"));
  await page
    .getByLabel("Gunakan teks Preview saat ini", { exact: true })
    .check();
  await expect(
    page.getByRole("region", { name: "Editor tema" }).locator(".themed-lines"),
  ).toContainText("Original synthetic theme song.");

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
    path: "docs/evidence/phase6-mobile.png",
    fullPage: true,
  });
});

test("corrupt backgrounds cannot replace valid output and emergency Black survives checkpoint quota failure", async ({
  page,
}) => {
  await song(page);
  const p = await output(page);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(p.locator(".slide-lines")).toHaveText(lyric);
  await create(
    page,
    "Corruption fixture",
    "image",
    await imageFile(page, "bad-background.png"),
  );
  // The payload is corrupted before the theme is applied (which now goes
  // straight to Live Output).
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
        const a = r.result.find((a) => a.filename === "bad-background.png"),
          p = s.get(a.original.id);
        p.onsuccess = () =>
          s.put({
            ...p.result,
            blob: new Blob(["corrupt original image"], { type: "image/png" }),
          });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.getByRole("button", { name: APPLY_THEME, exact: true }).click();
  // Refused either by the projector (Error) or already by the operator.
  await expect(
    page
      .getByTestId("connection-status")
      .filter({ hasText: "Error" })
      .or(page.getByRole("alert").filter({ hasText: /rusak|Integritas/ }))
      .first(),
  ).toBeVisible();
  await expect(p.locator(".slide-lines")).toHaveText(lyric);
  await expect(p.locator(".themed-lines")).toHaveCount(0);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "live_session_state")
        throw new DOMException("injected quota", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(p.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await expect(page.getByText(/Checkpoint gagal:/)).toBeVisible();
});
test("unsaved edits warn, failed theme writes rollback, and stale protocol cannot replace a themed frame", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    const Original = window.BroadcastChannel;
    (window as unknown as { sent: unknown[] }).sent = [];
    window.BroadcastChannel = class extends Original {
      postMessage(m: unknown) {
        (window as unknown as { sent: unknown[] }).sent.push(
          structuredClone(m),
        );
        super.postMessage(m);
      }
    };
  });
  await page.reload();
  await song(page);
  await create(page, "Protocol fixture", "gradient");
  await apply(page);
  const p = await output(page);
  await live(page, p);
  const old = await page.evaluate(() =>
    (window as unknown as { sent: { type: string; pair: string }[] }).sent
      .filter((m) => m.type === "STATE")
      .at(-1)!,
  );
  for (const message of [
    old,
    { ...old, v: 3, seq: 999 },
    { ...old, nonce: "stale-document", seq: 999 },
  ])
    await page.evaluate((m) => {
      const c = new BroadcastChannel(`sagi-projector:${m.pair}`);
      c.postMessage(m);
      c.close();
    }, message);
  await expect(p.locator(".themed-lines")).toHaveText(lyric);
  await page
    .getByLabel("File media tema", { exact: true })
    .setInputFiles(await imageFile(page, "draft.png", "#0f766e"));
  await page.getByLabel("Nama tema", { exact: true }).fill("Uncommitted theme");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("tab", { name: /Songs/ }).click();
  await expect(page.getByRole("region", { name: "Editor tema" })).toBeVisible();
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "themes")
        throw new DOMException("theme quota injected", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Simpan tema", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Editor tema" }).getByRole("alert"),
  ).toContainText("quota");
  await expect(p.locator(".themed-lines")).toHaveText(lyric);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Batalkan tema", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Pilih tema Uncommitted theme",
      exact: true,
    }),
  ).toHaveCount(0);
});
