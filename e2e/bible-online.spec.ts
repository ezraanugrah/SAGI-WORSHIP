import { test, expect, type Page, type Route } from "@playwright/test";
// TB2 (LAI Bible API) and ESV (ESV API) columns, with both APIs mocked by
// synthetic text so no real key or publisher text is involved.
const bible = (page: Page) =>
  page.getByRole("region", { name: "Alkitab / Bible" });
const rows = (page: Page) =>
  page.getByRole("table", { name: "Ayat dua bahasa" }).getByRole("row");
type Seen = { url: string; auth: string | undefined };
async function mockApis(page: Page) {
  const seen = { esv: [] as Seen[], lai: [] as Seen[] };
  await page.route("https://api.esv.org/**", (route: Route) => {
    const url = route.request().url();
    seen.esv.push({ url, auth: route.request().headers().authorization });
    const [a, b] = new URL(url).searchParams
      .get("q")!
      .split("-")
      .map((id) => Number(id.slice(-3)));
    const text = Array.from(
      { length: b - a + 1 },
      (_, i) => `[${a + i}] ESV test verse ${a + i}.`,
    ).join("\n\n");
    return route.fulfill({
      json: { passages: [text] },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.route("https://bible-api.alkitab.or.id/**", (route: Route) => {
    const url = route.request().url();
    seen.lai.push({ url, auth: route.request().headers().authorization });
    const [a, b = a] = url.split("/").pop()!.split("-").map(Number);
    return route.fulfill({
      json: {
        data: {
          verses: Array.from({ length: b - a + 1 }, (_, i) => ({
            verse: a + i,
            text: `TB2 uji ayat ${a + i}.`,
          })),
        },
      },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return seen;
}
async function install(page: Page) {
  await page.getByRole("tab", { name: /Scriptures/ }).click();
  await bible(page)
    .getByLabel(/ibadah non-komersial/)
    .check();
  await bible(page)
    .getByRole("button", { name: "Pasang Alkitab", exact: true })
    .click();
  await expect(page.getByLabel("Kitab", { exact: true })).toBeVisible({
    timeout: 90000,
  });
}
async function configure(page: Page) {
  await page.getByText(/^Sumber online:/).click();
  await page.getByLabel("API key LAI", { exact: true }).fill("church-lai-key");
  await page.getByLabel(/akses resmi Bible API LAI/).check();
  await page.getByRole("button", { name: "Simpan TB2", exact: true }).click();
  await page.getByRole("button", { name: "Tes TB2", exact: true }).click();
  await expect(bible(page)).toContainText(
    "Berhasil · Kejadian 1:1, 1 Raja-raja 1:1, Kisah Para Rasul 1:1, Wahyu 22:1",
  );
  await page.getByLabel("API key ESV", { exact: true }).fill("church-esv-key");
  await page.getByLabel(/ketentuan ESV API/).check();
  await page.getByRole("button", { name: "Simpan ESV", exact: true }).click();
  await page.getByRole("button", { name: "Tes ESV", exact: true }).click();
  await expect(bible(page)).toContainText(
    "Berhasil · Genesis 1:1: ESV test verse 1.",
  );
  await page.getByLabel("Kolom kiri", { exact: true }).selectOption("tb2");
  await page.getByLabel("Kolom kanan", { exact: true }).selectOption("esv");
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});

test("TB2 left and ESV right from the official APIs, with the church's keys, through LIVE", async ({
  page,
}) => {
  test.setTimeout(180000);
  const seen = await mockApis(page);
  await install(page);
  await expect(
    page.getByLabel("Kolom kiri", { exact: true }).locator("option[value=tb2]"),
  ).toHaveAttribute("disabled", "");
  await configure(page);

  await page.getByLabel("Cari ayat", { exact: true }).fill("Kej 1:3-5");
  await page.getByRole("button", { name: "Pilih", exact: true }).click();
  const header = rows(page).first();
  await expect(header).toContainText("Indonesia · TB2 (online)");
  await expect(header).toContainText("English · ESV (online)");
  await expect(rows(page).nth(1)).toContainText("TB2 uji ayat 3.");
  await expect(rows(page).nth(1)).toContainText("ESV test verse 3.");
  await expect(rows(page).last()).toContainText("TB2 uji ayat 5.");
  // The passage and the key steps point at esv.org.
  await expect(
    bible(page).getByRole("link", { name: "esv.org ↗" }),
  ).toHaveAttribute("href", "https://www.esv.org/Genesis+1:3-5/");
  await expect(
    bible(page).getByRole("link", { name: "Buat aplikasi di api.esv.org" }),
  ).toHaveAttribute("href", "https://api.esv.org/account/create-application/");
  await expect(
    bible(page).getByRole("link", { name: "www.esv.org", exact: true }).first(),
  ).toHaveAttribute("href", "https://www.esv.org");

  const lai = seen.lai.find((r) => r.url.endsWith("/bible/tb2/kejadian/1/3-5"));
  expect(lai?.auth).toBe("Bearer church-lai-key");
  const esv = seen.esv.find(
    (r) => new URL(r.url).searchParams.get("q") === "01001003-01001005",
  );
  expect(esv?.auth).toBe("Token church-esv-key");
  // Keys stay in this browser's localStorage only.
  expect(
    await page.evaluate(() => localStorage.getItem("sagi-bible-online")),
  ).toContain("church-esv-key");

  await bible(page)
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  const pending = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  const projector = await pending;
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(
    projector.locator('.slide-column[data-column="left"]'),
  ).toContainText(
    /³\s?TB2 uji ayat 3\. ⁴\s?TB2 uji ayat 4\. ⁵\s?TB2 uji ayat 5\./,
  );
  await expect(
    projector.locator('.slide-column[data-column="right"]'),
  ).toContainText(/³\s?ESV test verse 3\..*⁵\s?ESV test verse 5\./);
  const footer = projector.locator(".scripture-footer");
  await expect(footer).toContainText("Kejadian 1:3–5 · TB2 · 2023");
  await expect(footer).toContainText("Genesis 1:3–5 · ESV · 2016");
  await expect(footer).toContainText(
    "TB2 © LAI 2023 · ESV® © Crossway · esv.org",
  );
});

test("without internet, verses not fetched yet fall back to AYT / KJV and say so", async ({
  page,
}) => {
  test.setTimeout(180000);
  await mockApis(page);
  await install(page);
  await configure(page);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("https://api.esv.org/**", (route) => route.abort());
  await page.route("https://bible-api.alkitab.or.id/**", (route) =>
    route.abort(),
  );
  await page.getByLabel("Cari ayat", { exact: true }).fill("Yoh 3:16");
  await page.getByRole("button", { name: "Pilih", exact: true }).click();
  await expect(bible(page).getByRole("alert")).toContainText(
    "tidak bisa dihubungi",
  );
  await bible(page)
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await expect(
    page.getByText(/teks TB2 belum tersimpan, memakai AYT/),
  ).toBeVisible();
  // No Preview monitor: what Go Live shows is checked in Live Output.
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  const live = page.getByRole("region", { name: "LIVE projector control" });
  await expect(live.locator('.slide-column[data-column="left"]')).toContainText(
    "Karena Allah sangat mengasihi dunia ini",
  );
  await expect(
    live.locator('.slide-column[data-column="right"]'),
  ).toContainText("For God so loved the world");

  // The online sources panel is still open from configure().
  await expect(bible(page)).toContainText(
    /Tersimpan: TB \d+\/500 · TB2 \d+\/500 · ESV \d+\/500 ayat/,
  );
  await page
    .getByRole("button", { name: "Hapus cache online", exact: true })
    .click();
  await expect(bible(page)).toContainText(
    "Tersimpan: TB 0/500 · TB2 0/500 · ESV 0/500 ayat",
  );
});

test("TB from Alkitab SABDA in the left column, without an API key", async ({
  page,
}) => {
  test.setTimeout(180000);
  const asked: string[] = [];
  await page.route("**/api/sabda?**", (route) => {
    const url = new URL(route.request().url());
    asked.push(url.searchParams.get("passage") ?? "");
    const [, name, chapter, a, b] = url.searchParams
      .get("passage")!
      .match(/^(.+) (\d+):(\d+)(?:-(\d+))?$/)!;
    const order = name === "Yohanes" ? 43 : 1;
    const verses = Array.from(
      { length: Number(b ?? a) - Number(a) + 1 },
      (_, i) =>
        `<verse><number>${Number(a) + i}</number><title>Judul</title><text>TB uji ayat ${Number(a) + i}.</text></verse>`,
    ).join("");
    return route.fulfill({
      contentType: "text/xml",
      body: `<?xml version="1.0"?><bible><book name="${name}"><book_id>${order}</book_id><chapter><chap>${chapter}</chap><verses>${verses}</verses></chapter></book></bible>`,
    });
  });
  await install(page);
  await page.getByText(/^Sumber online:/).click();
  await expect(
    page.getByLabel("Kolom kiri", { exact: true }).locator("option[value=tb]"),
  ).toHaveAttribute("disabled", "");
  await page.getByLabel(/TB dipakai untuk ibadah non-komersial/).check();
  await page.getByRole("button", { name: "Pakai TB", exact: true }).click();
  await expect(page.getByLabel("Kolom kiri", { exact: true })).toHaveValue(
    "tb",
  );
  await page.getByRole("button", { name: "Tes TB", exact: true }).click();
  await expect(bible(page)).toContainText(
    "Berhasil · Yohanes 3:16: TB uji ayat 16.",
  );

  await page.getByLabel("Cari ayat", { exact: true }).fill("Kej 1:3-5");
  await page.getByRole("button", { name: "Pilih", exact: true }).click();
  await expect(rows(page).first()).toContainText("Indonesia · TB (SABDA)");
  await expect(rows(page).nth(1)).toContainText("TB uji ayat 3.");
  await expect(rows(page).nth(1)).toContainText(
    "And God said, Let there be light: and there was light.",
  );
  expect(asked).toContain("Kejadian 1:3-5");
  await expect(
    bible(page).getByRole("link", { name: "sabda.org ↗" }),
  ).toHaveAttribute("href", "https://sabda.org/alkitab/tb/?kitab=1&pasal=1");

  await bible(page)
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  // No Preview monitor: what Go Live shows is checked in Live Output.
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  const live = page.getByRole("region", { name: "LIVE projector control" });
  await expect(
    live.locator('.slide-column[data-column="left"]').first(),
  ).toContainText(/³\s?TB uji ayat 3\..*⁵\s?TB uji ayat 5\./);
  await expect(live.locator(".scripture-footer").first()).toContainText(
    "Kejadian 1:3–5 · TB · 1974",
  );
  await expect(live.locator(".scripture-footer").first()).toContainText(
    "TB © LAI 1974 · Public Domain",
  );
});
