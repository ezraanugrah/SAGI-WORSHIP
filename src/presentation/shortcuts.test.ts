import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { songFixture, writerFixture } from "../testHelpers";
import { Repository } from "../data/repository";
import { PresentationRepository } from "../data/presentationRepository";
import { PresentationController } from "./controller";
import { validMessage, type Message } from "./protocol";
import { RecentCommands, commandForKey, liveCommands } from "./shortcuts";
import type { Measure } from "./layout";
import type { Style } from "./models";

describe("LIVE shortcut keys", () => {
  it("maps arrows, Space, presentation-clicker page keys, B/. and C", () => {
    expect(commandForKey("arrowright")).toBe("next");
    expect(commandForKey(" ")).toBe("next");
    expect(commandForKey("pagedown")).toBe("next");
    expect(commandForKey("arrowleft")).toBe("previous");
    expect(commandForKey("pageup")).toBe("previous");
    expect(commandForKey("b")).toBe("black");
    expect(commandForKey(".")).toBe("black");
    expect(commandForKey("c")).toBe("clearText");
    for (const key of ["enter", "escape", "a", "arrowup", "tab"])
      expect(commandForKey(key)).toBeNull();
  });
});

describe("projector COMMAND message", () => {
  const base: Message = {
    session: "s",
    epoch: "e",
    pair: "p",
    v: 4,
    nonce: "n",
    seq: 3,
    type: "COMMAND",
    command: "next",
    commandId: "key-1",
  };
  it("accepts every LIVE command on protocol v4", () => {
    for (const command of liveCommands)
      expect(validMessage({ ...base, command })).toBe(true);
  });
  it("rejects unknown commands, missing ids, older protocol versions and stray command fields", () => {
    expect(validMessage({ ...base, command: "goLive" })).toBe(false);
    expect(validMessage({ ...base, command: undefined })).toBe(false);
    expect(validMessage({ ...base, commandId: undefined })).toBe(false);
    expect(validMessage({ ...base, commandId: "x".repeat(161) })).toBe(false);
    expect(validMessage({ ...base, v: 3 })).toBe(false);
    expect(validMessage({ ...base, type: "PONG" })).toBe(false);
    const {
      command: _command,
      commandId: _id,
      ...pong
    } = { ...base, type: "PONG" as const };
    expect(validMessage(pong)).toBe(true);
    expect(validMessage({ ...pong, commandId: "key-1" })).toBe(false);
  });
  it("applies a command delivered over both transport channels only once", () => {
    const recent = new RecentCommands(3);
    expect(recent.accept("a")).toBe(true);
    expect(recent.accept("a")).toBe(false);
    expect(recent.accept("b")).toBe(true);
    expect(recent.accept("c")).toBe(true);
    expect(recent.accept("d")).toBe(true);
    // The window stays bounded; very old ids are forgotten.
    expect(recent.accept("a")).toBe(true);
    expect(recent.accept("d")).toBe(false);
  });
});

describe("controller.command applies shortcuts safely", () => {
  const style: Style = {
    font: "Arial",
    fontSize: 64,
    safeMargin: 8,
    theme: "black",
    lines: 6,
  };
  const measure: Measure = (text, s) => Array.from(text).length * s.fontSize * 0.6;
  let name: string,
    writer: ReturnType<typeof writerFixture>,
    repo: Repository,
    controller: PresentationController;
  beforeEach(async () => {
    name = crypto.randomUUID();
    writer = writerFixture();
    repo = new Repository(writer.gate, name);
    controller = new PresentationController(
      writer.gate,
      new PresentationRepository(writer.gate, name),
      measure,
    );
    await controller.loadRecovery();
    const input = songFixture("song");
    input.sections.push({
      ...input.sections[0],
      id: "chorus",
      type: "Chorus",
      label: "Chorus",
      text: "Original chorus for shortcut tests.",
    });
    input.order = [input.sections[0].id, "chorus"];
    await repo.createSong("song", input);
  });
  afterEach(async () => {
    await controller.settled();
    writer.stop();
    await deleteDB(name);
  });

  it("does nothing before LIVE exists", async () => {
    await controller.prepare(
      await repo.load(),
      { kind: "song", songId: "song" },
      style,
    );
    const before = controller.snapshot();
    controller.command("next");
    controller.command("black");
    expect(controller.snapshot().live).toBeNull();
    expect(controller.snapshot().sequence).toBe(before.sequence);
  });

  it("navigates and toggles Black / Clear Text like the LIVE buttons", async () => {
    await controller.prepare(
      await repo.load(),
      { kind: "song", songId: "song" },
      style,
    );
    controller.goLive();
    controller.command("next");
    expect(controller.snapshot().live?.index).toBe(1);
    controller.command("next");
    expect(controller.snapshot().live?.index).toBe(1);
    controller.command("previous");
    expect(controller.snapshot().live?.index).toBe(0);
    controller.command("black");
    expect(controller.snapshot().live?.mode).toBe("black");
    controller.command("black");
    expect(controller.snapshot().live?.mode).toBe("normal");
    controller.command("clearText");
    expect(controller.snapshot().live?.mode).toBe("clearText");
  });

  it("reports instead of throwing when write authority is lost", async () => {
    await controller.prepare(
      await repo.load(),
      { kind: "song", songId: "song" },
      style,
    );
    controller.goLive();
    await controller.settled();
    writer.gate.revoke();
    expect(() => controller.command("next")).not.toThrow();
    expect(controller.snapshot().live?.index).toBe(0);
    expect(controller.snapshot().error).toMatch(/hanya baca/);
  });
});
