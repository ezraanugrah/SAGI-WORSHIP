import { test, expect, type Page } from "@playwright/test";
import { dragToWeek } from "./dragHelpers";
import { imageFile, videoFile } from "./mediaFixtures";
import { signFixture } from "../src/scriptures/testFixtures";
const buffer = (
  globalThis as unknown as { Buffer: { from(value: string): Uint8Array } }
).Buffer;
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
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  await page
    .getByTestId("song-row")
    .getByRole("button", { name: /^Theme rehearsal/ })
    .click();
  await expect(
    page.getByRole("list", { name: "Daftar slide Preview" }),
  ).toBeVisible();
}
async function themes(page: Page) {
  await page.getByRole("tab", { name: /Themes/ }).click();
}
async function create(
  page: Page,
  name: string,
  kind: "solid" | "gradient" | "image" | "video" = "solid",
) {
  await themes(page);
  await page.getByRole("button", { name: "Buat tema", exact: true }).click();
  await page.getByLabel("Nama tema", { exact: true }).fill(name);
  if (kind !== "solid")
    await page
      .getByLabel("Jenis background", { exact: true })
      .selectOption(kind);
  await page.getByRole("button", { name: "Simpan tema", exact: true }).click();
  await expect(page.getByRole("region", { name: "Editor tema" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: `Pilih tema ${name}`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Pilih tema ${name}`, exact: true })
    .click();
}
async function apply(page: Page) {
  await page
    .getByRole("button", { name: "Terapkan ke item Preview", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Preview workspace" })
      .locator(".themed-lines"),
  ).toBeVisible();
}
async function output(page: Page) {
  const pending = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Live", exact: true }).click();
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
test("theme CRUD, rename, duplicate, search, offline persistence and read-only secondary tab", async ({
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
  await page.getByLabel("Cari tema", { exact: true }).fill("Amber");
  await expect(
    page.getByRole("list", { name: "Daftar tema" }).locator("li"),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Pilih tema Amber service", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit / rename tema", exact: true })
    .click();
  await page.getByLabel("Nama tema", { exact: true }).fill("Evening service");
  await page.getByLabel("Bobot teks", { exact: true }).selectOption("700");
  await page.getByLabel("Jarak baris", { exact: true }).fill("1.5");
  await page.getByRole("button", { name: "Simpan tema", exact: true }).click();
  await page.getByLabel("Cari tema", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Pilih tema Evening service", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Duplikasi tema", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Pilih tema Evening service (salinan)",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Hapus tema", exact: true }).click();
  await page
    .getByRole("button", { name: "Konfirmasi hapus tema", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Pilih tema Evening service (salinan)",
      exact: true,
    }),
  ).toHaveCount(0);
  const reader = await context.newPage();
  await reader.goto("/");
  await themes(reader);
  await expect(
    reader.getByRole("button", { name: "Buat tema", exact: true }),
  ).toBeDisabled();
  await reader
    .getByRole("button", { name: "Pilih tema Evening service", exact: true })
    .click();
  await expect(
    reader.getByRole("button", { name: "Edit / rename tema", exact: true }),
  ).toBeDisabled();
  await expect(
    reader.getByRole("button", { name: "Hapus tema", exact: true }),
  ).toBeDisabled();
});
test("image theme retains frozen LIVE/checkpoint through source and theme deletion, refresh and recovery", async ({
  page,
}) => {
  await page.getByRole("tab", { name: /Media/ }).click();
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await imageFile(page));
  await expect(
    page.getByRole("button", {
      name: "Pilih media synthetic.png",
      exact: true,
    }),
  ).toBeVisible();
  await song(page);
  await create(page, "Image background", "image");
  await apply(page);
  const p = await output(page);
  await live(page, p);
  await expect(p.locator(".themed-lines")).toHaveText(lyric);
  await expect(p.locator(".theme-background img")).toBeVisible();
  await page
    .getByRole("button", { name: "Edit / rename tema", exact: true })
    .click();
  await page.getByLabel("Warna teks", { exact: true }).fill("#ff0000");
  await expect(p.locator(".themed-lines")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await page.getByRole("button", { name: "Simpan tema", exact: true }).click();
  await expect(p.locator(".themed-lines")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await page.getByRole("tab", { name: /Media/ }).click();
  await page
    .getByRole("button", { name: "Pilih media synthetic.png", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Hapus media", exact: true }).click();
  await themes(page);
  await page
    .getByRole("button", { name: "Pilih tema Image background", exact: true })
    .click();
  await page.getByRole("button", { name: "Hapus tema", exact: true }).click();
  await page
    .getByRole("button", { name: "Konfirmasi hapus tema", exact: true })
    .click();
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
test("video backgrounds are silent, independently controlled and paused after Black, refresh and recovery", async ({
  page,
  context,
}) => {
  await page.getByRole("tab", { name: /Media/ }).click();
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await videoFile(page));
  await expect(
    page.getByRole("button", {
      name: "Pilih media synthetic.webm",
      exact: true,
    }),
  ).toBeVisible();
  await song(page);
  await create(page, "Silent background", "video");
  await apply(page);
  const p = await output(page);
  await live(page, p);
  const video = p.locator(".theme-background video");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await page
    .getByRole("button", { name: "Play background Preview", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .getByRole("region", { name: "Preview workspace" })
        .locator(".theme-background video")
        .evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(false);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await page
    .getByRole("button", { name: "Pause background Preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play background LIVE", exact: true })
    .click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false);
  expect(
    await video.evaluate((v: HTMLVideoElement) => ({
      muted: v.muted,
      volume: v.volume,
      controls: v.controls,
    })),
  ).toEqual({ muted: true, volume: 0, controls: false });
  await page.getByRole("button", { name: "Clear Text", exact: true }).click();
  await expect(p.locator(".themed-lines")).toBeHidden();
  await expect(video).toBeVisible();
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(p.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await page
    .getByRole("button", { name: "Play background LIVE", exact: true })
    .click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false);
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
        .evaluate((v: HTMLVideoElement) => v.paused),
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
        .evaluate((v: HTMLVideoElement) => v.paused),
    )
    .toBe(true);
});
test("theme assignment deletion discloses affected records and requires explicit replacement", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  await page.getByLabel("Nama jadwal", { exact: true }).fill("Themed service");
  await page
    .getByRole("button", { name: "Simpan jadwal", exact: true })
    .click();
  await song(page);
  await dragToWeek(page.getByTestId("song-row").first());
  await create(page, "Assigned theme", "gradient");
  await page
    .getByLabel("Item jadwal untuk tema", { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Simpan tema pada item", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Jadikan default persiapan", exact: true })
    .click();
  await page.getByRole("button", { name: "Hapus tema", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Konfirmasi hapus tema" }),
  ).toContainText("1 assignment jadwal");
  await expect(
    page.getByRole("button", { name: "Konfirmasi hapus tema", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Tema pengganti", { exact: true })
    .selectOption("builtin:black");
  await page
    .getByRole("button", { name: "Konfirmasi hapus tema", exact: true })
    .click();
  await page.getByTestId("schedule-item").locator(".item-inspect").click();
  await expect(
    page
      .getByRole("region", { name: "Preview workspace" })
      .locator(".themed-lines"),
  ).toBeVisible();
});
test("advanced resolution/scaling affects preparation only and themed Scripture keeps attribution", async ({
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
  await page.getByRole("tab", { name: /Scriptures/ }).click();
  const data = await signFixture();
  await page.getByLabel("File dataset Alkitab").setInputFiles({
    name: "synthetic.json",
    mimeType: "application/json",
    buffer: buffer.from(JSON.stringify(data)),
  });
  await page
    .getByLabel(
      "Saya berhak menyimpan, memproyeksikan, dan membuat snapshot lokal dataset ini",
    )
    .check();
  await page
    .getByRole("button", { name: "Konfirmasi dan impor", exact: true })
    .click();
  await expect(
    page.getByText("Dataset diimpor. Seluruh ayat tersimpan offline."),
  ).toBeVisible();
  await page.getByLabel("Referensi ayat", { exact: true }).fill("John 3:16");
  await page
    .getByRole("button", { name: "Cari referensi", exact: true })
    .click();
  await page.getByRole("button", { name: "Preview ayat", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Preview workspace" })
      .locator(".themed-lines"),
  ).toHaveText(data.verses[0].text);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(p.locator(".slide-reference")).toHaveCSS("width", "1280px");
  await expect(p.locator(".scripture-footer")).toContainText("John 3:16");
  await expect(p.locator(".scripture-attribution")).toHaveText(
    data.translation.license.displayAttribution,
  );
  await expect(
    page.getByLabel("Teks slide sementara", { exact: true }),
  ).toHaveAttribute("readonly", "");
  await page.getByRole("tab", { name: /Themes/ }).click();
  await page
    .getByRole("button", { name: "Pilih tema Typography", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit / rename tema", exact: true })
    .click();
  await page
    .getByLabel("Gunakan teks Preview saat ini", { exact: true })
    .check();
  await expect(
    page.getByRole("region", { name: "Editor tema" }).locator(".themed-lines"),
  ).toHaveText(data.verses[0].text);
  await expect(
    page
      .getByRole("region", { name: "Editor tema" })
      .locator(".scripture-attribution"),
  ).toHaveText(data.translation.license.displayAttribution);

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
  await page.getByRole("tab", { name: /Media/ }).click();
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await imageFile(page, "bad-background.png"));
  await expect(
    page.getByRole("button", {
      name: "Pilih media bad-background.png",
      exact: true,
    }),
  ).toBeVisible();
  await create(page, "Corruption fixture", "image");
  await apply(page);
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
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Error");
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
  await page.getByRole("button", { name: "Buat tema", exact: true }).click();
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
