import { test, expect, type Page } from "@playwright/test";
import { activeSchedule, dragToWeek, openWeek } from "./dragHelpers";
const lyric =
  "Original software test line.\nA second line written for this test.";
async function createSong(page: Page, title: string) {
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor.getByLabel("Judul lagu", { exact: true }).fill(title);
  await editor.getByLabel("Lirik bagian 1", { exact: true }).fill(lyric);
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor
    .getByRole("button", { name: "Simpan sekarang", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  return row(page, title);
}
function row(page: Page, title: string) {
  return page.getByTestId("song-row").filter({
    has: page.getByRole("button", { name: `Edit ${title}`, exact: true }),
  });
}
function playlists(page: Page) {
  return page.getByRole("list", { name: "Playlist Jadwal" });
}
async function confirmNext(page: Page, accept = true) {
  page.once("dialog", (dialog) =>
    accept ? dialog.accept() : dialog.dismiss(),
  );
}
async function readStore(page: Page, store: string) {
  return page.evaluate(async (store) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("sagi-worship", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise<unknown[]>((resolve, reject) => {
        const req = db.transaction(store).objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }, store);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});
test("songs create/edit/search/duplicate/delete and reload persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createSong(page, "Morning rehearsal");
  await page.reload();
  await expect(row(page, "Morning rehearsal")).toBeVisible();
  await page.getByLabel("Cari musik").fill("SECOND LINE");
  await expect(row(page, "Morning rehearsal")).toHaveCount(1);
  await page.getByLabel("Cari musik").fill("absent query");
  await expect(page.getByTestId("song-row")).toHaveCount(0);
  await page.getByLabel("Cari musik").fill("");
  await page
    .getByRole("button", { name: "Edit Morning rehearsal", exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor
    .getByLabel("Judul lagu", { exact: true })
    .fill("Evening rehearsal");
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor
    .getByRole("button", { name: "Simpan sekarang", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Duplikasi Evening rehearsal", exact: true })
    .click();
  await expect(row(page, "Evening rehearsal (salinan)")).toHaveCount(1);
  await confirmNext(page, false);
  await page
    .getByRole("button", { name: "Hapus lagu Evening rehearsal", exact: true })
    .click();
  await expect(row(page, "Evening rehearsal")).toHaveCount(1);
  await confirmNext(page);
  await page
    .getByRole("button", { name: "Hapus lagu Evening rehearsal", exact: true })
    .click();
  await expect(row(page, "Evening rehearsal")).toHaveCount(0);
  await page.reload();
  await expect(row(page, "Evening rehearsal (salinan)")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("all section types, keyboard and drag ordering survive reload", async ({
  page,
}) => {
  await createSong(page, "Sections rehearsal");
  await page
    .getByRole("button", { name: "Edit Sections rehearsal", exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  for (let i = 2; i <= 5; i++) {
    await editor
      .getByRole("button", { name: "Tambah bagian", exact: true })
      .click();
    await editor
      .getByLabel(`Jenis bagian ${i}`, { exact: true })
      .selectOption(["Verse 2", "Pre Chorus", "Chorus", "Bridge"][i - 2]);
    await editor
      .getByLabel(`Lirik bagian ${i}`, { exact: true })
      .fill(`Original section ${i} for testing.`);
  }
  await editor
    .getByLabel("Jenis bagian 1", { exact: true })
    .selectOption("Intro");
  // No "Tambahkan ke urutan": the order lists each part once.
  await expect(editor.getByLabel("Tambahkan ke urutan")).toHaveCount(0);
  await expect(editor.getByTestId("section-order-item")).toHaveCount(5);
  await editor
    .getByRole("button", { name: "Turunkan bagian urutan 1", exact: true })
    .click();
  await expect(editor.getByTestId("section-order-item").first()).toContainText(
    "Verse 2",
  );
  await editor
    .getByTestId("section-order-item")
    .first()
    .dragTo(editor.getByTestId("section-order-item").nth(2));
  await expect(editor.getByTestId("section-order-item").nth(2)).toContainText(
    "Verse 2",
  );
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor
    .getByRole("button", { name: "Simpan sekarang", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Edit Sections rehearsal", exact: true })
    .click();
  await expect(page.getByTestId("section-order-item")).toHaveCount(5);
  expect((await readStore(page, "song_sections")).length).toBe(5);
});
test("Week 1–4 playlists switch, persist, clear and remove items without touching songs", async ({
  page,
}) => {
  await createSong(page, "Schedule composition");
  // Only Week 1–4 are offered; there is no free-form playlist creation.
  await expect(playlists(page).getByRole("button")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "New playlist" })).toHaveCount(
    0,
  );
  await expect(activeSchedule(page)).toHaveText("Jadwal Ibadah - Week 1");
  await openWeek(page, 2);
  await dragToWeek(row(page, "Schedule composition"));
  await dragToWeek(row(page, "Schedule composition"));
  await expect(
    playlists(page)
      .getByRole("button", { name: /^Week 2 \d+$/ })
      .locator(".side-count"),
  ).toHaveText("2");
  await openWeek(page, 1);
  await expect(page.getByTestId("schedule-item")).toHaveCount(0);
  await openWeek(page, 2);
  await page.reload();
  await expect(activeSchedule(page)).toHaveText("Jadwal Ibadah - Week 2");
  await expect(page.getByTestId("schedule-item")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Hapus item 1 dari jadwal", exact: true })
    .click();
  await expect(page.getByTestId("schedule-item")).toHaveCount(1);
  await expect(row(page, "Schedule composition")).toHaveCount(1);
  await confirmNext(page, false);
  await page
    .getByRole("button", { name: "Kosongkan jadwal", exact: true })
    .click();
  await expect(page.getByTestId("schedule-item")).toHaveCount(1);
  await confirmNext(page);
  await page
    .getByRole("button", { name: "Kosongkan jadwal", exact: true })
    .click();
  await expect(page.getByTestId("schedule-item")).toHaveCount(0);
  await expect(activeSchedule(page)).toHaveText("Jadwal Ibadah - Week 2");
  await expect(row(page, "Schedule composition")).toHaveCount(1);
  await expect(playlists(page).getByRole("button")).toHaveCount(4);
});
test("schedule drag ordering and keyboard alternative persist", async ({
  page,
}) => {
  for (const title of ["Alpha rehearsal", "Beta rehearsal", "Gamma rehearsal"])
    await createSong(page, title);
  await openWeek(page, 1);
  for (const title of [
    "Alpha rehearsal",
    "Beta rehearsal",
    "Gamma rehearsal",
  ]) {
    await dragToWeek(row(page, title));
    await expect(page.getByTestId("schedule-item")).toHaveCount(
      ["Alpha rehearsal", "Beta rehearsal", "Gamma rehearsal"].indexOf(title) +
        1,
    );
  }
  const items = page.getByTestId("schedule-item");
  await items.nth(0).dragTo(items.nth(2));
  await expect(items.nth(0)).toContainText("Beta rehearsal");
  await expect(items.nth(2)).toContainText("Alpha rehearsal");
  const up = page.getByRole("button", { name: "Naikkan item 3", exact: true });
  await up.focus();
  await page.keyboard.press("Enter");
  await expect(items.nth(1)).toContainText("Alpha rehearsal");
  await expect(
    page.getByRole("button", { name: "Naikkan item 2", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(items.nth(1)).toContainText("Alpha rehearsal");
});
test("deleting a referenced song cleans all schedule references after explicit confirmation", async ({
  page,
}) => {
  await createSong(page, "Referenced composition");
  await openWeek(page, 1);
  await dragToWeek(row(page, "Referenced composition"));
  await expect(page.getByTestId("schedule-item")).toHaveCount(1);
  await openWeek(page, 2);
  await dragToWeek(row(page, "Referenced composition"));
  await expect(page.getByTestId("schedule-item")).toHaveCount(1);
  await confirmNext(page);
  await page
    .getByRole("button", {
      name: "Hapus lagu Referenced composition",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("song-row")).toHaveCount(0);
  await expect(page.getByTestId("schedule-item")).toHaveCount(0);
  expect(await readStore(page, "schedule_items")).toEqual([]);
  expect(await readStore(page, "song_sections")).toEqual([]);
});
test("invalid edits preserve canonical songs and drafts recover after reload", async ({
  page,
}) => {
  await createSong(page, "Valid composition");
  await page
    .getByRole("button", { name: "Edit Valid composition", exact: true })
    .click();
  let editor = page.getByRole("region", { name: "Editor lagu" });
  await editor.getByLabel("Judul lagu", { exact: true }).fill("");
  await expect(editor.getByRole("status")).toContainText("Draft tersimpan");
  await page.reload();
  await expect(row(page, "Valid composition")).toHaveCount(1);
  await page.getByRole("button", { name: "Buka draft", exact: true }).click();
  editor = page.getByRole("region", { name: "Editor lagu" });
  await expect(editor.getByLabel("Judul lagu", { exact: true })).toHaveValue(
    "",
  );
  await editor
    .getByLabel("Judul lagu", { exact: true })
    .fill("Recovered composition");
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor
    .getByRole("button", { name: "Simpan sekarang", exact: true })
    .click();
  await expect(row(page, "Recovered composition")).toHaveCount(1);
  expect(await readStore(page, "settings")).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ kind: "song-draft" })]),
  );
});
test("secondary tabs are read-only and regain writing only after owner closes and reload", async ({
  page,
  context,
}) => {
  await createSong(page, "Read only composition");
  await openWeek(page, 1);
  const secondary = await context.newPage();
  await secondary.goto("/");
  await expect(
    secondary.getByText(/Workspace sedang diedit pada tab lain/),
  ).toBeVisible();
  await expect(
    secondary.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeDisabled();
  await expect(
    secondary.getByRole("button", {
      name: "Edit Read only composition",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    playlists(secondary).getByRole("button", { name: /^Week 1 \d+$/ }),
  ).toBeDisabled();
  await expect(
    secondary.getByRole("button", { name: "Kosongkan jadwal", exact: true }),
  ).toBeDisabled();
  await secondary.getByLabel("Cari musik").fill("read only");
  await expect(row(secondary, "Read only composition")).toHaveCount(1);
  await secondary
    .getByRole("link", { name: "Pengaturan", exact: true })
    .click();
  await expect(secondary.getByLabel("Font", { exact: true })).toBeDisabled();
  await page.close();
  await secondary.reload();
  await expect(secondary.getByLabel("Font", { exact: true })).toBeEnabled();
});
test("lock stealing revokes the original editor and cancels future autosaves", async ({
  page,
  context,
}) => {
  await createSong(page, "Authority composition");
  await page
    .getByRole("button", { name: "Edit Authority composition", exact: true })
    .click();
  const secondary = await context.newPage();
  await secondary.goto("/");
  await secondary.evaluate(() => {
    void navigator.locks.request(
      "sagi-workspace-writer",
      { steal: true },
      () => new Promise<void>(() => {}),
    );
  });
  await expect(page.getByText(/Kepemilikan Web Lock hilang/)).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Editor lagu" })
      .getByLabel("Judul lagu", { exact: true }),
  ).toBeDisabled();
  expect(await readStore(page, "songs")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ title: "Authority composition", revision: 1 }),
    ]),
  );
});
test("malformed data is reported and preserved alongside usable healthy songs", async ({
  page,
}) => {
  await createSong(page, "Healthy composition");
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("sagi-worship", 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["songs", "settings"], "readwrite");
      tx.objectStore("songs").put({ id: "corrupt-record", title: 42 });
      tx.objectStore("settings").put({
        id: "phase2:draft:song:bad",
        kind: "bad",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByText(/Lagu corrupt-record rusak/)).toBeVisible();
  await expect(row(page, "Healthy composition")).toHaveCount(1);
  expect(await readStore(page, "songs")).toEqual(
    expect.arrayContaining([{ id: "corrupt-record", title: 42 }]),
  );
});
test("production shell, song edits, schedules and ordering persist fully offline", async ({
  page,
  context,
}) => {
  await createSong(page, "Offline composition");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByText("Shell offline siap", { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(row(page, "Offline composition")).toHaveCount(1);
  await expect(page.getByText("Tanpa internet", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Offline composition", exact: true })
    .click();
  const offlineEditor = page.getByRole("region", { name: "Editor lagu" });
  await offlineEditor
    .getByLabel("Lirik bagian 1", { exact: true })
    .fill("Original lyric edited while offline.");
  await expect(offlineEditor.getByRole("status")).toHaveText("Tersimpan lokal");
  await offlineEditor
    .getByRole("button", { name: "Simpan sekarang", exact: true })
    .click();
  await createSong(page, "Offline new composition");
  await openWeek(page, 1);
  await dragToWeek(row(page, "Offline composition"));
  await expect(page.getByTestId("schedule-item")).toHaveCount(1);
  await dragToWeek(row(page, "Offline new composition"));
  await expect(page.getByTestId("schedule-item")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Naikkan item 2", exact: true })
    .click();
  await expect(page.getByTestId("schedule-item").first()).toContainText(
    "Offline new composition",
  );
  await page.reload();
  await expect(page.getByTestId("schedule-item").first()).toContainText(
    "Offline new composition",
  );
  await expect(row(page, "Offline new composition")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Go Live", exact: true }),
  ).toBeDisabled();
});
for (const width of [320, 768, 1440])
  test(`responsive song editor and schedule at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await createSong(
      page,
      "Responsive composition with a reasonably long title",
    );
    await openWeek(page, 1);
    await dragToWeek(
      row(page, "Responsive composition with a reasonably long title"),
    );
    await expect(page.getByTestId("schedule-item")).toHaveCount(1);
    await page
      .getByRole("button", {
        name: "Edit Responsive composition with a reasonably long title",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("region", { name: "Editor lagu" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/responsive-${width}.png`,
      fullPage: true,
    });
    if (width === 1440) {
      await page
        .getByRole("region", { name: "Editor lagu" })
        .getByRole("button", { name: "Simpan sekarang", exact: true })
        .click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: "test-results/dashboard-1440.png",
        fullPage: true,
      });
    }
  });

test("failed canonical autosave preserves a durable draft and retries safely", async ({
  page,
}) => {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as unknown as { restoreWrites: () => void }).restoreWrites = () => {
      IDBObjectStore.prototype.put = original;
    };
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "songs")
        throw new DOMException(
          "Simulated storage quota failure",
          "QuotaExceededError",
        );
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor
    .getByLabel("Judul lagu", { exact: true })
    .fill("Retry composition");
  await editor.getByLabel("Lirik bagian 1", { exact: true }).fill(lyric);
  await expect(editor.getByRole("status")).toContainText("Gagal menyimpan");
  expect(await readStore(page, "songs")).toEqual([]);
  expect(await readStore(page, "settings")).toEqual(
    expect.arrayContaining([expect.objectContaining({ kind: "song-draft" })]),
  );
  await page.evaluate(() =>
    (window as unknown as { restoreWrites: () => void }).restoreWrites(),
  );
  // "Coba simpan lagi" saves the song and closes the editor.
  await editor
    .getByRole("button", { name: "Coba simpan lagi", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(row(page, "Retry composition")).toHaveCount(1);
});

test("Phase 1 preference records survive song and schedule operations", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("sagi-worship", 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["settings", "themes"], "readwrite");
      tx.objectStore("settings").put({
        id: "preferences",
        value: {
          font: "Georgia",
          fontSize: 72,
          safeMargin: 10,
          loopPreview: true,
          loopLive: false,
          muted: false,
          volume: 45,
          theme: "ocean",
        },
        updatedAt: "2026-10-31T00:00:00.000Z",
      });
      tx.objectStore("themes").put({
        id: "legacy-theme",
        name: "Retained custom theme",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await createSong(page, "Compatibility composition");
  await openWeek(page, 1);
  const preferences = (await readStore(page, "settings")).find(
    (value) => (value as { id: string }).id === "preferences",
  );
  expect(preferences).toMatchObject({
    value: { font: "Georgia", fontSize: 72, theme: "ocean", volume: 45 },
  });
  expect(await readStore(page, "themes")).toEqual([
    { id: "legacy-theme", name: "Retained custom theme" },
  ]);
  await page.getByRole("link", { name: "Pengaturan", exact: true }).click();
  await expect(page.getByLabel("Font", { exact: true })).toHaveValue("Georgia");
  await expect(
    page.getByRole("button", { name: "Ocean", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
