import { test, expect, type Page } from "@playwright/test";
// A new SAGI version installs itself on every laptop after a short notice,
// but never while something is LIVE or the projector window is open.
async function newVersion(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __applied?: number };
    w.__applied = 0;
    window.dispatchEvent(
      new CustomEvent("sagi-update-ready", {
        detail: async () => {
          w.__applied = (w.__applied ?? 0) + 1;
        },
      }),
    );
  });
}
const applied = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __applied?: number }).__applied ?? 0,
  );
const banner = (page: Page) => page.locator(".update-banner");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});

test("installs itself after a 15-second notice when nothing is LIVE", async ({
  page,
}) => {
  test.setTimeout(60000);
  await newVersion(page);
  await expect(banner(page)).toContainText(
    /Versi baru SAGI tersedia\. Dipasang otomatis dalam \d+ detik\./,
  );
  await expect.poll(() => applied(page), { timeout: 20000 }).toBe(1);
});

test("“Nanti” keeps the current version; the button still installs it", async ({
  page,
}) => {
  await newVersion(page);
  await expect(banner(page)).toContainText("Dipasang otomatis dalam");
  await banner(page)
    .getByRole("button", { name: "Nanti", exact: true })
    .click();
  await expect(banner(page)).not.toContainText("Dipasang otomatis");
  await page.waitForTimeout(1500);
  expect(await applied(page)).toBe(0);
  await banner(page)
    .getByRole("button", { name: "Muat versi baru", exact: true })
    .click();
  await expect.poll(() => applied(page)).toBe(1);
});

test("waits while the projector window is open", async ({ page }) => {
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await popup;
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  await newVersion(page);
  await expect(banner(page)).toContainText("Versi baru SAGI tersedia.");
  await expect(banner(page)).not.toContainText("Dipasang otomatis");
  await page.waitForTimeout(1500);
  expect(await applied(page)).toBe(0);
});
