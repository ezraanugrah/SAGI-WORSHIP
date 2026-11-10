import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import {
  previewPosition,
  previewReady,
  openTextEditor,
} from "./previewHelpers";
import { dragToWeek, openWeek } from "./dragHelpers";
const first = "Original first verse for projector verification.",
  chorus = "Original chorus written for software verification.";
function row(page: Page, title: string) {
  return page.getByTestId("song-row").filter({
    has: page.getByRole("button", { name: `Edit ${title}`, exact: true }),
  });
}
async function song(
  page: Page,
  title = "Projection composition",
  sections = true,
) {
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor.getByLabel("Judul lagu", { exact: true }).fill(title);
  await editor.getByLabel("Lirik bagian 1", { exact: true }).fill(first);
  if (sections) {
    await editor
      .getByRole("button", { name: "Tambah bagian", exact: true })
      .click();
    await editor
      .getByLabel("Jenis bagian 2", { exact: true })
      .selectOption("Chorus");
    await editor.getByLabel("Label bagian 2", { exact: true }).fill("Chorus");
    await editor.getByLabel("Lirik bagian 2", { exact: true }).fill(chorus);
    await editor
      .getByLabel("Tambahkan ke urutan", { exact: true })
      .selectOption({ label: "Verse 1" });
  }
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(editor).toHaveCount(0);
}
async function prepare(page: Page, title = "Projection composition") {
  await row(page, title)
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
async function start(page: Page) {
  await song(page);
  await prepare(page);
  const output = await openOutput(page);
  await expect(output.locator(".slide-lines")).toHaveCount(0);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(output.locator(".slide-lines")).toHaveText(first);
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  return output;
}
async function checkpoint(page: Page) {
  await expect(page.getByText(/Checkpoint tersimpan · LIVE/)).toBeVisible();
}
async function seededSchedule(page: Page) {
  await openWeek(page, 1);
}
async function confirm(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
}
async function installProbe(context: BrowserContext) {
  await context.addInitScript(() => {
    const target = window as unknown as {
      sent: unknown[];
      suspendMessages: boolean;
      blockBC: boolean;
      restoreCheckpoint?: () => void;
    };
    target.sent = [];
    target.suspendMessages =
      sessionStorage.getItem("phase3-test-suspend") === "1";
    const Original = window.BroadcastChannel;
    class Probe extends Original {
      constructor(name: string) {
        if (target.blockBC)
          throw new Error("BroadcastChannel disabled for test");
        super(name);
      }
      postMessage(data: unknown) {
        target.sent.push(structuredClone(data));
        if (!target.suspendMessages) super.postMessage(data);
      }
    }
    window.BroadcastChannel = Probe;
    const post = window.postMessage.bind(window);
    window.postMessage = function (...args: Parameters<Window["postMessage"]>) {
      if (!target.suspendMessages) return post(...args);
    };
  });
  for (const page of context.pages()) await page.reload();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});
test("two real windows preserve Preview/LIVE isolation and all visibility/navigation controls", async ({
  page,
}) => {
  const output = await start(page),
    preview = page.getByRole("region", { name: "Preview workspace" }),
    live = page.getByRole("region", { name: "LIVE projector control" });
  await preview
    .getByRole("button", { name: "Preview berikutnya", exact: true })
    .click();
  await expect(previewPosition(preview)).toHaveText(/^Slide 2 of/);
  await expect(output.locator(".slide-lines")).toHaveText(first);
  await openTextEditor(page);
  await preview
    .getByLabel("Teks slide sementara", { exact: true })
    .fill("Original temporary override.");
  await expect(
    page.getByRole("button", { name: "Go Live", exact: true }),
  ).toBeDisabled();
  await preview
    .getByRole("button", { name: "Apply Preview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Go Live", exact: true }),
  ).toBeEnabled();
  await expect(output.locator(".slide-lines")).toHaveText(first);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(output.locator(".slide-lines")).toHaveText(
    "Original temporary override.",
  );
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await live
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await page.getByRole("button", { name: "Clear Text", exact: true }).click();
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "clearText",
  );
  await expect(output.locator(".slide-lines")).toBeHidden();
  // Clicking the pressed Clear Text again returns to normal.
  await page.getByRole("button", { name: "Clear Text", exact: true }).click();
  await expect(output.locator(".slide-lines")).toHaveText(first);
  await expect(output.locator(".slide-lines")).toBeVisible();
  await live
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .isDisabled()
    .then((value) => expect(value).toBe(true));
  await checkpoint(page);
});
test("source autosave/deletion, preference changes and Settings navigation never change frozen LIVE", async ({
  page,
}) => {
  const output = await start(page);
  await page
    .getByRole("button", { name: "Edit Projection composition", exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Editor lagu" });
  await editor
    .getByLabel("Lirik bagian 1", { exact: true })
    .fill("New source text saved during presentation.");
  await expect(editor.getByRole("status")).toHaveText("Tersimpan lokal");
  await editor.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(output.locator(".slide-lines")).toHaveText(first);
  await page.getByRole("link", { name: "Pengaturan", exact: true }).click();
  await page.getByRole("button", { name: "Ocean", exact: true }).click();
  await expect(output.locator(".slide-reference")).toHaveClass(/theme-black/);
  await expect(output.locator(".slide-lines")).toHaveText(first);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await confirm(page);
  await page
    .getByRole("button", {
      name: "Hapus lagu Projection composition",
      exact: true,
    })
    .click();
  await expect(row(page, "Projection composition")).toHaveCount(0);
  await expect(output.locator(".slide-lines")).toHaveText(first);
  await page
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(output.locator(".slide-lines")).toHaveText(chorus);
  await page
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(output.locator(".slide-lines")).toHaveText(first);
});
test("scheduled navigation crosses repeated sections and schedule items using frozen order", async ({
  page,
}) => {
  await song(page);
  await song(page, "Second composition", false);
  await seededSchedule(page);
  for (const title of ["Projection composition", "Second composition"]) {
    await dragToWeek(row(page, title));
    await expect(page.getByTestId("schedule-item")).toHaveCount(
      title === "Projection composition" ? 1 : 2,
    );
  }
  await page
    .getByTestId("schedule-item")
    .first()
    .getByRole("button")
    .first()
    .click();
  await expect(previewPosition(page)).toHaveText(/ of 4$/);
  const output = await openOutput(page);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  for (const text of [first, chorus, first, first]) {
    await expect(output.locator(".slide-lines")).toHaveText(text);
    if (
      text === first &&
      (await page
        .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
        .isDisabled())
    )
      break;
    await page
      .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
      .click();
  }
  await expect(
    page.getByRole("button", { name: "Slide berikutnya LIVE", exact: true }),
  ).toBeDisabled();
});
test("projector refresh starts black, receives a fresh snapshot, and close/reopen recovers", async ({
  page,
  context,
}) => {
  await installProbe(context);
  const output = await start(page);
  await page
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(output.locator(".slide-lines")).toHaveText(chorus);
  await output.reload();
  await expect(output.locator(".slide-lines")).toHaveText(chorus);
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  await output.close();
  await expect(page.getByTestId("connection-status")).toHaveText("Ditutup");
  const again = await openOutput(page);
  await expect(again.locator(".slide-lines")).toHaveText(chorus);
  expect(context.pages()).toHaveLength(2);
});
test("a refreshed projector stays black while messages are interrupted; established output holds its frame", async ({
  page,
  context,
}) => {
  await installProbe(context);
  const output = await start(page);
  await page.evaluate(() => {
    (window as unknown as { suspendMessages: boolean }).suspendMessages = true;
  });
  await output.evaluate(() => {
    (window as unknown as { suspendMessages: boolean }).suspendMessages = true;
  });
  await page
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(output.locator(".slide-lines")).toHaveText(first);
  await expect(page.getByTestId("connection-status")).toHaveText(
    "Tidak merespons",
    { timeout: 10000 },
  );
  await output.evaluate(() =>
    sessionStorage.setItem("phase3-test-suspend", "1"),
  );
  await output.reload();
  await expect(output.getByTestId("projector")).toHaveAttribute(
    "data-sequence",
    "-1",
  );
  await expect(output.locator(".slide-lines")).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as { suspendMessages: boolean }).suspendMessages = false;
  });
  await output.evaluate(() => {
    (window as unknown as { suspendMessages: boolean }).suspendMessages = false;
    sessionStorage.removeItem("phase3-test-suspend");
  });
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await expect(output.locator(".slide-lines")).toHaveText(chorus);
});
test("duplicate, delayed, wrong-session and wrong-document messages cannot replace the latest frame", async ({
  page,
  context,
}) => {
  await installProbe(context);
  const output = await start(page);
  const messages = await page.evaluate(() =>
    (
      window as unknown as { sent: { type: string; seq: number }[] }
    ).sent.filter((m) => m.type === "STATE" && m.seq > 0),
  );
  const old = messages.at(-1)!;
  await page
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(output.locator(".slide-lines")).toHaveText(chorus);
  const latest = await page.evaluate(() =>
    (window as unknown as { sent: { type: string; seq: number }[] }).sent
      .filter((m) => m.type === "STATE")
      .at(-1),
  );
  for (const message of [
    old,
    latest,
    { ...latest, session: "old-session", seq: 999 },
    { ...latest, nonce: "old-document", seq: 999 },
    { ...latest, v: 99, seq: 999 },
    { ...latest, seq: 999, live: { bad: true } },
  ])
    await page.evaluate((message) => {
      const value = message as unknown as { pair: string };
      const channel = new BroadcastChannel(`sagi-projector:${value.pair}`);
      channel.postMessage(message);
      channel.close();
    }, message);
  await expect(output.locator(".slide-lines")).toHaveText(chorus);
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
});
test("operator restart never takes over; explicit Resume restores checkpoint and Discard leaves black", async ({
  page,
}) => {
  const output = await start(page);
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await checkpoint(page);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Pemulihan presentasi" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Go Live", exact: true }),
  ).toBeDisabled();
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await page
    .getByRole("button", { name: "Resume presentasi", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Pemulihan presentasi" }),
  ).toHaveCount(0);
  const newOutput = await openOutput(page);
  await expect(newOutput.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(newOutput.locator(".slide-lines")).toHaveText(first);
  await checkpoint(page);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Pemulihan presentasi" }),
  ).toBeVisible();
  await confirm(page);
  await page
    .getByRole("button", { name: "Discard checkpoint", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Pemulihan presentasi" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Slide berikutnya LIVE", exact: true }),
  ).toBeDisabled();
  const empty = await openOutput(page);
  await expect(empty.locator(".slide-lines")).toHaveCount(0);
});
test("checkpoint failure cannot disable emergency Black; checkpoint can be retried", async ({
  page,
}) => {
  const output = await start(page);
  await checkpoint(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as unknown as { restoreCheckpoint: () => void }).restoreCheckpoint =
      () => {
        IDBObjectStore.prototype.put = original;
      };
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "live_session_state")
        throw new DOMException("simulated quota", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(page.getByText(/Checkpoint gagal:/)).toBeVisible();
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await page.evaluate(() =>
    (
      window as unknown as { restoreCheckpoint: () => void }
    ).restoreCheckpoint(),
  );
  await page
    .getByRole("button", { name: "Coba checkpoint lagi", exact: true })
    .click();
  await checkpoint(page);
});
test("fullscreen/popup denial and BroadcastChannel fallback remain actionable", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    window.BroadcastChannel = class {
      constructor() {
        throw new Error("disabled");
      }
    } as unknown as typeof BroadcastChannel;
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new Error("Denied for test"));
  });
  await page.reload();
  await song(page);
  await prepare(page);
  const original = await page.evaluate(() => {
    (window as unknown as { originalOpen: typeof window.open }).originalOpen =
      window.open;
    window.open = () => null;
    return true;
  });
  expect(original).toBe(true);
  await page.getByRole("button", { name: "Live", exact: true }).click();
  await expect(page.getByText(/Popup diblokir/)).toBeVisible();
  await page.evaluate(() => {
    window.open = (
      window as unknown as { originalOpen: typeof window.open }
    ).originalOpen;
  });
  const output = await openOutput(page);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(output.locator(".slide-lines")).toHaveText(first);
  await page
    .getByRole("button", { name: "Fullscreen Projector", exact: true })
    .click();
  await expect(output.getByRole("status")).toContainText("Fullscreen ditolak");
  await expect(output.locator(".slide-lines")).toHaveText(first);
});
test("presentation shortcuts never intercept source/Preview text editing", async ({
  page,
}) => {
  const output = await start(page),
    live = page.getByRole("region", { name: "LIVE projector control" });
  await page.getByLabel("Cari musik").fill("b");
  await page.keyboard.press("b");
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "normal",
  );
  await page.getByLabel("Cari musik").fill("");
  await live.focus();
  await page.keyboard.press("ArrowRight");
  await expect(output.locator(".slide-lines")).toHaveText(chorus);
  await page.keyboard.press("b");
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
  await page.keyboard.press("b");
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "normal",
  );
  await openTextEditor(page);
  await page.getByLabel("Teks slide sementara", { exact: true }).focus();
  await page.keyboard.press("c");
  await expect(output.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "normal",
  );
});
test("secondary operator and projector never acquire presentation authority or mutate sources", async ({
  page,
  context,
}) => {
  const output = await start(page);
  const secondary = await context.newPage();
  await secondary.goto("/");
  await expect(
    secondary.getByRole("button", {
      name: "Live",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    secondary.getByRole("button", { name: "Go Live", exact: true }),
  ).toBeDisabled();
  await page.close();
  await output.reload();
  await expect(output.getByTestId("projector")).toHaveAttribute(
    "data-sequence",
    "-1",
  );
  await secondary.reload();
  await expect(
    secondary.getByRole("button", { name: "Resume presentasi", exact: true }),
  ).toBeEnabled();
});
test("two windows run, refresh, reconnect and recover checkpoints fully offline", async ({
  page,
  context,
}) => {
  await song(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await prepare(page);
  const output = await openOutput(page);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(output.locator(".slide-lines")).toHaveText(first);
  await page
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(output.locator(".slide-lines")).toHaveText(chorus);
  await output.reload();
  await expect(output.locator(".slide-lines")).toHaveText(chorus);
  await checkpoint(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume presentasi", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resume presentasi", exact: true })
    .click();
  const recovered = await openOutput(page);
  await expect(recovered.locator(".slide-lines")).toHaveText(chorus);
  await expect(page.getByText("Tanpa internet", { exact: true })).toBeVisible();
});
for (const width of [320, 768, 1440])
  test(`presentation layout and 16:9 projector fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const output = await start(page);
    await output.setViewportSize({ width: 1024, height: 768 });
    const rect = await output.locator(".slide-reference").boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.width / rect!.height).toBeCloseTo(16 / 9, 3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `test-results/phase3-operator-${width}.png`,
      fullPage: true,
    });
    if (width === 1440)
      await output.screenshot({ path: "test-results/phase3-projector.png" });
  });

test("loss of writer ownership disables every LIVE command and retains the projector frame", async ({
  page,
  context,
}) => {
  const output = await start(page);
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate(() => {
    void navigator.locks.request(
      "sagi-workspace-writer",
      { steal: true },
      () => new Promise<void>(() => {}),
    );
  });
  await expect(
    page.getByRole("button", { name: "Black", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Go Live", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Slide berikutnya LIVE", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Reconnect", exact: true }),
  ).toBeDisabled();
  await expect(output.locator(".slide-lines")).toHaveText(first);
});
