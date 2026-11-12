import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { previewReady } from "./previewHelpers";
import { imageFile } from "./mediaFixtures";

// v0.7.1 regression tests for the dual-display audit (H1–H4).
// Three slides, so a key applied twice would visibly skip a slide.
const first = "Original first verse for projector stability.",
  chorus = "Original chorus written for projector stability.",
  bridge = "Original bridge written for projector stability.";
const title = "Stability composition";

function row(page: Page) {
  return page.getByTestId("song-row").filter({
    has: page.getByRole("button", { name: `Edit ${title}`, exact: true }),
  });
}
async function song(page: Page) {
  await page.getByRole("tab", { name: /Songs/ }).click();
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor.getByLabel("Judul lagu", { exact: true }).fill(title);
  await editor.getByLabel("Lirik bagian 1", { exact: true }).fill(first);
  await editor
    .getByRole("button", { name: "Tambah bagian", exact: true })
    .click();
  await editor
    .getByLabel("Jenis bagian 2", { exact: true })
    .selectOption("Chorus");
  await editor.getByLabel("Lirik bagian 2", { exact: true }).fill(chorus);
  await editor
    .getByRole("button", { name: "Tambah bagian", exact: true })
    .click();
  await editor
    .getByLabel("Jenis bagian 3", { exact: true })
    .selectOption("Bridge");
  await editor.getByLabel("Lirik bagian 3", { exact: true }).fill(bridge);
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(editor).toHaveCount(0);
}
async function prepare(page: Page) {
  await page.getByRole("tab", { name: /Songs/ }).click();
  await row(page)
    .getByRole("button", { name: new RegExp(`^${title}`) })
    .click();
  await previewReady(page);
}
async function openOutput(page: Page) {
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  const output = await popup;
  await expect(output.getByTestId("projector")).toBeVisible();
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  return output;
}
async function goLive(page: Page) {
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
}
async function start(page: Page) {
  await song(page);
  await prepare(page);
  const output = await openOutput(page);
  await goLive(page);
  await expect(output.locator(".slide-lines")).toHaveText(first);
  return output;
}
const lines = (output: Page) => output.locator(".slide-lines");
const mode = (output: Page) => output.getByTestId("slide-canvas");
async function installWakeLockProbe(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as {
      __wake: { requested: number; active: number };
    };
    w.__wake = { requested: 0, active: 0 };
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          w.__wake.requested++;
          w.__wake.active++;
          const listeners: (() => void)[] = [];
          let released = false;
          return {
            release: async () => {
              if (released) return;
              released = true;
              w.__wake.active--;
              listeners.forEach((l) => l());
            },
            addEventListener: (_type: string, l: () => void) =>
              listeners.push(l),
          };
        },
      },
    });
  });
}
const wake = (p: Page) =>
  p.evaluate(
    () =>
      (window as unknown as { __wake: { requested: number; active: number } })
        .__wake,
  );

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});

test("H1/M2: the audience never keeps seeing the Fullscreen control or the mouse pointer", async ({
  page,
}) => {
  await song(page);
  await prepare(page);
  const output = await openOutput(page);
  const actions = output.locator(".projector-actions"),
    shell = output.getByTestId("projector");
  await goLive(page);
  await expect(lines(output)).toHaveText(first);
  await output.getByRole("button", { name: "Fullscreen proyektor" }).click();
  await output.mouse.move(40, 600);
  // Controls fade 1.5 s after the last pointer move, even though the button was clicked.
  await expect(actions).toHaveCSS("opacity", "0", { timeout: 5000 });
  await expect(shell).toHaveCSS("cursor", "none");
  await output.mouse.move(80, 620);
  await expect(actions).toHaveCSS("opacity", "1");
  await expect(shell).toHaveCSS("cursor", "auto");
  await expect(actions).toHaveCSS("opacity", "0", { timeout: 5000 });
  await expect(lines(output)).toHaveText(first);
});

test("H2: LIVE keeps the operator and audience displays awake, and not before", async ({
  page,
  context,
}) => {
  await installWakeLockProbe(context);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
  await song(page);
  await prepare(page);
  const output = await openOutput(page);
  expect((await wake(page)).requested).toBe(0);
  expect((await wake(output)).requested).toBe(0);
  await goLive(page);
  await expect(page.getByTestId("wake-lock-status")).toHaveText(
    "Layar dijaga tetap menyala",
  );
  await expect.poll(async () => (await wake(page)).active).toBe(1);
  await expect.poll(async () => (await wake(output)).active).toBe(1);
  // Black is still part of the LIVE session: the screen stays awake.
  await page
    .getByRole("button", { name: "Black", exact: true })
    .first()
    .click();
  await expect(mode(output)).toHaveAttribute("data-mode", "black");
  expect((await wake(output)).active).toBe(1);
  expect((await wake(page)).active).toBe(1);
});

test("H3: a background image is verified once by the projector, not on every slide change", async ({
  page,
  context,
}) => {
  // Counts IndexedDB media reads in windows opened from now on (the projector).
  await context.addInitScript(() => {
    const w = window as unknown as { __mediaReads: number };
    w.__mediaReads = 0;
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["get"]>
    ) {
      if (this.name === "media_assets") w.__mediaReads++;
      return get.apply(this, args);
    };
  });
  await page.getByRole("tab", { name: /Media/ }).click();
  await page
    .getByLabel("File media", { exact: true })
    .setInputFiles(await imageFile(page));
  await expect(
    page.getByRole("button", {
      name: "Pilih media synthetic.png",
      exact: true,
    }),
  ).toBeVisible();
  await song(page);
  await prepare(page);
  await page.getByRole("tab", { name: /Themes/ }).click();
  await page.getByRole("button", { name: "Buat tema", exact: true }).click();
  await page.getByLabel("Nama tema", { exact: true }).fill("Stability image");
  await page
    .getByLabel("Jenis background", { exact: true })
    .selectOption("image");
  await page.getByRole("button", { name: "Simpan tema", exact: true }).click();
  await page
    .getByRole("button", { name: "Pilih tema Stability image", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Terapkan ke item Preview", exact: true })
    .click();
  const output = await openOutput(page);
  await goLive(page);
  const themed = output.locator(".themed-lines");
  await expect(themed).toHaveText(first);
  await expect(output.locator(".theme-background img")).toBeVisible();
  const reads = () =>
    output.evaluate(
      () => (window as unknown as { __mediaReads: number }).__mediaReads,
    );
  const initial = await reads();
  expect(initial).toBeGreaterThan(0);
  const live = page.getByRole("region", { name: "LIVE projector control" });
  await live
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(themed).toHaveText(chorus);
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  await live
    .getByRole("button", { name: "Slide sebelumnya LIVE", exact: true })
    .click();
  await expect(themed).toHaveText(first);
  await page.getByRole("button", { name: "Clear Text", exact: true }).click();
  await expect(mode(output)).toHaveAttribute("data-mode", "clearText");
  await page.getByRole("button", { name: "Clear Text", exact: true }).click();
  await expect(themed).toHaveText(first);
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  expect(await reads()).toBe(initial);
  await expect(output.locator(".theme-background img")).toBeVisible();
});

test("H4: LIVE shortcuts work anywhere in the operator window, with clicker keys", async ({
  page,
}) => {
  const output = await start(page);
  // Focus nowhere in particular (as after clicking an empty area).
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  // Each press moves exactly one slide (a double execution would skip one).
  await page.keyboard.press("ArrowRight");
  await expect(lines(output)).toHaveText(chorus);
  await page.keyboard.press("ArrowRight");
  await expect(lines(output)).toHaveText(bridge);
  await page.keyboard.press("ArrowLeft");
  await expect(lines(output)).toHaveText(chorus);
  await page.keyboard.press("ArrowLeft");
  await expect(lines(output)).toHaveText(first);
  // Presentation clickers send PageDown/PageUp and "." for a black screen.
  await page.keyboard.press("PageDown");
  await expect(lines(output)).toHaveText(chorus);
  await page.keyboard.press("PageUp");
  await expect(lines(output)).toHaveText(first);
  await page.keyboard.press(".");
  await expect(mode(output)).toHaveAttribute("data-mode", "black");
  await page.keyboard.press(".");
  await expect(mode(output)).toHaveAttribute("data-mode", "normal");
  // A focused button elsewhere (not a text field) does not block arrows.
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(lines(output)).toHaveText(chorus);
});

test("H4: shortcuts stay off while typing or inside an editor", async ({
  page,
}) => {
  const output = await start(page);
  await page.getByLabel("Cari musik").fill("b");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("b");
  await expect(lines(output)).toHaveText(first);
  await expect(mode(output)).toHaveAttribute("data-mode", "normal");
  await page.getByLabel("Cari musik").fill("");
  await row(page)
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor
    .getByRole("button", { name: "Tambah bagian", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("PageDown");
  await page.keyboard.press("b");
  await expect(lines(output)).toHaveText(first);
  await expect(mode(output)).toHaveAttribute("data-mode", "normal");
  await editor.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(editor).toHaveCount(0);
});

test("H4: keys pressed in the focused projector window control LIVE through the operator", async ({
  page,
}) => {
  const output = await start(page);
  await output.bringToFront();
  // Every message reaches the operator over two channels; each press must
  // still move exactly one slide.
  await output.keyboard.press("ArrowRight");
  await expect(lines(output)).toHaveText(chorus);
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  await output.keyboard.press("PageDown");
  await expect(lines(output)).toHaveText(bridge);
  await output.keyboard.press("PageUp");
  await expect(lines(output)).toHaveText(chorus);
  await output.keyboard.press("ArrowLeft");
  await expect(lines(output)).toHaveText(first);
  await output.keyboard.press("b");
  await expect(mode(output)).toHaveAttribute("data-mode", "black");
  await output.keyboard.press("b");
  await expect(mode(output)).toHaveAttribute("data-mode", "normal");
  // The operator remains the only authority: its LIVE state followed the keys.
  await expect(
    page.getByRole("region", { name: "LIVE projector control" }),
  ).toBeVisible();
});
