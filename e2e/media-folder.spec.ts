import { test, expect, type Page } from "@playwright/test";
import { imageFile } from "./mediaFixtures";
// The Media tab's watched folder. The folder picker is replaced by a real
// folder in the browser's private file system (OPFS) named "Downloads", so
// the test can drop files into it like a finished download.
async function download(page: Page, name: string, color: string) {
  const file = await imageFile(page, name, color);
  const bytes = Array.from(file.buffer);
  await page.evaluate(
    async ({ name, bytes }) => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle("Downloads", { create: true });
      const handle = await dir.getFileHandle(name, { create: true });
      const writer = await handle.createWritable();
      await writer.write(new Uint8Array(bytes));
      await writer.close();
    },
    { name, bytes },
  );
}
const card = (page: Page, name: string) =>
  page.getByRole("button", { name: `Pilih media ${name}`, exact: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (
      window as unknown as { showDirectoryPicker: () => Promise<unknown> }
    ).showDirectoryPicker = async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle("Downloads", {
        create: true,
      });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});

test("a file downloaded after choosing the folder is detected and imported with one click", async ({
  page,
}) => {
  test.setTimeout(90000);
  await download(page, "lama.png", "#224466");
  await page.getByRole("tab", { name: /Media/ }).click();
  const watch = page.getByRole("region", { name: "Folder pantauan" });
  await watch
    .getByRole("button", { name: "Pilih folder", exact: true })
    .click();
  await expect(watch).toContainText("Downloads");
  await expect(watch).toContainText("Dipantau · 1 file belum di Media");
  // The old file is not announced as new.
  await expect(
    page.getByRole("region", { name: "File baru di folder" }),
  ).toHaveCount(0);

  await download(page, "kebaktian.png", "#aa5522");
  await download(page, "video.mp4.crdownload", "#000000");
  const fresh = page.getByRole("region", { name: "File baru di folder" });
  await expect(fresh).toContainText("1 file baru di “Downloads”", {
    timeout: 15000,
  });
  await expect(fresh).toContainText("kebaktian.png");
  await expect(fresh).not.toContainText("crdownload");
  await expect(page.getByRole("tab", { name: /Media/ })).toContainText(
    "1 baru",
  );
  await page.screenshot({ path: test.info().outputPath("media-folder.png") });
  await fresh
    .getByRole("button", { name: "Impor kebaktian.png", exact: true })
    .click();
  await expect(card(page, "kebaktian.png")).toBeVisible({ timeout: 15000 });
  await expect(fresh).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Media/ })).not.toContainText(
    "baru",
  );

  // Older files can still be listed and imported on request.
  await watch
    .getByRole("button", { name: "Lihat semua yang belum di Media" })
    .click();
  await page
    .getByRole("region", { name: "File baru di folder" })
    .getByRole("button", { name: "Impor lama.png", exact: true })
    .click();
  await expect(card(page, "lama.png")).toBeVisible({ timeout: 15000 });
  await expect(watch).toContainText("Dipantau · 0 file belum di Media");
});

test("auto-import picks up a finished download, even while another tab is open, and the folder is remembered", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.getByRole("tab", { name: /Media/ }).click();
  const watch = page.getByRole("region", { name: "Folder pantauan" });
  await watch
    .getByRole("button", { name: "Pilih folder", exact: true })
    .click();
  await watch.getByLabel("Impor otomatis file baru").check();
  await page.getByRole("tab", { name: /Songs/ }).click();
  await download(page, "otomatis.png", "#33aa77");
  await page.waitForTimeout(12000); // two scans: the file must stay unchanged
  await page.getByRole("tab", { name: /Media/ }).click();
  await expect(card(page, "otomatis.png")).toBeVisible({ timeout: 15000 });

  await page.reload();
  await page.getByRole("tab", { name: /Media/ }).click();
  const again = page.getByRole("region", { name: "Folder pantauan" });
  await expect(again).toContainText("Downloads");
  await expect(again.getByLabel("Impor otomatis file baru")).toBeChecked();
  await expect(again).toContainText("Dipantau · 0 file belum di Media");
  await again
    .getByRole("button", { name: "Lepas folder", exact: true })
    .click();
  await expect(
    again.getByRole("button", { name: "Pilih folder", exact: true }),
  ).toBeVisible();
});
