import { test, expect, type Page } from "@playwright/test";

// Tahap 1 (SagiWorship layout): status box, SONGS tab playlists/folders, search.
async function song(page: Page, title: string, lyrics: string[]) {
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor.getByLabel("Judul lagu", { exact: true }).fill(title);
  await editor.getByLabel("Penyanyi / pencipta", { exact: true }).fill("Demo Penyembahan");
  for (let i = 0; i < lyrics.length; i++) {
    if (i) await editor.getByRole("button", { name: "Tambah bagian", exact: true }).click();
    await editor.getByLabel(`Lirik bagian ${i + 1}`, { exact: true }).fill(lyrics[i]);
  }
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(editor).toHaveCount(0);
}
async function playlist(page: Page, name: string) {
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  await page.getByLabel("Nama jadwal", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Simpan jadwal", exact: true }).click();
  await expect(page.getByLabel("Nama jadwal", { exact: true })).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});

test("status box shows READY, then LIVE, BLACK and CLEAR TEXT", async ({ page }) => {
  const status = page.getByTestId("app-status");
  await expect(status).toHaveText(/READY/);
  await song(page, "Trust In God", ["First synthetic line.", "Second synthetic line."]);
  await page.getByRole("button", { name: "Preview Trust In God", exact: true }).click();
  await expect(page.getByRole("list", { name: "Daftar slide Preview" })).toBeVisible();
  await expect(status).toHaveText(/READY/);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(status).toHaveText(/LIVE/);
  const live = page.getByRole("region", { name: "LIVE projector control" });
  await live.getByRole("button", { name: "Black", exact: true }).click();
  await expect(status).toHaveText(/BLACK/);
  await live.getByRole("button", { name: "Black", exact: true }).click();
  await expect(status).toHaveText(/^\W*LIVE$/);
  await live.getByRole("button", { name: "Clear Text", exact: true }).click();
  await expect(status).toHaveText(/CLEAR TEXT/);
});

test("SONGS tab lists playlists and folders, and switches the active Week", async ({ page }) => {
  await expect(page.getByRole("tab", { name: "Songs", exact: true })).toHaveAttribute("aria-selected", "true");
  await playlist(page, "week1");
  await playlist(page, "week2");
  const active = page.getByLabel("Jadwal aktif", { exact: true });
  await expect(active.locator("option:checked")).toHaveText("week2");
  const playlists = page.getByRole("list", { name: "Playlists" });
  await expect(playlists.getByRole("button")).toHaveCount(2);
  await playlists.getByRole("button", { name: /week1/ }).click();
  await expect(active.locator("option:checked")).toHaveText("week1");
  await expect(playlists.getByRole("button", { name: /week1/ })).toHaveAttribute("aria-current", "true");
  await song(page, "Been So Good", ["Synthetic praise line."]);
  await expect(page.getByRole("list", { name: "Folders" })).toContainText("Music");
  await expect(page.getByRole("list", { name: "Folders" })).toContainText("1");
  const row = page.getByTestId("song-row").filter({ hasText: "Been So Good" });
  await expect(row).toContainText("Demo Penyembahan · 1 section");
  await row.getByRole("button", { name: "Ke jadwal", exact: true }).click();
  await expect(playlists.getByRole("button", { name: /week1/ })).toContainText("1");
  await expect(page.getByRole("region", { name: "Jadwal ibadah" })).toContainText("1 item");
});

test("song search filters Music and the X button clears it", async ({ page }) => {
  await song(page, "Trust In God", ["Synthetic line one."]);
  await song(page, "Been So Good", ["Synthetic line two."]);
  const search = page.getByLabel("Cari Lagu", { exact: true });
  await search.fill("Trust");
  await expect(page.getByTestId("song-row")).toHaveCount(1);
  await expect(page.getByText("1 lagu ditemukan")).toBeVisible();
  await page.getByRole("button", { name: "Hapus pencarian", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByTestId("song-row")).toHaveCount(2);
});
