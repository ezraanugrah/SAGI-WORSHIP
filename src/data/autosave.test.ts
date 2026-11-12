import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import { Repository } from "./repository";
import { SongAutosave } from "./autosave";
import { songFixture, writerFixture } from "../testHelpers";
describe("validated autosave lifecycle", () => {
  let name: string, writer: ReturnType<typeof writerFixture>, repo: Repository;
  beforeEach(() => {
    name = crypto.randomUUID();
    writer = writerFixture();
    repo = new Repository(writer.gate, name);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    writer.stop();
    await deleteDB(name);
  });
  it("serializes rapid edits and stores the latest content with successive revisions", async () => {
    const input = songFixture("song");
    const saver = new SongAutosave(
      repo,
      "song",
      input,
      0,
      0,
      () => {},
      () => {},
    );
    saver.edit({ ...input, title: "First" });
    const first = saver.flush();
    saver.edit({ ...input, title: "Latest" });
    const second = saver.flush();
    await Promise.all([first, second]);
    expect((await repo.load()).songs[0].title).toBe("Latest");
    expect(saver.unsaved).toBe(false);
    saver.stop();
  });
  it("saves a song whose section label was cleared, using the section type as label", async () => {
    const input = songFixture("song");
    const saver = new SongAutosave(
      repo,
      "song",
      input,
      0,
      0,
      () => {},
      () => {},
    );
    // Clearing "Verse 1" to retype it used to fail with "Draft tidak valid".
    saver.edit({
      ...input,
      sections: input.sections.map((x) => ({ ...x, label: "" })),
    });
    await saver.flush();
    expect(saver.state.error).toBe(false);
    expect(saver.state.message).toBe("Tersimpan lokal");
    const saved = (await repo.load()).songs[0];
    expect(saved.sections[0].label).toBe(input.sections[0].type);
    expect(saver.unsaved).toBe(false);
    saver.stop();
  });
  it("says exactly what is missing while a new song is only a draft", async () => {
    const input = songFixture("song");
    const saver = new SongAutosave(
      repo,
      "song",
      input,
      0,
      0,
      () => {},
      () => {},
    );
    saver.edit({
      ...input,
      title: "",
      sections: input.sections.map((x) => ({ ...x, label: " ", text: "" })),
    });
    await saver.flush();
    expect(saver.state.error).toBe(false);
    expect(saver.state.message).toBe(
      "Draft tersimpan. Isi judul lagu dan lirik minimal satu bagian untuk menyimpan lagu.",
    );
    expect((await repo.load()).drafts).toHaveLength(1);
    saver.stop();
  });
  it("keeps incomplete edits in a recoverable draft while preserving the last valid song", async () => {
    const input = songFixture("song");
    await repo.createSong("song", input);
    const saver = new SongAutosave(
      repo,
      "song",
      input,
      1,
      0,
      () => {},
      () => {},
    );
    saver.edit({ ...input, title: "" });
    await saver.flush();
    expect((await repo.load()).songs[0].title).toBe(input.title);
    expect((await repo.load()).drafts[0].value.title).toBe("");
    expect(saver.state.message).toContain("Draft tersimpan");
    saver.edit({ ...input, title: "Recovered" });
    await saver.flush();
    expect((await repo.load()).drafts).toEqual([]);
    expect((await repo.load()).songs[0].title).toBe("Recovered");
    saver.stop();
  });
  it("reports failure, retains unsaved edits, and supports retry after a transient error", async () => {
    const input = songFixture("song");
    const saver = new SongAutosave(
      repo,
      "song",
      input,
      0,
      0,
      () => {},
      () => {},
    );
    vi.spyOn(repo, "saveDraft").mockRejectedValueOnce(new Error("disk full"));
    saver.edit(input);
    await saver.flush();
    expect(saver.state.error).toBe(true);
    expect(saver.unsaved).toBe(true);
    await saver.flush();
    expect(saver.unsaved).toBe(false);
    expect((await repo.load()).songs).toHaveLength(1);
    saver.stop();
  });
  it("does not resurrect records after deletion or save after stop", async () => {
    const input = songFixture("song");
    await repo.createSong("song", input);
    const saver = new SongAutosave(
      repo,
      "song",
      input,
      1,
      0,
      () => {},
      () => {},
    );
    saver.edit({ ...input, title: "Late" });
    await repo.deleteSong("song", 1);
    await saver.flush();
    expect(saver.state.error).toBe(true);
    expect((await repo.load()).songs).toEqual([]);
    saver.stop();
    saver.edit(input);
    await saver.flush();
    expect((await repo.load()).songs).toEqual([]);
  });
});

describe("retry after partial autosave pipeline failure", () => {
  it("reuses the same durable draft after canonical write fails", async () => {
    const name = crypto.randomUUID(),
      writer = writerFixture(),
      repo = new Repository(writer.gate, name),
      input = songFixture("song");
    const saver = new SongAutosave(
      repo,
      "song",
      input,
      0,
      0,
      () => {},
      () => {},
    );
    try {
      vi.spyOn(repo, "createSong").mockRejectedValueOnce(
        new Error("temporary failure"),
      );
      saver.edit(input);
      await saver.flush();
      expect(saver.state.error).toBe(true);
      expect((await repo.load()).drafts).toHaveLength(1);
      await saver.flush();
      expect(saver.unsaved).toBe(false);
      expect((await repo.load()).songs).toHaveLength(1);
    } finally {
      saver.stop();
      vi.restoreAllMocks();
      writer.stop();
      await deleteDB(name);
    }
  });
});

describe("debounced autosave", () => {
  it("persists through the debounce timer without an explicit save action", async () => {
    const name = crypto.randomUUID(),
      writer = writerFixture(),
      repo = new Repository(writer.gate, name),
      input = songFixture("song");
    const saver = new SongAutosave(
      repo,
      "song",
      input,
      0,
      0,
      () => {},
      () => {},
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      saver.edit(input);
      await vi.advanceTimersByTimeAsync(449);
      expect((await repo.load()).songs).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      await saver.flush();
      expect((await repo.load()).songs).toHaveLength(1);
    } finally {
      saver.stop();
      vi.useRealTimers();
      writer.stop();
      await deleteDB(name);
    }
  });
});
