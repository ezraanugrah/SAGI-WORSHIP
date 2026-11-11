import { test, expect, type Page } from "@playwright/test";
// "Alkitab bawaan": the bundled KJV (public/scriptures/kjv.json) installs
// through the normal import review; TB2 is listed as waiting for LAI permission.
const attestation =
  "Saya berhak menyimpan, memproyeksikan, dan membuat snapshot lokal dataset ini";
const builtins = (page: Page) =>
  page.getByRole("region", { name: "Alkitab bawaan" });
async function installKJV(page: Page) {
  await builtins(page)
    .getByRole("button", { name: "Pasang KJV", exact: true })
    .click();
  const review = page.getByRole("region", { name: "Impor dataset Alkitab" });
  await expect(review.getByRole("heading", { level: 3 }).last()).toHaveText(
    "King James Version · KJV",
    { timeout: 30000 },
  );
  await expect(review).toContainText("public-domain");
  await expect(review).toContainText("66 kitab · 31102 ayat");
  await expect(
    page.getByRole("button", { name: "Konfirmasi dan impor", exact: true }),
  ).toBeDisabled();
  await page.getByLabel(attestation).check();
  await page
    .getByRole("button", { name: "Konfirmasi dan impor", exact: true })
    .click();
  await expect(
    page.getByText("Dataset diimpor. Seluruh ayat tersimpan offline."),
  ).toBeVisible({ timeout: 60000 });
}
async function pick(page: Page, ref: string) {
  await page.getByLabel("Referensi ayat", { exact: true }).fill(ref);
  await page
    .getByRole("button", { name: "Cari referensi", exact: true })
    .click();
  await expect(page.getByText("1 ayat dipilih", { exact: true })).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
  await page.getByRole("tab", { name: /Scriptures/ }).click();
});

test("install the full KJV, browse Genesis to Revelation with Indonesian or English names, and show a verse live", async ({
  page,
}) => {
  test.setTimeout(120000);
  await expect(page.getByText("Belum ada dataset Alkitab")).toBeVisible();
  const tb2 = builtins(page).getByRole("listitem").filter({ hasText: "TB2" });
  await expect(tb2).toContainText("Alkitab Terjemahan Baru Edisi Kedua");
  await expect(tb2).toContainText("Perlu izin LAI");
  await expect(tb2.getByRole("button")).toHaveCount(0);

  await installKJV(page);
  await expect(
    builtins(page).getByRole("button", { name: "Sedang dibuka", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Terjemahan", { exact: true })).toContainText(
    "King James Version · KJV (1769)",
  );
  const books = page.getByLabel("Kitab", { exact: true }).locator("option");
  await expect(books).toHaveCount(66);
  await expect(books.first()).toHaveText("Genesis");
  await expect(books.last()).toHaveText("Revelation");

  await pick(page, "Yoh 3:16");
  await expect(page.getByLabel("Kitab", { exact: true })).toHaveValue("John");
  await expect(page.getByRole("list", { name: "Daftar ayat" })).toContainText(
    "For God so loved the world",
  );
  await page
    .getByRole("button", { name: "Kosongkan pilihan", exact: true })
    .click();
  await pick(page, "Wahyu 22:21");
  await expect(page.getByRole("list", { name: "Daftar ayat" })).toContainText(
    "The grace of our Lord Jesus Christ be with you all. Amen.",
  );
  await page
    .getByRole("button", { name: "Kosongkan pilihan", exact: true })
    .click();
  await pick(page, "Mzm 23:1");

  await page.getByRole("button", { name: "Preview ayat", exact: true }).click();
  const pending = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  const projector = await pending;
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(projector.locator(".slide-lines")).toHaveText(
    "A Psalm of David. The LORD is my shepherd; I shall not want.",
  );
  await expect(projector.locator(".scripture-footer")).toContainText(
    "Psalms 23:1 · KJV · 1769",
  );
  await expect(projector.locator(".scripture-footer")).toContainText(
    "Public Domain",
  );

  // Still installed after a reload; the button no longer offers to install.
  await page.reload();
  await page.getByRole("tab", { name: /Scriptures/ }).click();
  await expect(
    builtins(page).getByRole("button", { name: "Sedang dibuka", exact: true }),
  ).toBeVisible();
  await expect(
    builtins(page).getByRole("button", { name: "Pasang KJV", exact: true }),
  ).toHaveCount(0);
});

test("a failed download shows a clear message and changes nothing", async ({
  page,
}) => {
  await page.route("**/scriptures/kjv.json", (route) =>
    route.fulfill({ status: 503, body: "" }),
  );
  await builtins(page)
    .getByRole("button", { name: "Pasang KJV", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Gagal mengunduh KJV (HTTP 503)",
  );
  await expect(page.getByText("Belum ada dataset Alkitab")).toBeVisible();
  await expect(
    builtins(page).getByRole("button", { name: "Pasang KJV", exact: true }),
  ).toBeEnabled();
});
