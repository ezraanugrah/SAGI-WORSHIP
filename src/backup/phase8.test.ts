import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { deleteDB } from "idb";
import { writerFixture } from "../testHelpers";
import { fixtureDataset, preparedFixture } from "../scriptures/testFixtures";
import { ScriptureRepository } from "../data/scriptureRepository";
import { PresentationRepository } from "../data/presentationRepository";
import { BackupRepository, readSnapshot } from "../data/backupRepository";
import { RestoreRepository } from "../data/restoreRepository";
import { Repository } from "../data/repository";
import { openDatabase } from "../db";
import { generateSlides } from "../presentation/generateSlides";
import { decodeArchive } from "./container";
import { canonicalJSON, sha256 } from "../scriptures/importFormat";
const names: string[] = [];
const writers: ReturnType<typeof writerFixture>[] = [];
const database = () => {
  const name = `phase8-${crypto.randomUUID()}`;
  names.push(name);
  return name;
};
afterEach(async () => {
  writers.splice(0).forEach((w) => w.stop());
  await Promise.all(names.splice(0).map((name) => deleteDB(name)));
});
it.each([false, true])(
  "real deleted-source Scripture checkpoint and candidate obey export=%s, preserving Unicode and attribution",
  async (exportable) => {
    const name = database(),
      destination = database(),
      w = writerFixture();
    writers.push(w);
    const data = fixtureDataset();
    data.translation.license.permissions.export = exportable;
    data.verses[0].text =
      "Synthetic: Damai café e\u0301 — 漢字 Ελληνικά 😀. ".repeat(20);
    const scriptures = new ScriptureRepository(w.gate, name);
    const translation = await scriptures.importDataset(
      await preparedFixture(data),
      true,
    );
    const verses = await scriptures.chapter(translation.id, "John", 3);
    const selection = {
      datasetId: translation.id,
      checksum: translation.contentHash,
      verseIds: [verses[0].id],
      label: "Synthetic reference",
    };
    const workspace = await new Repository(w.gate, name).load();
    workspace.scriptureSnapshots = {
      standalone: await scriptures.resolve(selection),
    };
    const { deck } = await generateSlides(
      workspace,
      { kind: "scripture", selection },
      { font: "Arial", fontSize: 64, safeMargin: 8, theme: "black", lines: 3 },
      (text) => [...text].length * 32,
    );
    expect(deck.frames.length).toBeGreaterThan(1);
    expect(deck.pages.map((p) => p.text).join("")).toBe(data.verses[0].text);
    expect(
      deck.frames.every(
        (f) =>
          f.scripture?.attribution ===
          data.translation.license.displayAttribution,
      ),
    ).toBe(true);
    await new PresentationRepository(w.gate, name).checkpoint(
      { deck, index: 0, mode: "black" },
      "old-session",
      1,
      0,
    );
    const db = await openDatabase(name);
    const checkpoint = await db.get("live_session_state", "phase3:checkpoint");
    await db.put("backup_manifest", {
      id: "phase7:candidate:scripture-test",
      format: 1,
      kind: "candidate",
      checkpoint,
      createdAt: new Date().toISOString(),
    });
    db.close();
    await scriptures.deleteDataset(translation.id, translation.contentHash);
    expect(
      (await readSnapshot(name)).some(
        (r) => r.store === "scripture_translations",
      ),
    ).toBe(false);
    const backup = new BackupRepository(w.gate, name),
      archive = await backup.create();
    const verified = await backup.verify(archive.blob);
    expect(archive.manifest.complete).toBe(exportable);
    expect(verified.rows.some((r) => r.store === "live_session_state")).toBe(
      exportable,
    );
    expect(verified.rows.some((r) => r.store === "backup_manifest")).toBe(
      exportable,
    );
    if (!exportable) {
      expect(await archive.blob.text()).not.toContain("Damai café");
      expect(archive.manifest.omissions).toHaveLength(2);
    } else {
      const stage = await new BackupRepository(w.gate, destination).stage(
        archive.blob,
      );
      names.push(stage.name);
      const restore = new RestoreRepository(w.gate, () => {}, destination);
      await restore.publish((await restore.preview(stage, "fresh")).id, true);
      const recovered = await new PresentationRepository(
        w.gate,
        destination,
      ).loadCheckpoint();
      expect(recovered?.live?.deck.pages.map((p) => p.text).join("")).toBe(
        data.verses[0].text,
      );
      expect(recovered?.sessionId).not.toBe("old-session");
    }
  },
);
it("archive manifest offset/order violations fail despite recomputed manifest integrity", async () => {
  const { encodeArchive } = await import("./container");
  const archive = await encodeArchive([
    { store: "settings", value: { id: "phase2:active-schedule", value: null } },
  ]);
  const bytes = new Uint8Array(await archive.blob.arrayBuffer());
  const size = new DataView(bytes.buffer).getUint32(8, true);
  const manifest = JSON.parse(
    new TextDecoder().decode(bytes.slice(12, 12 + size)),
  );
  manifest.entries[0].offset = 1;
  const json = new TextEncoder().encode(canonicalJSON(manifest)),
    header = bytes.slice(0, 12);
  new DataView(header.buffer).setUint32(8, json.length, true);
  const forged = new Blob([
    header,
    json,
    bytes.slice(12 + size, -72),
    await sha256(json),
    "SAGIEND1",
  ]);
  await expect(decodeArchive(forged)).rejects.toThrow("entry");
  await expect(
    decodeArchive(new Blob([archive.blob, "trailing"])),
  ).rejects.toThrow("panjang");
});
