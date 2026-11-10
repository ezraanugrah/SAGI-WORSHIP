import { test, expect, type Page } from "@playwright/test";
import { dragToWeek, openWeek } from "./dragHelpers";
import { fixtureDataset, signFixture } from "../src/scriptures/testFixtures";
// Playwright runs in Node; keep Node-only globals out of the browser app type environment.
const nodeBuffer = (
  globalThis as unknown as { Buffer: { from(text: string): Uint8Array } }
).Buffer;
const attestation =
  "Saya berhak menyimpan, memproyeksikan, dan membuat snapshot lokal dataset ini";
async function library(page: Page) {
  await page.getByRole("tab", { name: /Scriptures/ }).click();
}
async function upload(page: Page, corrupt = false) {
  const data = await signFixture();
  if (corrupt) data.verses[0].text += "tamper";
  await page.getByLabel("File dataset Alkitab").setInputFiles({
    name: "synthetic.json",
    mimeType: "application/json",
    buffer: nodeBuffer.from(JSON.stringify(data)),
  });
}
async function imported(page: Page) {
  await library(page);
  await upload(page);
  await expect(
    page.getByRole("button", { name: "Konfirmasi dan impor", exact: true }),
  ).toBeDisabled();
  await page.getByLabel(attestation).check();
  await page
    .getByRole("button", { name: "Konfirmasi dan impor", exact: true })
    .click();
  await expect(
    page.getByText("Dataset diimpor. Seluruh ayat tersimpan offline."),
  ).toBeVisible();
  await expect(page.getByLabel("Terjemahan", { exact: true })).toContainText(
    "Synthetic",
  );
}
async function select(page: Page, ref = "John 3:16-18") {
  await page.getByLabel("Referensi ayat", { exact: true }).fill(ref);
  await page
    .getByRole("button", { name: "Cari referensi", exact: true })
    .click();
  await expect(
    page.getByText(ref.endsWith("18") ? "3 ayat dipilih" : "1 ayat dipilih", {
      exact: true,
    }),
  ).toBeVisible();
}
async function output(page: Page) {
  const pending = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  const p = await pending;
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  return p;
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Tambah lagu", exact: true }),
  ).toBeEnabled();
});
test("strict import validation, consent, cancellation, duplicate protection and reference gaps", async ({
  page,
}) => {
  await library(page);
  await upload(page, true);
  await expect(
    page
      .getByRole("region", { name: "Impor dataset Alkitab" })
      .getByRole("status"),
  ).toContainText(/integritas|SHA|checksum/i);
  await upload(page);
  await page
    .getByRole("button", { name: "Batalkan impor", exact: true })
    .click();
  await expect(page.getByText("Belum ada dataset Alkitab")).toBeVisible();
  await imported(page);
  await upload(page);
  await page.getByLabel(attestation).check();
  await page
    .getByRole("button", { name: "Konfirmasi dan impor", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Impor dataset Alkitab" })
      .getByRole("status"),
  ).toContainText("identik");
  await page.getByLabel("Referensi ayat", { exact: true }).fill("John 3:18-20");
  await page
    .getByRole("button", { name: "Cari referensi", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(/19|tersedia/);
  await expect(page.getByText("0 ayat dipilih", { exact: true })).toBeVisible();
});
test("offline import, Unicode text search, browsing and reload persistence", async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await imported(page);
  await page.getByLabel("Cari teks ayat", { exact: true }).fill("LANTERNS");
  await expect(
    page.getByRole("list", { name: "Hasil pencarian" }).locator("li"),
  ).toHaveCount(2);
  await page.getByLabel("Kitab", { exact: true }).selectOption("1John");
  await expect(page.getByRole("list", { name: "Daftar ayat" })).toContainText(
    "numbered-book",
  );
  await page.reload();
  await library(page);
  await expect(page.getByLabel("Terjemahan", { exact: true })).toContainText(
    "Synthetic",
  );
  await select(page, "Jn 3:16");
  await page.getByRole("button", { name: "Preview ayat", exact: true }).click();
  const p = await output(page);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(p.locator(".slide-lines")).toHaveText(
    fixtureDataset().verses[0].text,
  );
  await expect(p.locator(".scripture-footer")).toContainText("John 3:16");
  await p.reload();
  await expect(p.locator(".scripture-footer")).toContainText(
    "SYN — Original synthetic test text",
  );
});
test("two windows retain frozen LIVE after deletion; mixed schedule duplication, keyboard and drag ordering", async ({
  page,
}) => {
  await openWeek(page, 1);
  await page.getByRole("button", { name: "Tambah lagu", exact: true }).click();
  await page.getByLabel("Judul lagu", { exact: true }).fill("Synthetic song");
  await page
    .getByLabel("Lirik bagian 1", { exact: true })
    .fill("Original rehearsal song text.");
  await expect(
    page.getByRole("region", { name: "Editor lagu" }).getByRole("status"),
  ).toHaveText("Tersimpan lokal");
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  await dragToWeek(page.getByTestId("song-row").first());
  await imported(page);
  await select(page);
  await page
    .getByRole("button", { name: "Tambahkan ayat ke jadwal", exact: true })
    .click();
  await expect(page.getByTestId("schedule-item")).toHaveCount(2);
  await page.getByLabel("Naikkan item 2", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("schedule-item").first()).toContainText(
    "Scripture",
  );
  await page
    .getByTestId("schedule-item")
    .first()
    .dragTo(page.getByTestId("schedule-item").last());
  await expect(page.getByTestId("schedule-item").first()).toContainText(
    "Synthetic song",
  );
  await expect(page.getByTestId("schedule-item")).toHaveCount(2);
  await page
    .getByTestId("schedule-item")
    .last()
    .locator(".item-inspect")
    .click();
  await expect(
    page.getByLabel("Teks slide sementara", { exact: true }),
  ).toHaveAttribute("readonly", "");
  const p = await output(page);
  await expect(p.locator(".slide-lines")).toHaveCount(0);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(p.locator(".scripture-footer")).toContainText("John 3:16");
  await page
    .getByRole("button", { name: "Slide sebelumnya LIVE", exact: true })
    .click();
  await expect(p.locator(".slide-lines")).toHaveText(
    "Original rehearsal song text.",
  );
  await page
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(p.locator(".scripture-footer")).toContainText("John 3:16");
  await page
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(p.locator(".scripture-footer")).toContainText("John 3:17");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Hapus terjemahan", exact: true })
    .click();
  await expect(page.getByText("Belum ada dataset Alkitab")).toBeVisible();
  await expect(page.getByTestId("schedule-item")).toHaveCount(1);
  await expect(p.locator(".slide-lines")).toHaveText(
    fixtureDataset().verses[1].text,
  );
  await p.reload();
  await expect(p.locator(".scripture-footer")).toContainText("John 3:17");
  await page.screenshot({
    path: "docs/evidence/phase4-desktop.png",
    fullPage: true,
  });
});
test("secondary tabs cannot import or delete; responsive Scripture browsing", async ({
  page,
  context,
}) => {
  await imported(page);
  const second = await context.newPage();
  await second.goto("/");
  await library(second);
  await expect(
    second.getByRole("button", { name: "Pilih file dataset", exact: true }),
  ).toBeDisabled();
  await expect(
    second.getByRole("button", { name: "Hapus terjemahan", exact: true }),
  ).toBeDisabled();
  await select(second, "John 3:16");
  await second
    .getByRole("button", { name: "Preview ayat", exact: true })
    .click();
  await expect(
    second.getByRole("button", { name: "Go Live", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Terjemahan", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "docs/evidence/phase4-mobile.png",
    fullPage: true,
  });
});

test("Scripture checkpoints require explicit offline Resume after operator restart", async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await imported(page);
  await select(page, "John 3:16");
  await page.getByRole("button", { name: "Preview ayat", exact: true }).click();
  const p = await output(page);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(p.locator(".scripture-footer")).toContainText("John 3:16");
  await expect(page.getByText(/Checkpoint tersimpan · LIVE/)).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Pemulihan presentasi" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Go Live", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Resume presentasi", exact: true })
    .click();
  const recovered = await output(page);
  await expect(recovered.locator(".slide-lines")).toHaveText(
    fixtureDataset().verses[0].text,
  );
  await expect(recovered.locator(".scripture-footer")).toContainText(
    "SYN — Original synthetic test text",
  );
  await recovered.screenshot({ path: "docs/evidence/phase4-projector.png" });
});
test("Scripture output rejects duplicate, delayed, malformed and legacy-version state messages", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    const Original = window.BroadcastChannel;
    (window as any).scriptureMessages = [];
    window.BroadcastChannel = class extends Original {
      postMessage(data: unknown) {
        (window as any).scriptureMessages.push(structuredClone(data));
        super.postMessage(data);
      }
    };
  });
  await page.reload();
  await imported(page);
  await select(page);
  await page.getByRole("button", { name: "Preview ayat", exact: true }).click();
  const p = await output(page);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(p.locator(".scripture-footer")).toContainText("John 3:16");
  const old = await page.evaluate(() =>
    (window as any).scriptureMessages
      .filter((m: any) => m.type === "STATE" && m.live)
      .at(-1),
  );
  await page
    .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
    .click();
  await expect(p.locator(".scripture-footer")).toContainText("John 3:17");
  for (const m of [
    old,
    { ...old, seq: 999, v: 1 },
    { ...old, seq: 999, live: { bad: true } },
    { ...old, nonce: "wrong-document", seq: 999 },
  ])
    await page.evaluate((m) => {
      const bc = new BroadcastChannel(`sagi-projector:${m.pair}`);
      bc.postMessage(m);
      bc.close();
    }, m);
  await expect(p.locator(".scripture-footer")).toContainText("John 3:17");
  await expect(p.locator(".slide-lines")).toHaveText(
    fixtureDataset().verses[1].text,
  );
});
test("quota refusal and corrupted stored verses preserve data and prevent partial presentation", async ({
  page,
}) => {
  await imported(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("sagi-worship", 1);
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("scripture_verses", "readwrite");
      const store = tx.objectStore("scripture_verses");
      const r = store.getAll();
      r.onsuccess = () => {
        const row = r.result[0];
        store.put({ ...row, text: "Tampered synthetic text" });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await library(page);
  await expect(page.getByRole("alert")).toContainText("Integritas");
  await page.getByLabel("Referensi ayat", { exact: true }).fill("John 3:16");
  await page
    .getByRole("button", { name: "Cari referensi", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Preview ayat", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => {
    Object.defineProperty(navigator.storage, "estimate", {
      value: async () => ({ usage: 100, quota: 101 }),
      configurable: true,
    });
  });
  const data = await signFixture();
  data.translation.edition = "2.0";
  await signFixture(data);
  await page.getByLabel("File dataset Alkitab").setInputFiles({
    name: "synthetic2.json",
    mimeType: "application/json",
    buffer: nodeBuffer.from(JSON.stringify(data)),
  });
  await page.getByLabel(attestation).check();
  await page
    .getByRole("button", { name: "Konfirmasi dan impor", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Impor dataset Alkitab" })
      .getByRole("status"),
  ).toContainText("storage tidak mencukupi");
  await expect(
    page.getByLabel("Terjemahan", { exact: true }).locator("option"),
  ).toHaveCount(1);
});

test("long exact Scripture text paginates without dropping text or attribution", async ({
  page,
}) => {
  await library(page);
  const data = fixtureDataset();
  const text =
    "  Synthetic café 👋 with exact spaces.\r\n" +
    "Original long rehearsal passage, amber lanterns and notebooks. ".repeat(
      45,
    ) +
    "\nEnd.  ";
  data.verses[0].text = text;
  await signFixture(data);
  await page.getByLabel("File dataset Alkitab").setInputFiles({
    name: "long.json",
    mimeType: "application/json",
    buffer: nodeBuffer.from(JSON.stringify(data)),
  });
  await page.getByLabel(attestation).check();
  await page
    .getByRole("button", { name: "Konfirmasi dan impor", exact: true })
    .click();
  await expect(
    page.getByText("Dataset diimpor. Seluruh ayat tersimpan offline."),
  ).toBeVisible();
  await select(page, "John 3:16");
  await page.getByRole("button", { name: "Preview ayat", exact: true }).click();
  const frames = page
    .getByRole("list", { name: "Daftar slide Preview" })
    .getByRole("listitem");
  await expect(frames.first()).toBeVisible();
  const count = await frames.count();
  expect(count).toBeGreaterThan(1);
  const p = await output(page);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  let joined = "";
  for (let i = 0; i < count; i++) {
    await expect(p.locator(".scripture-footer")).toContainText(
      `${i + 1}/${count}`,
    );
    joined += await p.locator(".slide-lines").textContent();
    if (i + 1 < count)
      await page
        .getByRole("button", { name: "Slide berikutnya LIVE", exact: true })
        .click();
  }
  expect(joined).toBe(text);
});

test("footer overflow keeps the last valid frame and cannot block emergency Black", async ({
  page,
}) => {
  await imported(page);
  await select(page, "John 3:16");
  await page.getByRole("button", { name: "Preview ayat", exact: true }).click();
  const p = await output(page);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(p.locator(".scripture-footer")).toContainText("John 3:16");
  const data = fixtureDataset();
  data.translation.name = "Overflow fixture";
  data.translation.edition = "2.0";
  data.translation.license.displayAttribution =
    "Original synthetic attribution\n".repeat(9);
  await signFixture(data);
  await page.getByLabel("File dataset Alkitab").setInputFiles({
    name: "overflow.json",
    mimeType: "application/json",
    buffer: nodeBuffer.from(JSON.stringify(data)),
  });
  await page.getByLabel(attestation).check();
  await page
    .getByRole("button", { name: "Konfirmasi dan impor", exact: true })
    .click();
  await expect(
    page.getByLabel("Terjemahan", { exact: true }).locator("option"),
  ).toHaveCount(2);
  page.once("dialog", (d) => d.accept());
  await page
    .getByLabel("Terjemahan", { exact: true })
    .selectOption({ label: "Overflow fixture · SYN (2.0)" });
  await select(page, "John 3:17");
  await page.getByRole("button", { name: "Preview ayat", exact: true }).click();
  await expect(
    page.getByLabel("Teks slide sementara", { exact: true }),
  ).toHaveValue(data.verses[1].text);
  await page.getByRole("button", { name: "Go Live", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Error");
  await expect(p.locator(".slide-lines")).toHaveText(data.verses[0].text);
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  await expect(p.getByTestId("slide-canvas")).toHaveAttribute(
    "data-mode",
    "black",
  );
});
