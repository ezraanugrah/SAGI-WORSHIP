import { MediaRepository } from "./mediaRepository";
import { putPin } from "./mediaRepository";
import { mediaRefs } from "../media/models";
import { openDatabase } from "../db";
import { WriterGate } from "./writer";
import {
  clone,
  validCheckpoint,
  integer,
  object,
  validStyle,
  string,
  type Checkpoint,
  type Live,
  type Style,
} from "../presentation/models";
import type { IDBPTransaction } from "idb";
export type Override = {
  id: string;
  format: 1 | 2;
  frameId: string;
  text: string;
  style: Style;
  sourceSignature: string;
  revision: number;
};
export const validOverride = (v: unknown): v is Override =>
  object(v) &&
  (v.format === 1 || v.format === 2) &&
  string(v.id, 1400) &&
  string(v.frameId, 1000) &&
  typeof v.text === "string" &&
  !!v.text.trim() &&
  v.text.length <= 30000 &&
  validStyle(v.style) &&
  string(v.sourceSignature, 2000) &&
  integer(v.revision, 1, Number.MAX_SAFE_INTEGER);
export class PresentationRepository {
  constructor(
    private gate: WriterGate,
    private name = "sagi-worship",
  ) {}
  private async write<T>(
    store: "slide_overrides" | "live_session_state",
    fn: (tx: IDBPTransaction<unknown, string[], "readwrite">) => Promise<T>,
  ) {
    const ticket = this.gate.ticket(),
      db = await openDatabase(this.name);
    let tx: IDBPTransaction<unknown, string[], "readwrite"> | undefined;
    try {
      this.gate.assert(ticket);
      tx = db.transaction(
        store === "live_session_state" ? [store, "media_assets"] : [store],
        "readwrite",
      );
      this.gate.track(tx, ticket);
      const result = await fn(tx);
      this.gate.assert(ticket);
      await tx.done;
      return result;
    } catch (e) {
      if (tx) {
        try {
          tx.abort();
        } catch {
          /* complete */
        }
        await tx.done.catch(() => {});
      }
      throw e;
    } finally {
      db.close();
    }
  }
  mediaRepository() {
    return new MediaRepository(this.gate, this.name);
  }
  async loadCheckpoint() {
    const db = await openDatabase(this.name);
    try {
      const row = await db.get("live_session_state", "phase3:checkpoint");
      if (row === undefined) return null;
      if (!validCheckpoint(row))
        throw new Error(
          "Checkpoint rusak/tidak didukung. Data asli dipertahankan.",
        );
      return row;
    } finally {
      db.close();
    }
  }
  async checkpoint(
    live: Live | null,
    sessionId: string,
    sequence: number,
    expectedRevision: number,
  ) {
    const row: Checkpoint = {
      id: "phase3:checkpoint",
      format: 4,
      revision: expectedRevision + 1,
      sessionId,
      sequence,
      live: clone(live),
      updatedAt: new Date().toISOString(),
    };
    if (!validCheckpoint(row)) throw new Error("Checkpoint tidak valid.");
    return this.write("live_session_state", async (tx) => {
      const store = tx.objectStore("live_session_state"),
        old = await store.get(row.id);
      if (old !== undefined && !validCheckpoint(old))
        throw new Error("Checkpoint rusak dipertahankan.");
      if ((old?.revision ?? 0) !== expectedRevision)
        throw new Error("Konflik checkpoint; muat ulang sebelum pemulihan.");
      if (old?.sessionId === sessionId && old.sequence > sequence)
        throw new Error("Checkpoint kedaluwarsa.");
      await putPin(tx, "pin:checkpoint", live ? mediaRefs(live.deck) : []);
      await store.put(row);
      return row;
    });
  }
  async saveOverride(
    value: Omit<Override, "revision">,
    expectedRevision: number,
  ) {
    return this.write("slide_overrides", async (tx) => {
      const store = tx.objectStore("slide_overrides"),
        old = await store.get(value.id);
      if (old !== undefined && !validOverride(old))
        throw new Error("Override rusak dipertahankan.");
      if ((old?.revision ?? 0) !== expectedRevision)
        throw new Error("Konflik revisi override. Siapkan ulang Preview.");
      const row = { ...clone(value), revision: (old?.revision ?? 0) + 1 };
      if (!validOverride(row)) throw new Error("Override tidak valid.");
      await store.put(row);
      return row;
    });
  }
  async loadOverrides() {
    const db = await openDatabase(this.name);
    try {
      const rows = await db.getAll("slide_overrides");
      return {
        values: rows.filter(validOverride),
        issues: rows
          .filter(
            (row) =>
              typeof row.id === "string" &&
              (row.id.startsWith("phase3:") || row.id.startsWith("phase6:")) &&
              !validOverride(row),
          )
          .map(() => "Override rusak dipertahankan; tidak diterapkan."),
      };
    } finally {
      db.close();
    }
  }
}
