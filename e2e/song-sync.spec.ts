import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { createFakeSupabase } from "../src/sync/fakeSupabase";
import { imageFile } from "./mediaFixtures";
import { createTheme } from "./themeHelpers";
// Two laptops (two separate browser profiles) share one mocked Supabase
// server. A song added on one shows up in Musik on the other, and so on.
const SERVER = "https://sync.test";
type Fake = ReturnType<typeof createFakeSupabase>;
const bytes = (data: Uint8Array) =>
  (
    globalThis as unknown as {
      Buffer: { from(data: Uint8Array): string };
    }
  ).Buffer.from(data);
async function laptop(browser: Browser, fake: Fake) {
  const context: BrowserContext = await browser.newContext({
    serviceWorkers: "allow",
  });
  await context.addInitScript((url) => {
    (window as unknown as { __SAGI_SYNC__: object }).__SAGI_SYNC__ = {
      url,
      key: "anon-key",
    };
  }, SERVER);
  await context.route(`${SERVER}/**`, async (route) => {
    const request = route.request(),
      cors = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers":
          "apikey, authorization, content-type, prefer, x-upsert",
        "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
      };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    // Media chunks travel as raw bytes (Supabase Storage); rows as JSON.
    const storage = new URL(request.url()).pathname.startsWith("/storage/");
    const r = fake.handle(
      request.url(),
      request.method(),
      request.headers(),
      storage
        ? (request.postDataBuffer() as Uint8Array | null)
        : request.postData(),
    );
    if (r.bytes)
      return route.fulfill({
        status: r.status,
        headers: cors,
        contentType: "application/octet-stream",
        body: bytes(r.bytes),
      });
    await route.fulfill({
      status: r.status,
      headers: cors,
      contentType: "application/json",
      body: r.body === null ? "" : JSON.stringify(r.body),
    });
  });
  const page = await context.newPage();
  // Same server as the configured baseURL (contexts made here do not get it).
  await page.goto(test.info().project.use.baseURL ?? "http://127.0.0.1:4174/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
  return { context, page };
}
const panel = (page: Page) =>
  page.getByRole("region", { name: "Sinkron antar laptop" });
async function signIn(page: Page, password = "rahasia") {
  await panel(page).getByLabel("Email sinkron").fill("tim@gereja.id");
  await panel(page).getByLabel("Password sinkron").fill(password);
  await panel(page).getByRole("button", { name: "Masuk", exact: true }).click();
}
async function addSong(page: Page, title: string) {
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor.getByLabel("Judul lagu", { exact: true }).fill(title);
  await editor
    .getByLabel("Lirik bagian 1", { exact: true })
    .fill("Lirik sintetis untuk uji sinkron.");
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor
    .getByRole("button", { name: "Simpan sekarang", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
}
const row = (page: Page, title: string) =>
  page.getByTestId("song-row").filter({ hasText: title });

test("a song added on one laptop appears on the other, and a deletion follows back", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const fake = createFakeSupabase({ "tim@gereja.id": "rahasia" });
  const a = await laptop(browser, fake),
    b = await laptop(browser, fake);

  await signIn(a.page, "salah");
  await expect(panel(a.page)).toContainText("Email atau password salah.");
  await signIn(a.page);
  await expect(panel(a.page)).toContainText("tim@gereja.id");
  await expect(panel(a.page)).toContainText(/Tersinkron \d\d\.\d\d · 0 lagu/);
  await signIn(b.page);
  await expect(panel(b.page)).toContainText("Tersinkron");

  await addSong(a.page, "Kasih Setia Sinkron");
  await expect.poll(() => fake.rows.size, { timeout: 15000 }).toBe(1);
  await expect(row(b.page, "Kasih Setia Sinkron")).toHaveCount(1, {
    timeout: 25000,
  });
  await expect(panel(b.page)).toContainText("1 lagu");
  await b.page.screenshot({ path: test.info().outputPath("song-sync.png") });

  b.page.once("dialog", (dialog) => dialog.accept());
  await b.page
    .getByRole("button", {
      name: "Hapus lagu Kasih Setia Sinkron",
      exact: true,
    })
    .click();
  await expect(row(a.page, "Kasih Setia Sinkron")).toHaveCount(0, {
    timeout: 25000,
  });
  expect([...fake.rows.values()][0].deleted).toBe(true);

  // Signing out keeps this laptop's songs.
  await addSong(a.page, "Tetap di laptop");
  await panel(a.page)
    .getByRole("button", { name: "Keluar", exact: true })
    .click();
  await expect(panel(a.page).getByLabel("Email sinkron")).toBeVisible();
  await expect(row(a.page, "Tetap di laptop")).toHaveCount(1);
  await a.context.close();
  await b.context.close();
});

test("media and themes follow the same account to the other laptop", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const fake = createFakeSupabase({ "tim@gereja.id": "rahasia" });
  const a = await laptop(browser, fake),
    b = await laptop(browser, fake);
  await signIn(a.page);
  await signIn(b.page);
  await expect(panel(a.page)).toContainText("0 media · 0 tema");
  await expect(panel(b.page)).toContainText("Tersinkron");

  // A picture imported in Media on laptop A…
  await a.page.getByRole("tab", { name: "Media", exact: true }).click();
  await a.page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await imageFile(a.page, "altar-sinkron.png", "#3a7bd5"));
  await expect(
    a.page.getByRole("button", {
      name: "Pilih media altar-sinkron.png",
      exact: true,
    }),
  ).toBeVisible();
  // …and a theme with its own picture background.
  await createTheme(
    a.page,
    "Tema Sinkron",
    "image",
    await imageFile(a.page, "latar-tema.png", "#2d8a4e"),
  );
  await expect.poll(() => fake.tables.themes.size, { timeout: 20000 }).toBe(1);
  expect(fake.objects.size).toBeGreaterThan(0);

  // Laptop B gets both, files checked, and the theme shows its background.
  await b.page.getByRole("tab", { name: "Media", exact: true }).click();
  await expect(
    b.page.getByRole("button", {
      name: "Pilih media altar-sinkron.png",
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  await b.page.getByRole("tab", { name: /Themes/ }).click();
  const theme = b.page.getByRole("button", {
    name: "Pilih tema Tema Sinkron",
    exact: true,
  });
  await expect(theme).toBeVisible({ timeout: 30000 });
  await theme.click();
  await b.page.screenshot({ path: test.info().outputPath("media-sync.png") });

  await b.page.getByRole("tab", { name: "Songs", exact: true }).click();
  await expect(panel(b.page)).toContainText(/\d+ media · 1 tema/);
  // The copy on B is a real, readable picture (checked chunk by chunk).
  await b.page.getByRole("tab", { name: "Media", exact: true }).click();
  await expect
    .poll(() =>
      b.page
        .getByRole("button", {
          name: "Pilih media altar-sinkron.png",
          exact: true,
        })
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await a.context.close();
  await b.context.close();
});

test("without a configured server the panel says sync is not set up", async ({
  page,
}) => {
  await page.goto("/");
  await expect(panel(page)).toContainText("Belum disiapkan");
});
