import { describe, expect, it } from "vitest";
import { WriterGate } from "./writer";
import { writerFixture } from "../testHelpers";
describe("Web Lock lifecycle", () => {
  it("never grants writing when another window owns the lock", async () => {
    const gate = new WriterGate();
    const locks = {
      request: async (
        _name: string,
        _options: unknown,
        callback: (lock: null) => Promise<void>,
      ) => callback(null),
    } as LockManager;
    const stop = gate.start(locks);
    await Promise.resolve();
    expect(gate.active).toBe(false);
    expect(() => gate.ticket()).toThrow("hanya baca");
    stop();
  });
  it("revokes on unexpected request rejection", async () => {
    let rejectRequest!: (reason: unknown) => void;
    const gate = new WriterGate();
    const locks = {
      request: (
        _name: string,
        _options: unknown,
        callback: (lock: Lock) => Promise<void>,
      ) => {
        void callback({
          name: "sagi-workspace-writer",
          mode: "exclusive",
        } as Lock);
        return new Promise<void>((_resolve, reject) => {
          rejectRequest = reject;
        });
      },
    } as LockManager;
    const stop = gate.start(locks);
    expect(gate.active).toBe(true);
    rejectRequest(new DOMException("stolen", "AbortError"));
    await Promise.resolve();
    expect(gate.active).toBe(false);
    expect(gate.message).toContain("hilang");
    stop();
  });
  it("invalidates old authorization tickets even after a new grant", () => {
    const { gate, stop } = writerFixture();
    const ticket = gate.ticket();
    stop();
    const stopAgain = gate.start({
      request: (
        _name: string,
        _options: unknown,
        callback: (lock: Lock) => Promise<void>,
      ) =>
        callback({ name: "sagi-workspace-writer", mode: "exclusive" } as Lock),
    } as LockManager);
    expect(gate.active).toBe(true);
    expect(() => gate.assert(ticket)).toThrow();
    stopAgain();
  });
});
