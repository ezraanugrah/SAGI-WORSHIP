import { test, expect, type Page } from "@playwright/test";
import { previewPosition } from "./previewHelpers";
import { APPLY_THEME, createTheme } from "./themeHelpers";
// Scriptures tab: the two-language Bible (AYT left, KJV right) installed
// from public/scriptures, picked by book / chapter / verse range.
const bible = (page: Page) =>
  page.getByRole("region", { name: "Alkitab / Bible" });
const rows = (page: Page) =>
  page.getByRole("table", { name: "Ayat dua bahasa" }).getByRole("row");
async function scriptures(page: Page) {
  await page.getByRole("tab", { name: /Scriptures/ }).click();
}
async function install(page: Page) {
  await scriptures(page);
  const install = bible(page).getByRole("button", {
    name: "Pasang Alkitab",
    exact: true,
  });
  await expect(install).toBeDisabled();
  await bible(page)
    .getByLabel(/ibadah non-komersial/)
    .check();
  await install.click();
  await expect(page.getByLabel("Kitab", { exact: true })).toBeVisible({
    timeout: 90000,
  });
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});

test("install the two-language Bible, pick Kejadian 1:3-10 and show Indonesian left, English right", async ({
  page,
}) => {
  test.setTimeout(180000);
  await scriptures(page);
  await expect(bible(page)).toContainText("Alkitab Yang Terbuka (AYT)");
  await expect(bible(page)).toContainText("King James Version (KJV, 1769)");
  await install(page);

  await page.getByLabel("Kitab", { exact: true }).selectOption("Gen");
  await page.getByLabel("Pasal", { exact: true }).selectOption("1");
  await page.getByLabel("Ayat dari", { exact: true }).selectOption("3");
  await page.getByLabel("Ayat sampai", { exact: true }).selectOption("10");
  await expect(rows(page)).toHaveCount(9); // header + 8 verses
  const first = rows(page).nth(1).getByRole("cell");
  await expect(first.nth(0)).toHaveText("1:3");
  await expect(first.nth(1)).toHaveText(
    "Kemudian, Allah berfirman, “Jadilah terang.” Lalu, terang itu jadi.",
  );
  await expect(first.nth(2)).toHaveText(
    "And God said, Let there be light: and there was light.",
  );
  await expect(rows(page).last().getByRole("cell").first()).toHaveText("1:10");
  await expect(bible(page)).toContainText("Kejadian 1:3–10 · Genesis 1:3–10");
  await page.screenshot({
    path: test.info().outputPath("bible-tab.png"),
    fullPage: true,
  });

  await bible(page)
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  // The eight verses of Kejadian 1:3–10 share as few slides as possible,
  // each numbered: two with the bundled default font Montserrat (it is wider
  // than the old Arial; the bundled font measures the same on every laptop).
  const preview = page.getByRole("region", { name: "Preview workspace" });
  await expect(previewPosition(page)).toHaveText("Slide 1 of 2");
  await expect(
    preview.locator('.slide-column[data-column="left"]').first(),
  ).toContainText(
    /³\s?Kemudian, Allah berfirman, “Jadilah terang\.”.*⁴\s?Allah melihat/,
  );
  await expect(
    preview.locator('.slide-column[data-column="right"]').first(),
  ).toContainText(
    /³\s?And God said, Let there be light.*⁴\s?And God saw the light/,
  );

  const pending = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  const projector = await pending;
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(
    projector.locator('.slide-column[data-column="left"]'),
  ).toContainText(/³\s?Kemudian, Allah berfirman/);
  await expect(
    projector.locator('.slide-column[data-column="right"]'),
  ).toContainText(/³\s?And God said, Let there be light/);
  const footer = projector.locator(".scripture-footer");
  // Slide 1 of 2 holds verses 3–6 (the range is split evenly).
  await expect(footer).toContainText("Kejadian 1:3–6 · AYT · 2024");
  await expect(footer).toContainText("Genesis 1:3–6 · KJV · 1769");
  await expect(footer).toContainText(
    "AYT © YLSA · CC BY-NC-SA · Public Domain",
  );
  // Left column sits left of the right column on the audience screen.
  const left = await projector
    .locator('.slide-column[data-column="left"]')
    .boundingBox();
  const right = await projector
    .locator('.slide-column[data-column="right"]')
    .boundingBox();
  expect(left!.x + left!.width).toBeLessThan(right!.x);
  await projector.screenshot({
    path: test.info().outputPath("bible-projector.png"),
  });
});

test("Preview shows the whole picked range together: Bilangan 4:4–7 on one slide", async ({
  page,
}) => {
  test.setTimeout(180000);
  await install(page);
  await page.getByLabel("Kitab", { exact: true }).selectOption("Num");
  await page.getByLabel("Pasal", { exact: true }).selectOption("4");
  await page.getByLabel("Ayat dari", { exact: true }).selectOption("4");
  await page.getByLabel("Ayat sampai", { exact: true }).selectOption("7");
  await bible(page)
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await expect(previewPosition(page)).toHaveText("Slide 1 of 1");
  const preview = page.getByRole("region", { name: "Preview workspace" });
  for (const column of ["left", "right"])
    await expect(
      preview.locator(`.slide-column[data-column="${column}"]`),
    ).toContainText(/⁴.*⁵.*⁶.*⁷/);
  await expect(preview.locator(".scripture-footer")).toContainText(
    "Bilangan 4:4–7 · AYT · 2024",
  );
  await expect(preview.locator(".scripture-footer")).toContainText(
    "Numbers 4:4–7 · KJV · 1769",
  );
  await page.screenshot({
    path: test.info().outputPath("bible-range.png"),
  });

  // A long range spreads over several slides; the next one carries on.
  await page.getByLabel("Cari ayat", { exact: true }).fill("Mzm 119:1-40");
  await page.getByRole("button", { name: "Pilih", exact: true }).click();
  await bible(page)
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await expect(previewPosition(page)).toHaveText(/^Slide 1 of ([2-9]|\d\d)$/);
  const footer = preview.locator(".scripture-footer");
  await expect(footer).toContainText(/Mazmur 119:1–(\d+) · AYT/);
  const end = Number(
    (await footer.innerText()).match(/Mazmur 119:1–(\d+)/)![1],
  );
  await page
    .getByRole("button", { name: "Preview berikutnya", exact: true })
    .click();
  await expect(footer).toContainText(`Mazmur 119:${end + 1}`);
});

test("quick search in either language, add to the Week, and stay installed after reload", async ({
  page,
}) => {
  test.setTimeout(180000);
  await install(page);
  for (const [query, chapter, from, to] of [
    ["Yoh 3:16", "3", "16", "16"],
    ["Psalm 23:1-6", "23", "1", "6"],
  ]) {
    await page.getByLabel("Cari ayat", { exact: true }).fill(query);
    await page.getByRole("button", { name: "Pilih", exact: true }).click();
    await expect(page.getByLabel("Pasal", { exact: true })).toHaveValue(
      chapter,
    );
    await expect(page.getByLabel("Ayat dari", { exact: true })).toHaveValue(
      from,
    );
    await expect(page.getByLabel("Ayat sampai", { exact: true })).toHaveValue(
      to,
    );
  }
  await expect(rows(page)).toHaveCount(7);
  await expect(rows(page).nth(1)).toContainText("TUHAN adalah gembalaku");
  await expect(rows(page).nth(1)).toContainText(
    "The LORD is my shepherd; I shall not want.",
  );
  await page.getByLabel("Cari ayat", { exact: true }).fill("Yoh 3:16, 18");
  await page.getByRole("button", { name: "Pilih", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("satu rentang");

  // No Week picked yet: the verse goes to Week 1, like a dropped song.
  await page.getByLabel("Cari ayat", { exact: true }).fill("Yoh 3:16");
  await page.getByRole("button", { name: "Pilih", exact: true }).click();
  await bible(page)
    .getByRole("button", { name: "Tambahkan ke jadwal", exact: true })
    .click();
  await expect(page.getByTestId("schedule-item")).toHaveCount(1);
  await expect(page.getByTestId("schedule-item")).toContainText("Yohanes 3:16");
  await expect(
    page.getByText("Yohanes 3:16 ditambahkan ke Week 1."),
  ).toBeVisible();

  await page.reload();
  await scriptures(page);
  await expect(page.getByLabel("Kitab", { exact: true })).toBeVisible();
  await expect(
    bible(page).getByRole("button", { name: "Pasang Alkitab" }),
  ).toHaveCount(0);
});

test("a failed download explains itself and leaves the Bible uninstalled", async ({
  page,
}) => {
  await page.route("**/scriptures/ayt.json", (route) =>
    route.fulfill({ status: 503, body: "" }),
  );
  await scriptures(page);
  await bible(page)
    .getByLabel(/ibadah non-komersial/)
    .check();
  await bible(page)
    .getByRole("button", { name: "Pasang Alkitab", exact: true })
    .click();
  await expect(bible(page).getByRole("alert")).toContainText("HTTP 503");
  await expect(
    bible(page).getByRole("button", { name: "Pasang Alkitab", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Kitab", { exact: true })).toHaveCount(0);
});

test("a theme keeps the two columns and both references", async ({ page }) => {
  test.setTimeout(180000);
  await install(page);
  await page.getByLabel("Cari ayat", { exact: true }).fill("Kej 1:3");
  await page.getByRole("button", { name: "Pilih", exact: true }).click();
  await bible(page)
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await createTheme(page, "Ibadah");
  await page.getByRole("button", { name: APPLY_THEME, exact: true }).click();
  const preview = page.getByRole("region", { name: "Preview workspace" });
  await expect(preview.locator(".themed-lines.slide-columns")).toBeVisible();
  await expect(
    preview.locator('.slide-column[data-column="right"]'),
  ).toHaveText("And God said, Let there be light: and there was light.");
  const pending = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  const projector = await pending;
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(
    projector.locator('.themed-lines .slide-column[data-column="left"]'),
  ).toHaveText(
    "Kemudian, Allah berfirman, “Jadilah terang.” Lalu, terang itu jadi.",
  );
  await expect(projector.locator(".themed-footer")).toContainText(
    "Genesis 1:3 · KJV · 1769",
  );
  await projector.screenshot({
    path: test.info().outputPath("bible-themed.png"),
  });
});
