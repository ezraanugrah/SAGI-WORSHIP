import { test, expect, type Page } from "@playwright/test";
import { dragToWeek } from "./dragHelpers";
const BufferNode = (globalThis as any).Buffer;
async function song(page: Page, text = "Synthetic phase eight lyrics") {
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor
    .getByLabel("Judul lagu", { exact: true })
    .fill("Phase eight synthetic");
  await editor.getByLabel("Lirik bagian 1", { exact: true }).fill(text);
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor.getByRole("button", { name: "Selesai", exact: true }).click();
}
async function settings(page: Page) {
  await page.getByRole("link", { name: "Pengaturan", exact: true }).click();
}
async function exported(page: Page) {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Buat backup .sagibak", exact: true })
    .click();
  const stream = await (await pending).createReadStream(),
    parts = [];
  for await (const part of stream!) parts.push(part);
  return {
    name: "phase8.sagibak",
    mimeType: "application/octet-stream",
    buffer: BufferNode.concat(parts),
  };
}
test.beforeEach(async ({ page, context }) => {
  await context.addInitScript(() =>
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});
test("Phase 8 equal-parent aggregate conflict stays safe through browser backup, preview and atomic merge", async ({
  page,
}) => {
  await song(page);
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  await page
    .getByLabel("Nama jadwal", { exact: true })
    .fill("Repeated synthetic service");
  await page
    .getByRole("button", { name: "Simpan jadwal", exact: true })
    .click();
  for (let i = 0; i < 2; i++) {
    await dragToWeek(page.getByTestId("song-row").first());
    await expect(page.getByTestId("schedule-item")).toHaveCount(i + 1);
  }
  await settings(page);
  const file = await exported(page);
  // Deliberately change only a child in this disposable context; parent metadata stays identical.
  await page.evaluate(
    async () =>
      new Promise<void>((resolve, reject) => {
        const q = indexedDB.open("sagi-worship", 1);
        q.onsuccess = () => {
          const db = q.result,
            tx = db.transaction("song_sections", "readwrite"),
            rows = tx.objectStore("song_sections").getAll();
          rows.onsuccess = () =>
            tx
              .objectStore("song_sections")
              .put({ ...rows.result[0], text: "Preserved destination lyrics" });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.getByLabel("File backup", { exact: true }).setInputFiles(file);
  await page
    .getByRole("button", { name: "Siapkan restore", exact: true })
    .click();
  await page
    .getByLabel("Mode restore", { exact: true })
    .selectOption("existing");
  await page
    .getByRole("button", { name: "Tinjau konflik restore", exact: true })
    .click();
  await expect(
    page.getByLabel("Dampak restore", { exact: true }),
  ).toContainText("Lewati dependensi");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", {
      name: "End Session untuk restore / repair",
      exact: true,
    })
    .click();
  await page.getByLabel("Mode restore", { exact: true }).selectOption("both");
  await page
    .getByRole("button", { name: "Tinjau konflik restore", exact: true })
    .click();
  await expect(
    page.getByLabel("Dampak restore", { exact: true }),
  ).toContainText("Duplikasi songs/");
  await expect(
    page.getByLabel("Dampak restore", { exact: true }),
  ).toContainText("Duplikasi schedules/");
  await page
    .getByLabel("Saya memahami dampak restore dan pilihan konflik")
    .check();
  await page
    .getByRole("button", { name: "Publikasikan restore", exact: true })
    .click();
  await expect(page.getByText(/Restore atomik selesai/)).toBeVisible();
  const result = await page.evaluate(
    async () =>
      new Promise<any>((resolve, reject) => {
        const q = indexedDB.open("sagi-worship", 1);
        q.onsuccess = () => {
          const db = q.result,
            tx = db.transaction(
              ["songs", "song_sections", "schedules", "schedule_items"],
              "readonly",
            ),
            result: any = { version: db.version };
          for (const store of [
            "songs",
            "song_sections",
            "schedules",
            "schedule_items",
          ]) {
            const r = tx.objectStore(store).getAll();
            r.onsuccess = () => (result[store] = r.result);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  expect(result.version).toBe(1);
  expect(result.songs).toHaveLength(2);
  expect(result.schedules).toHaveLength(2);
  expect(result.schedule_items).toHaveLength(4);
  expect(result.song_sections.map((s: any) => s.text).sort()).toEqual(
    ["Preserved destination lyrics", "Synthetic phase eight lyrics"].sort(),
  );
  for (const schedule of result.schedules)
    expect(
      schedule.itemIds.every((id: string) =>
        result.schedule_items.some(
          (i: any) => i.id === id && i.scheduleId === schedule.id,
        ),
      ),
    ).toBe(true);
});
test("Phase 8 Unicode keyboard, responsive layout and explicit frozen recovery", async ({
  page,
}) => {
  const lyric = "Synthetic café e\u0301 — 漢字 Ελληνικά 😀";
  await song(page, lyric);
  await page
    .getByTestId("song-row")
    .getByRole("button", { name: /^Phase eight synthetic/ })
    .click();
  const pending = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  const output = await pending;
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(output.locator(".slide-lines")).toHaveText(lyric);
  const controls = page.getByRole("region", {
    name: "LIVE projector control",
    exact: true,
  });
  await controls.focus();
  await page.keyboard.press("b");
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await page.keyboard.press("b");
  await expect(output.locator(".slide-lines")).toHaveText(lyric);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.getByText(/Checkpoint tersimpan/)).toBeVisible();
  await output.close();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Pemulihan presentasi" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Go Live", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Resume presentasi", exact: true })
    .click();
  const nextPending = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  await expect((await nextPending).locator(".slide-lines")).toHaveText(lyric);
});
