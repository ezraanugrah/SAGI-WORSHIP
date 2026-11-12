import { test, expect, type Page } from "@playwright/test";
import { previewPosition } from "./previewHelpers";
// Musik › Susun Otomatis: title, author and the whole lyrics in; the parts
// are found from the labels (or guessed), checked, then saved. No AI.
const LYRICS = `Verse 1
Tuhanku maha besar
Tuhanku maha kuasa
Raja segala raja.

Verse 2
Dia takkan tergoyahkan
Dia takkan terkalahkan
Dia hidup dan berkuasa

Pre-Chorus
Serukan nama Nya
Yesus Tuhan Raja

Chorus
Segala kuasa tunduk dalam nama Nya
Dia luar biasa perkasa mulia
Yesus nama diatas segala nama`;

const panel = (page: Page) =>
  page.getByRole("region", { name: "Susun Otomatis" });
async function openPanel(page: Page) {
  await page
    .getByRole("button", { name: "Susun Otomatis", exact: true })
    .click();
  await expect(panel(page)).toBeVisible();
}
const parts = (page: Page) => panel(page).getByTestId("arranged-part");
const order = (page: Page) => panel(page).getByTestId("arranged-order");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});

test("labelled lyrics become Verse 1, Verse 2, Pre Chorus, Chorus; checked, saved, reopened and presented", async ({
  page,
}) => {
  await openPanel(page);
  const p = panel(page);
  await p.getByLabel("Judul lagu", { exact: true }).fill("Serukan NamaNya");
  await p
    .getByLabel("Penyanyi / pencipta", { exact: true })
    .fill("True Worshippers");
  await p.getByLabel("Lirik lengkap", { exact: true }).fill(LYRICS);
  // Nothing is saved before the operator checks the result.
  await expect(
    p.getByRole("button", { name: "Simpan ke Song Library" }),
  ).toHaveCount(0);
  await p.getByRole("button", { name: "Susun Otomatis", exact: true }).click();
  await expect(p.getByRole("status")).toHaveText(
    "4 bagian dari label di lirik.",
  );
  await expect(parts(page)).toHaveCount(4);
  for (const [i, label] of [
    "Verse 1",
    "Verse 2",
    "Pre Chorus",
    "Chorus",
  ].entries())
    await expect(p.getByLabel(`Label hasil ${i + 1}`)).toHaveValue(label);
  await expect(p.getByLabel("Lirik hasil 1")).toHaveValue(
    "Tuhanku maha besar\nTuhanku maha kuasa\nRaja segala raja.",
  );
  await expect(p.getByLabel("Lirik hasil 4")).toHaveValue(
    "Segala kuasa tunduk dalam nama Nya\nDia luar biasa perkasa mulia\nYesus nama diatas segala nama",
  );
  await expect(p.getByText("Perlu dicek", { exact: true })).toHaveCount(0);
  await expect(order(page)).toHaveCount(4);

  // Corrections: the Chorus once more at the end, Verse 2 renamed and back.
  await p
    .getByLabel("Tambah ke urutan hasil")
    .selectOption({ label: "Chorus" });
  await expect(order(page)).toHaveCount(5);
  await expect(order(page).last()).toContainText("5. Chorus");
  await p.getByLabel("Label hasil 2").selectOption("Verse 3");
  await expect(order(page).nth(1)).toContainText("Verse 3");
  await p.getByLabel("Label hasil 2").selectOption("Verse 2");
  await page.screenshot({
    path: test.info().outputPath("auto-arrange.png"),
  });
  await p.getByLabel("Lirik hasil 3").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath("auto-arrange-parts.png"),
  });

  await p.getByRole("button", { name: "Simpan ke Song Library" }).click();
  await expect(panel(page)).toHaveCount(0);
  const row = page
    .getByTestId("song-row")
    .filter({ hasText: "Serukan NamaNya" });
  await expect(row).toContainText("True Worshippers · 4 bagian");

  // Reopened in the song editor: same parts, Chorus stored once, shown twice.
  await page
    .getByRole("button", { name: "Edit Serukan NamaNya", exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  for (const [i, label] of [
    "Verse 1",
    "Verse 2",
    "Pre Chorus",
    "Chorus",
  ].entries())
    await expect(editor.getByLabel(`Jenis bagian ${i + 1}`)).toHaveValue(label);
  await expect(editor.getByLabel("Lirik bagian 3")).toHaveValue(
    "Serukan nama Nya\nYesus Tuhan Raja",
  );
  await expect(editor.getByTestId("section-order-item")).toHaveCount(5);
  await editor.getByRole("button", { name: "Tutup editor" }).click();
  await expect(editor).toHaveCount(0);

  // Presented like any song: one slide per part in the order.
  await row.getByRole("button").first().click();
  await expect(previewPosition(page)).toHaveText("Slide 1 of 5");
  const live = page.getByRole("region", { name: "LIVE projector control" });
  await expect(live).toContainText("Tuhanku maha besar");

  // Reload: still in the library.
  await page.reload();
  await expect(
    page.getByTestId("song-row").filter({ hasText: "Serukan NamaNya" }),
  ).toHaveCount(1);
});

test("lyrics without labels are guessed from blank lines and repeats, marked to check, and the manual song editor still works", async ({
  page,
}) => {
  await openPanel(page);
  const p = panel(page);
  await p.getByLabel("Judul lagu", { exact: true }).fill("Lagu Tanpa Label");
  await p
    .getByLabel("Lirik lengkap", { exact: true })
    .fill(
      [
        "Bait pertama baris satu\nBait pertama baris dua",
        "Engkau layak dipuji\nEngkau layak disembah",
        "Bait kedua baris satu\nBait kedua baris dua",
        "Engkau layak dipuji\nEngkau layak disembah",
      ].join("\n\n"),
    );
  await p.getByRole("button", { name: "Susun Otomatis", exact: true }).click();
  await expect(p.getByRole("status")).toContainText("Sebagian diperkirakan");
  await expect(parts(page)).toHaveCount(3);
  await expect(p.getByLabel("Label hasil 2")).toHaveValue("Chorus");
  await expect(p.getByText("Perlu dicek", { exact: true })).toHaveCount(3);
  await expect(order(page)).toHaveText([
    /1\. Verse 1/,
    /2\. Chorus/,
    /3\. Verse 2/,
    /4\. Chorus/,
  ]);
  // Choosing a label clears the mark.
  await p.getByLabel("Label hasil 1").selectOption("Verse 1");
  await expect(p.getByText("Perlu dicek", { exact: true })).toHaveCount(2);
  // Empty lyrics say so.
  await p.getByLabel("Lirik lengkap", { exact: true }).fill("   ");
  await expect(
    p.getByRole("button", { name: "Susun Otomatis", exact: true }),
  ).toBeDisabled();
  page.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "Tutup Susun Otomatis" }).click();
  await expect(panel(page)).toHaveCount(0);

  // "Tambah lagu" (manual) is unchanged.
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor.getByLabel("Judul lagu", { exact: true }).fill("Manual");
  await editor
    .getByLabel("Lirik bagian 1", { exact: true })
    .fill("Baris manual");
  await editor
    .getByRole("button", { name: "Simpan sekarang", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByTestId("song-row").filter({ hasText: "Manual" }),
  ).toHaveCount(1);
});
