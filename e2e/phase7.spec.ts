import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import {
  previewPosition,
  closeTextEditor,
  openTextEditor,
} from "./previewHelpers";
import { dragToWeek, mediaCard, openWeek } from "./dragHelpers";
import {
  imageFile,
  nodeBuffer,
  videoFile,
  syntheticPDF,
} from "./mediaFixtures";
import { createTheme } from "./themeHelpers";
const BufferNode = (globalThis as any).Buffer;
async function settings(page: Page) {
  await page.getByRole("link", { name: "Pengaturan", exact: true }).click();
  await expect(
    page.getByText("Backup & Recovery", { exact: true }),
  ).toBeVisible();
}
async function song(page: Page, title = "Backup composition") {
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  const e = page.getByRole("region", { name: "Editor lagu" });
  await e.getByLabel("Judul lagu", { exact: true }).fill(title);
  await e
    .getByLabel("Lirik bagian 1", { exact: true })
    .fill("Original backup verification lyric.\nExact second line.");
  await expect(e.getByRole("status")).toHaveText("Tersimpan lokal");
  await e.getByRole("button", { name: "Selesai", exact: true }).click();
}
async function exportFile(page: Page) {
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Buat backup .sagibak", exact: true })
    .click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: any[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  return {
    name: "portable.sagibak",
    mimeType: "application/octet-stream",
    buffer: BufferNode.concat(chunks),
  };
}
async function stage(page: Page, file: any, mode = "fresh") {
  await page.getByLabel("File backup", { exact: true }).setInputFiles(file);
  await page
    .getByRole("button", { name: "Siapkan restore", exact: true })
    .click();
  await expect(page.getByLabel("Mode restore", { exact: true })).toBeVisible();
  await page.getByLabel("Mode restore", { exact: true }).selectOption(mode);
  await page
    .getByRole("button", { name: "Tinjau konflik restore", exact: true })
    .click();
  await expect(
    page.getByLabel("Dampak restore", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Saya memahami dampak restore dan pilihan konflik")
    .check();
}
async function end(page: Page) {
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", {
      name: "End Session untuk restore / repair",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(/Sesi berakhir dan projector ditutup/),
  ).toBeVisible();
  if (
    await page
      .getByRole("button", { name: "Tinjau konflik restore", exact: true })
      .count()
  ) {
    await page
      .getByRole("button", { name: "Tinjau konflik restore", exact: true })
      .click();
    await expect(
      page.getByLabel("Dampak restore", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Saya memahami dampak restore dan pilihan konflik")
      .check();
  }
}
async function offline(context: BrowserContext, page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
}
async function configure(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
}
test.beforeEach(async ({ context, page }) => {
  await configure(context);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});
test("offline portable backup restores mixed image, theme, song and settings into a fresh profile", async ({
  page,
  context,
  browser,
}) => {
  await song(page);
  await openWeek(page, 1);
  await dragToWeek(page.getByTestId("song-row").first());
  await page
    .getByTestId("song-row")
    .getByRole("button", { name: /^Backup composition/ })
    .click();
  await openTextEditor(page);
  await page
    .getByLabel("Teks slide sementara", { exact: true })
    .fill("Original portable override.");
  await page
    .getByRole("button", { name: "Apply Preview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Go Live", exact: true }),
  ).toBeEnabled();

  await page.getByRole("tab", { name: /Media/ }).click();
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await imageFile(page, "backup.png"));
  await expect(
    page.getByRole("button", { name: "Pilih media backup.png", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pilih media backup.png", exact: true })
    .click();
  await dragToWeek(mediaCard(page, "backup.png"));
  await page.getByRole("tab", { name: "Presentations", exact: true }).click();
  await page.getByLabel("File presentasi", { exact: true }).setInputFiles({
    name: "portable.pdf",
    mimeType: "application/pdf",
    buffer: syntheticPDF(),
  });
  await page
    .getByRole("button", { name: "Pilih media portable.pdf", exact: true })
    .click();
  await page.getByLabel("Halaman PDF", { exact: true }).fill("1-2");
  await dragToWeek(mediaCard(page, "portable.pdf"));
  await page
    .getByRole("button", { name: "Preview media", exact: true })
    .click();
  await expect(previewPosition(page)).toHaveText(/ of 2$/);
  // Themes are made through Impor media (backup.png is reused from Media).
  await createTheme(
    page,
    "Portable theme",
    "solid",
    await imageFile(page, "backup.png"),
  );
  await expect(page.getByTestId("schedule-item")).toHaveCount(3);
  await settings(page);
  await offline(context, page);
  const file = await exportFile(page);
  await page.getByLabel("File backup", { exact: true }).setInputFiles(file);
  await page
    .getByRole("button", { name: "Verifikasi file", exact: true })
    .click();
  await expect(page.getByText(/Verifikasi lulus:/)).toBeVisible();
  const fresh = await browser.newContext({ serviceWorkers: "allow" });
  await configure(fresh);
  const target = await fresh.newPage();
  await target.goto("http://localhost:4174/");
  await settings(target);
  await offline(fresh, target);
  await stage(target, file);
  await end(target);
  await target
    .getByRole("button", { name: "Publikasikan restore", exact: true })
    .click();
  await expect(target.getByText(/Restore atomik selesai/)).toBeVisible();
  await target.reload();
  await target.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    target.getByRole("button", {
      name: "Edit Backup composition",
      exact: true,
    }),
  ).toBeVisible();
  await expect(target.getByTestId("schedule-item")).toHaveCount(3);
  await target
    .getByTestId("song-row")
    .getByRole("button", { name: /^Backup composition/ })
    .click();
  await openTextEditor(target);
  await expect(
    target.getByLabel("Teks slide sementara", { exact: true }),
  ).toHaveValue("Original portable override.");
  await closeTextEditor(target);
  await target.getByRole("tab", { name: /Media/ }).click();
  await expect(
    target.getByRole("button", { name: "Pilih media backup.png", exact: true }),
  ).toBeVisible();
  await target.getByRole("tab", { name: "Presentations", exact: true }).click();
  await target
    .getByRole("button", { name: "Pilih media portable.pdf", exact: true })
    .click();
  await target.getByLabel("Halaman PDF", { exact: true }).fill("1-2");
  await target
    .getByRole("button", { name: "Preview media", exact: true })
    .click();
  await expect(previewPosition(target)).toHaveText(/ of 2$/);
  await target.getByRole("tab", { name: /Themes/ }).click();
  await expect(
    target.getByRole("button", {
      name: "Pilih tema Portable theme",
      exact: true,
    }),
  ).toBeVisible();
  await fresh.close();
});
test("backup during LIVE does not change output; restore requires End Session and retires projector", async ({
  page,
}) => {
  await song(page);
  await page
    .getByTestId("song-row")
    .getByRole("button", { name: /^Backup composition/ })
    .click();
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  const output = await popup;
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(output.locator(".slide-lines")).toContainText(
    "Original backup verification lyric.",
  );
  await expect(page.getByText(/Checkpoint tersimpan/)).toBeVisible();
  await settings(page);
  const file = await exportFile(page);
  await expect(output.locator(".slide-lines")).toContainText(
    "Original backup verification lyric.",
  );
  await stage(page, file, "existing");
  await page
    .getByRole("button", { name: "Publikasikan restore", exact: true })
    .click();
  await expect(page.getByText(/End Session dan tutup projector/)).toBeVisible();
  expect(output.isClosed()).toBe(false);
  await end(page);
  expect(output.isClosed()).toBe(true);
  await page
    .getByRole("button", { name: "Publikasikan restore", exact: true })
    .click();
  await expect(page.getByText(/Restore atomik selesai/)).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Pemulihan presentasi" }),
  ).toBeVisible();
});
test("malformed backup, cancelled confirmation and secondary-tab staging preserve data", async ({
  page,
  context,
}) => {
  await song(page);
  await settings(page);
  await page.getByLabel("File backup", { exact: true }).setInputFiles({
    name: "broken.sagibak",
    mimeType: "application/octet-stream",
    buffer: nodeBuffer.from("SAGIBAK9invalid"),
  });
  await page
    .getByRole("button", { name: "Siapkan restore", exact: true })
    .click();
  await expect(page.getByText(/ukuran arsip|format\/versi/)).toBeVisible();
  await expect(page.getByLabel("Mode restore", { exact: true })).toHaveCount(0);
  const reader = await context.newPage();
  await reader.goto("/");
  await settings(reader);
  await expect(
    reader.getByRole("button", { name: "Siapkan restore", exact: true }),
  ).toBeDisabled();
  await expect(
    reader.getByRole("button", {
      name: "End Session untuk restore / repair",
      exact: true,
    }),
  ).toBeDisabled();
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", {
      name: "End Session untuk restore / repair",
      exact: true,
    })
    .click();
  await expect(page.getByText("End Session dibatalkan.")).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Backup composition", exact: true }),
  ).toBeVisible();
});
test("safe keep-both merge preserves both linked song aggregates", async ({
  page,
}) => {
  await song(page);
  await settings(page);
  const file = await exportFile(page);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Backup composition", exact: true })
    .click();
  const e = page.getByRole("region", { name: "Editor lagu" });
  await e
    .getByLabel("Judul lagu", { exact: true })
    .fill("Newer destination composition");
  await expect(e.getByRole("status")).toHaveText("Tersimpan lokal");
  await e.getByRole("button", { name: "Selesai", exact: true }).click();
  await settings(page);
  await stage(page, file, "both");
  await end(page);
  await page
    .getByRole("button", { name: "Publikasikan restore", exact: true })
    .click();
  await expect(page.getByText(/Restore atomik selesai/)).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Backup composition", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Edit Newer destination composition",
      exact: true,
    }),
  ).toBeVisible();
});
test("Storage Health preserves unknown data and staging removal is explicit", async ({
  page,
}) => {
  await song(page);
  await settings(page);
  const file = await exportFile(page);
  await page.getByLabel("File backup", { exact: true }).setInputFiles(file);
  await page
    .getByRole("button", { name: "Siapkan restore", exact: true })
    .click();
  await expect(
    page.getByText("Staging tersimpan", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Staging tersimpan", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Hapus staging", exact: true })
    .click();
  await expect(
    page.getByText("Staging dihapus.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("sagi-worship", 1);
      req.onsuccess = () => {
        const db = req.result,
          tx = db.transaction("settings", "readwrite");
        tx.objectStore("settings").put({
          id: "unknown:future",
          format: 99,
          preserved: "never erase",
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page
    .getByRole("button", { name: "Scan integritas penuh", exact: true })
    .click();
  await expect(
    page.getByText(
      /record tidak valid\/tidak didukung: settings\/unknown:future/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Tinjau & konfirmasi repair pin",
      exact: true,
    }),
  ).toHaveCount(0);
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
    path: "docs/evidence/phase7-mobile.png",
    fullPage: true,
  });
});

test("restored video checkpoint requires explicit Resume and fresh output remains paused offline", async ({
  page,
  browser,
}) => {
  await page.getByRole("tab", { name: /Media/ }).click();
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await videoFile(page));
  await page
    .getByRole("button", { name: /^Pilih media .*webm$/, exact: false })
    .click();
  await page
    .getByRole("button", { name: "Preview media", exact: true })
    .click();
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  const output = await popup;
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(output.locator("video")).toBeVisible();
  await expect(page.getByText(/Checkpoint tersimpan/)).toBeVisible();
  await settings(page);
  const file = await exportFile(page);
  const context = await browser.newContext({ serviceWorkers: "allow" });
  await configure(context);
  const p = await context.newPage();
  await p.goto("/");
  await settings(p);
  await offline(context, p);
  await stage(p, file);
  await end(p);
  await p
    .getByRole("button", { name: "Publikasikan restore", exact: true })
    .click();
  await expect(p.getByText(/Restore atomik selesai/)).toBeVisible();
  await p.reload();
  await p.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    p.getByRole("region", { name: "Pemulihan presentasi" }),
  ).toBeVisible();
  await p
    .getByRole("button", { name: "Resume presentasi", exact: true })
    .click();
  const nextPopup = p.waitForEvent("popup");
  await p.getByRole("button", { name: "Live", exact: true }).click();
  const next = await nextPopup;
  await expect(next.locator("video")).toBeVisible();
  expect(
    await next.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
  ).toBe(true);
  await next.reload();
  await expect(next.locator("video")).toBeVisible();
  expect(
    await next.locator("video").evaluate((v: HTMLVideoElement) => v.paused),
  ).toBe(true);
  await context.close();
});
test("streaming output uses bounded writes and can be reopened for verification", async ({
  page,
}) => {
  await song(page);
  await settings(page);
  await page.evaluate(() => {
    (window as any).savedChunks = [];
    (window as any).showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async (bytes: Uint8Array) => {
          (window as any).savedChunks.push(Array.from(bytes));
        },
        close: async () => {},
        abort: async () => {
          (window as any).savedChunks = [];
        },
      }),
    });
  });
  await page
    .getByRole("button", { name: "Buat backup .sagibak", exact: true })
    .click();
  await expect(page.getByText(/Backup lengkap diserahkan/)).toBeVisible();
  const chunks = await page.evaluate(
    () => (window as any).savedChunks as number[][],
  );
  expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(
    4 * 1024 ** 2,
  );
  const file = {
    name: "streamed.sagibak",
    mimeType: "application/octet-stream",
    buffer: BufferNode.concat(chunks.map((c) => BufferNode.from(c))),
  };
  await page.getByLabel("File backup", { exact: true }).setInputFiles(file);
  await page
    .getByRole("button", { name: "Verifikasi file", exact: true })
    .click();
  await expect(page.getByText(/Verifikasi lulus:/)).toBeVisible();
});
test("destination receipt quota failure rolls back all records and permits an explicit retry", async ({
  page,
}) => {
  await song(page);
  await settings(page);
  const file = await exportFile(page);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Backup composition", exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor
    .getByLabel("Judul lagu", { exact: true })
    .fill("Preserved destination");
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor.getByRole("button", { name: "Selesai", exact: true }).click();
  await settings(page);
  await stage(page, file, "both");
  await end(page);
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    (window as any).restoreReceiptAdd = () => {
      IDBObjectStore.prototype.add = add;
    };
    IDBObjectStore.prototype.add = function (value: any, key?: IDBValidKey) {
      if (this.name === "backup_manifest" && value.kind === "receipt")
        throw new DOMException(
          "Injected publication quota",
          "QuotaExceededError",
        );
      return add.call(this, value, key);
    };
  });
  await page
    .getByRole("button", { name: "Publikasikan restore", exact: true })
    .click();
  await expect(
    page.getByText("Injected publication quota", { exact: true }),
  ).toBeVisible();
  const titles = await page.evaluate(
    async () =>
      new Promise<string[]>((resolve) => {
        const q = indexedDB.open("sagi-worship", 1);
        q.onsuccess = () => {
          const db = q.result,
            tx = db.transaction("songs", "readonly"),
            r = tx.objectStore("songs").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve(r.result.map((v) => v.title));
          };
        };
      }),
  );
  expect(titles).toEqual(["Preserved destination"]);
  await page.evaluate(() => (window as any).restoreReceiptAdd());
  await page
    .getByRole("button", { name: "Publikasikan restore", exact: true })
    .click();
  await expect(page.getByText(/Restore atomik selesai/)).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByTestId("song-row")).toHaveCount(2);
});
test("Storage Health repairs only a verified missing theme pin after explicit review", async ({
  page,
}) => {
  await page.getByRole("tab", { name: /Media/ }).click();
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await imageFile(page, "repair.png"));
  await expect(
    page.getByRole("button", { name: "Pilih media repair.png", exact: true }),
  ).toBeVisible();
  await createTheme(
    page,
    "Verified retained theme",
    "image",
    await imageFile(page, "repair.png"),
  );
  await page.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        const q = indexedDB.open("sagi-worship", 1);
        q.onsuccess = () => {
          const db = q.result,
            tx = db.transaction(["themes", "media_assets"], "readwrite"),
            r = tx.objectStore("themes").getAll();
          r.onsuccess = () =>
            tx
              .objectStore("media_assets")
              .delete(`pin:theme:${r.result[0].id}`);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await settings(page);
  await end(page);
  await page
    .getByRole("button", { name: "Scan integritas penuh", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Tinjau & konfirmasi repair pin",
      exact: true,
    }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", {
      name: "Tinjau & konfirmasi repair pin",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Pin diperbaiki secara atomik. Jalankan scan ulang.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Scan integritas penuh", exact: true })
    .click();
  await expect(
    page.getByText("Scan integritas penuh selesai.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Tinjau & konfirmasi repair pin",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByText(/Tema Verified retained theme/)).toBeVisible();
});
