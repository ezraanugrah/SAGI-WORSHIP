import { test, expect, type Page } from "@playwright/test";
import { imageFile, syntheticPDF } from "./mediaFixtures";
import { activeSchedule, dragToWeek, mediaCard, openWeek } from "./dragHelpers";

// SagiWorship workspace: Schedule | Preview | Live, one LIVE toolbar on top,
// library tabs below.
async function song(page: Page, title: string, lyrics: string[]) {
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor.getByLabel("Judul lagu", { exact: true }).fill(title);
  await editor
    .getByLabel("Penyanyi / pencipta", { exact: true })
    .fill("Demo Penyembahan");
  for (let i = 0; i < lyrics.length; i++) {
    if (i)
      await editor
        .getByRole("button", { name: "Tambah bagian", exact: true })
        .click();
    await editor
      .getByLabel(`Lirik bagian ${i + 1}`, { exact: true })
      .fill(lyrics[i]);
  }
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(editor).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});

function songRow(page: Page, title: string) {
  return page.getByTestId("song-row").filter({
    has: page.getByRole("button", { name: `Edit ${title}`, exact: true }),
  });
}
async function preview(page: Page, title: string) {
  await songRow(page, title)
    .getByRole("button", { name: new RegExp(`^${title}`) })
    .click();
  await expect(
    page.getByRole("list", { name: "Daftar slide Preview" }),
  ).toBeVisible();
}

test("status box shows READY, then LIVE, BLACK and CLEAR TEXT", async ({
  page,
}) => {
  const status = page.getByTestId("app-status");
  await expect(status).toHaveText(/READY/);
  await song(page, "Trust In God", [
    "First synthetic line.",
    "Second synthetic line.",
  ]);
  await preview(page, "Trust In God");
  await expect(status).toHaveText(/READY/);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(status).toHaveText(/LIVE/);
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(status).toHaveText(/BLACK/);
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(status).toHaveText(/^\W*LIVE$/);
  await page.getByRole("button", { name: "Clear Text", exact: true }).click();
  await expect(status).toHaveText(/CLEAR TEXT/);
});

test("SONGS tab lists playlists and folders, and switches the active Week", async ({
  page,
}) => {
  await expect(
    page.getByRole("tab", { name: "Songs", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  // Songs category: only "Playlist Jadwal" (Week 1–4) and the "Musik" folder.
  const playlists = page.getByRole("list", { name: "Playlist Jadwal" });
  await expect(playlists.getByRole("button")).toHaveText([
    /^Week 1/,
    /^Week 2/,
    /^Week 3/,
    /^Week 4/,
  ]);
  await expect(page.getByRole("button", { name: "New playlist" })).toHaveCount(
    0,
  );
  await expect(activeSchedule(page)).toHaveText("Jadwal Ibadah - Week 1");
  await openWeek(page, 2);
  const week2 = playlists.getByRole("button", { name: /^Week 2 \d+$/ });
  await expect(week2).toHaveAttribute("aria-current", "true");
  await song(page, "Been So Good", ["Synthetic praise line."]);
  const folders = page.getByRole("list", { name: "Folder" });
  await expect(folders).toContainText("Musik");
  await expect(folders.locator(".side-count")).toHaveText("1");
  const row = songRow(page, "Been So Good");
  await expect(row).toContainText("Demo Penyembahan · 1 section");
  await dragToWeek(row);
  await expect(week2.locator(".side-count")).toHaveText("1");
  await expect(
    page.getByRole("region", { name: "Jadwal ibadah" }),
  ).toContainText("1 item");
  await openWeek(page, 3);
  await expect(page.getByTestId("schedule-item")).toHaveCount(0);
});

test("music search filters Musik and the X button clears it", async ({
  page,
}) => {
  await song(page, "Trust In God", ["Synthetic line one."]);
  await song(page, "Been So Good", ["Synthetic line two."]);
  const search = page.getByLabel("Cari musik", { exact: true });
  await search.fill("Trust");
  await expect(page.getByTestId("song-row")).toHaveCount(1);
  await expect(page.getByText("1 lagu ditemukan")).toBeVisible();
  await page
    .getByRole("button", { name: "Hapus pencarian", exact: true })
    .click();
  await expect(search).toHaveValue("");
  await expect(page.getByTestId("song-row")).toHaveCount(2);
});

test("songs dragged with the mouse land in the active Week without breaking item reordering", async ({
  page,
}) => {
  // Keep the Week and the Music list on screen together: Playwright's HTML5
  // drag cannot scroll the page mid-drag (Chrome itself auto-scrolls).
  await page.setViewportSize({ width: 1600, height: 1400 });
  await openWeek(page, 1);
  await song(page, "Trust In God", ["Synthetic drag line."]);
  await song(page, "Been So Good", ["Second synthetic drag line."]);
  const items = page.getByTestId("schedule-item");
  const row = (title: string) =>
    page.getByTestId("song-row").filter({ hasText: title });
  await expect(row("Been So Good")).toHaveAttribute("draggable", "true");
  await row("Trust In God").dragTo(page.getByTestId("week-drop-zone"));
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Trust In God");
  // Dropping on an existing item also adds the song (appended), not a reorder.
  await row("Been So Good").dragTo(items.first());
  await expect(items).toHaveCount(2);
  await expect(items.nth(1)).toContainText("Been So Good");
  // Reordering Week items by drag still works and adds nothing.
  await items.nth(1).dragTo(items.nth(0));
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Been So Good");
  await expect(
    page.getByRole("region", { name: "Jadwal ibadah" }),
  ).toContainText("2 item");
  // There is no separate "Ke jadwal" button any more: adding is drag only.
  await expect(page.getByRole("button", { name: "Ke jadwal" })).toHaveCount(0);
});

test("one LIVE toolbar drives Go Live, Alerts, Black, Clear and the projector window", async ({
  page,
}) => {
  const toolbar = page.getByRole("toolbar", { name: "Kontrol LIVE" });
  const status = page.getByTestId("app-status");
  // Each LIVE control exists once (no duplicates in the LIVE panel).
  for (const name of ["Go Live", "Black", "Clear Text", "Live", "Alerts"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      1,
    );
  await expect(page.getByRole("button", { name: "Restore" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open Projector Window" }),
  ).toHaveCount(0);
  await expect(
    toolbar.getByRole("button", { name: "Go Live", exact: true }),
  ).toBeDisabled();
  await expect(
    toolbar.getByRole("button", { name: "Black", exact: true }),
  ).toBeDisabled();
  await expect(
    toolbar.getByRole("button", { name: "Alerts", exact: true }),
  ).toBeDisabled();
  await song(page, "Toolbar song", [
    "First toolbar line.",
    "Second toolbar line.",
  ]);
  await preview(page, "Toolbar song");
  // Live opens (or focuses) the projector window and lights up once synced.
  const popup = page.waitForEvent("popup");
  await toolbar.getByRole("button", { name: "Live", exact: true }).click();
  const output = await popup;
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  await expect(
    toolbar.getByRole("button", { name: "Live", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await toolbar.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(status).toHaveText(/LIVE/);
  await expect(output.locator(".slide-lines")).toHaveText(
    "First toolbar line.",
  );
  // Alerts: a ticker over the audience slide, hidden while Black.
  const alerts = toolbar.getByRole("button", { name: "Alerts", exact: true });
  await alerts.click();
  await page
    .getByLabel("Pesan alert", { exact: true })
    .fill("Parkir penuh, harap ke halaman belakang");
  await page
    .getByRole("button", { name: "Tampilkan alert", exact: true })
    .click();
  await expect(output.getByTestId("slide-alert")).toHaveText(
    "Parkir penuh, harap ke halaman belakang",
  );
  await expect(alerts).toHaveAttribute("aria-pressed", "true");
  const black = toolbar.getByRole("button", { name: "Black", exact: true });
  await black.click();
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await expect(black).toHaveAttribute("aria-pressed", "true");
  await expect(output.getByTestId("slide-alert")).toHaveCount(0);
  await black.click();
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "normal",
  );
  await expect(output.getByTestId("slide-alert")).toBeVisible();
  // The alert stays up when the next slide goes LIVE.
  await page.getByRole("listitem", { name: /^Preview slide 2:/ }).click();
  await toolbar.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(output.locator(".slide-lines")).toHaveText(
    "Second toolbar line.",
  );
  await expect(output.getByTestId("slide-alert")).toBeVisible();
  await alerts.click();
  await page
    .getByRole("button", { name: "Hentikan alert", exact: true })
    .click();
  await expect(output.getByTestId("slide-alert")).toHaveCount(0);
  await expect(alerts).toHaveAttribute("aria-pressed", "false");
  await toolbar
    .getByRole("button", { name: "Clear Text", exact: true })
    .click();
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "clearText",
  );
  await expect(status).toHaveText(/CLEAR TEXT/);
});

test("Schedule expands the open item into slides and the LIVE list jumps slides", async ({
  page,
}) => {
  await openWeek(page, 1);
  await song(page, "Expand song", [
    "Expand line one.",
    "Expand line two.",
    "Expand line three.",
  ]);
  await dragToWeek(songRow(page, "Expand song"));
  const schedule = page.getByRole("region", { name: "Jadwal ibadah" });
  await schedule.getByTestId("schedule-item").locator(".item-inspect").click();
  const slides = schedule.getByRole("list", { name: "Slide Expand song" });
  await expect(slides.getByRole("button")).toHaveCount(3);
  await slides.getByRole("button").nth(2).click();
  await expect(
    page.getByRole("listitem", { name: /^Preview slide 3:/ }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("region", { name: "Preview workspace" }),
  ).toContainText("Slide 3 of 3");
  await page
    .getByRole("button", { name: "Preview sebelumnya", exact: true })
    .click();
  await expect(
    page.getByRole("listitem", { name: /^Preview slide 2:/ }),
  ).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  const live = page.getByRole("region", { name: "LIVE projector control" });
  await expect(live).toContainText("Slide 2 of 3");
  await live.getByRole("listitem", { name: /^LIVE slide 3:/ }).click();
  await expect(
    live.getByRole("listitem", { name: /^LIVE slide 3:/ }),
  ).toHaveAttribute("aria-current", "true");
  await expect(live).toContainText("Slide 3 of 3");
  await live
    .getByRole("button", { name: "Slide sebelumnya LIVE", exact: true })
    .click();
  await expect(live).toContainText("Slide 2 of 3");
});

test("Presentations tab lists only PDF presentations and drags them into the Week", async ({
  page,
}) => {
  await openWeek(page, 1);
  await page.getByRole("tab", { name: "Presentations", exact: true }).click();
  await page.getByLabel("File presentasi", { exact: true }).setInputFiles({
    name: "khotbah.pdf",
    mimeType: "application/pdf",
    buffer: syntheticPDF(),
  });
  await expect(
    page.getByRole("button", { name: "Pilih media khotbah.pdf", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Media", exact: true }).click();
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await imageFile(page));
  await expect(
    page.getByRole("button", {
      name: "Pilih media synthetic.png",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pilih media khotbah.pdf", exact: true }),
  ).toBeVisible();
  // Category list replaces the old "Jenis media" select.
  await page.getByRole("button", { name: /^PDF/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Pilih media synthetic.png",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Semua media/ }).click();
  await page.getByRole("tab", { name: "Presentations", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pilih media khotbah.pdf", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Pilih media synthetic.png",
      exact: true,
    }),
  ).toHaveCount(0);
  await dragToWeek(mediaCard(page, "khotbah.pdf"));
  await expect(page.getByTestId("schedule-item")).toContainText("khotbah.pdf");
  await page
    .getByRole("button", { name: "Pilih media khotbah.pdf", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview media", exact: true })
    .click();
  await expect(
    page.getByRole("list", { name: "Daftar slide Preview" }),
  ).toBeVisible();
});

test("dropping a song before picking a Week fills Week 1", async ({ page }) => {
  await song(page, "First drop", ["Synthetic first drop line."]);
  await expect(activeSchedule(page)).toHaveText("Jadwal Ibadah - Week 1");
  await expect(page.getByTestId("week-drop-zone")).toContainText(
    "Tarik lagu dari Musik ke sini",
  );
  await dragToWeek(songRow(page, "First drop"));
  await expect(activeSchedule(page)).toHaveText("Jadwal Ibadah - Week 1");
  await expect(page.getByTestId("schedule-item")).toContainText("First drop");
  const playlists = page.getByRole("list", { name: "Playlist Jadwal" });
  await expect(
    playlists
      .getByRole("button", { name: /^Week 1 \d+$/ })
      .locator(".side-count"),
  ).toHaveText("1");
  await expect(playlists.getByRole("button")).toHaveCount(4);
});

test("a second tab is clearly read-only and can take over editing", async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.getByTestId("app-status")).toHaveText(/HANYA BACA/);
  const banner = second.getByTestId("readonly-banner");
  await expect(banner).toContainText("Tab ini hanya baca");
  await expect(
    second.getByRole("button", { name: "Live", exact: true }),
  ).toBeDisabled();
  await expect(
    second.getByRole("button", { name: "Go Live", exact: true }),
  ).toHaveAttribute("title", "Tab ini hanya baca");
  second.once("dialog", (d) => void d.accept());
  await banner
    .getByRole("button", { name: "Edit di tab ini", exact: true })
    .click();
  await expect(
    second.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
  await expect(second.getByTestId("app-status")).toHaveText(/READY/);
  await expect(page.getByTestId("app-status")).toHaveText(/HANYA BACA/);
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeDisabled();
});

test("a newly added song is highlighted in Musik and dragged into Jadwal Ibadah with the mouse", async ({
  page,
}) => {
  for (const title of [
    "Agung",
    "Bapa Engkau",
    "Damai",
    "Hosana",
    "Kasih Setia",
    "Mazmur 23",
  ])
    await song(page, title, [`${title} synthetic line.`]);
  await song(page, "Zaman Baru", ["Zaman Baru synthetic line."]);
  const fresh = songRow(page, "Zaman Baru");
  await expect(fresh).toHaveClass(/fresh/);
  await expect(fresh).toContainText("Baru · tarik ke jadwal");
  await expect(fresh).toBeInViewport();
  // Only the new song is highlighted.
  await expect(page.locator(".song-list > li.fresh")).toHaveCount(1);
  // Real mouse drag from the grip: the Jadwal Ibadah shows where to drop.
  const grip = await fresh.locator(".drag-grip").boundingBox();
  const zone = await page.getByTestId("week-drop-zone").boundingBox();
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip!.x + 20, grip!.y - 20, { steps: 4 });
  await page.mouse.move(zone!.x + zone!.width / 2, zone!.y + zone!.height / 2, {
    steps: 12,
  });
  await expect(page.locator(".drop-hint")).toHaveText("Lepas di sini → Week 1");
  await page.mouse.up();
  await expect(page.getByTestId("schedule-item")).toHaveCount(1);
  await expect(page.getByTestId("schedule-item")).toContainText("Zaman Baru");
  await expect(page.locator(".drop-hint")).toBeHidden();
  // A search that hides the next new song is cleared so it can be dragged.
  await page.getByLabel("Cari musik", { exact: true }).fill("Agung");
  await song(page, "Yesus Baik", ["Yesus Baik synthetic line."]);
  await expect(page.getByLabel("Cari musik", { exact: true })).toHaveValue("");
  await expect(songRow(page, "Yesus Baik")).toBeInViewport();
});
