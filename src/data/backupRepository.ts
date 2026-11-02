import { snapshotHash } from "../recovery/restorePlan";
import { includeSnapshotRecord } from "../backup/bookkeeping";
import { verifyArchive } from "../backup/workerClient";
import { deleteDB } from "idb";
import { openDatabase, stores } from "../db";
import { WriterGate } from "./writer";
import { encodeArchive } from "../backup/container";
import { validateRows, portableRows } from "../backup/validation";
import {
  checkCancel,
  fail,
  type Snapshot,
  type Manifest,
} from "../backup/models";
export async function readSnapshot(name = "sagi-worship"): Promise<Snapshot> {
  const db = await openDatabase(name);
  try {
    const tx = db.transaction([...stores], "readonly");
    const lists = await Promise.all(
      stores.map(async (store) =>
        (await tx.objectStore(store).getAll())
          .filter((v) => includeSnapshotRecord(store, v))
          .map((value) => ({ store, value })),
      ),
    );
    await tx.done;
    return lists.flat();
  } finally {
    db.close();
  }
}
export class BackupRepository {
  constructor(
    readonly gate: WriterGate,
    readonly name = "sagi-worship",
  ) {}
  async create(signal?: AbortSignal) {
    // Read-only, consistent durable snapshot; no checkpoint flush or LIVE mutation.
    const rows = await readSnapshot(this.name);
    await validateRows(rows, signal);
    const portable = portableRows(rows);
    await validateRows(portable.rows, signal);
    return encodeArchive(portable.rows, portable.omissions, signal);
  }
  async verify(
    file: Blob,
    signal?: AbortSignal,
    progress?: (done: number, total: number) => void,
  ) {
    const archive = await verifyArchive(file, signal);
    progress?.(1, 1);
    return archive;
  }
  async stage(file: Blob, signal?: AbortSignal) {
    const ticket = this.gate.ticket();
    const archive = await this.verify(file, signal);
    this.gate.assert(ticket);
    checkCancel(signal);
    const stage = `sagi-phase7-stage-${crypto.randomUUID()}`;
    const expectedFingerprint = await snapshotHash(archive.rows);
    // A workspace journal makes abandoned stages discoverable without enumerating/deleting arbitrary DBs.
    const db = await openDatabase(this.name);
    try {
      const tx = db.transaction("backup_manifest", "readwrite");
      this.gate.track(tx, ticket);
      await tx.store.add({
        id: stage,
        format: 1,
        kind: "stage",
        state: "preparing",
        expectedFingerprint,
        count: archive.rows.length,
        manifestId: archive.manifest.id,
        createdAt: new Date().toISOString(),
      });
      this.gate.assert(ticket);
      await tx.done;
    } finally {
      db.close();
    }
    const staged = await openDatabase(stage);
    try {
      for (let start = 0; start < archive.rows.length; start += 512) {
        this.gate.assert(ticket);
        checkCancel(signal);
        const tx = staged.transaction([...stores], "readwrite");
        this.gate.track(tx, ticket);
        try {
          for (const row of archive.rows.slice(start, start + 512))
            await tx.objectStore(row.store).add(row.value);
          this.gate.assert(ticket);
          checkCancel(signal);
          await tx.done;
        } catch (e) {
          try {
            tx.abort();
          } catch {}
          await tx.done.catch(() => {});
          throw e;
        }
      }
      this.gate.assert(ticket);
      checkCancel(signal);
      const workspace = await openDatabase(this.name);
      try {
        const tx = workspace.transaction("backup_manifest", "readwrite");
        this.gate.track(tx, ticket);
        const row = await tx.store.get(stage);
        if (row?.state !== "preparing") fail("journal staging berubah");
        await tx.store.put({ ...row, state: "ready" });
        this.gate.assert(ticket);
        checkCancel(signal);
        await tx.done;
      } finally {
        workspace.close();
      }
      return { name: stage, manifest: archive.manifest };
    } finally {
      staged.close();
    }
  }
  async stages() {
    const db = await openDatabase(this.name);
    try {
      return (await db.getAll("backup_manifest")).filter(
        (v) => v.kind === "stage",
      );
    } finally {
      db.close();
    }
  }
  async removeStage(name: string) {
    const ticket = this.gate.ticket();
    if (!/^sagi-phase7-stage-[a-f0-9-]{36}$/.test(name))
      fail("nama staging tidak valid");
    const db = await openDatabase(this.name);
    try {
      const old = await db.get("backup_manifest", name);
      if (old?.kind !== "stage") fail("staging tidak terdaftar");
      this.gate.assert(ticket);
      await deleteDB(name, {
        blocked() {
          /* Kept journal permits retry; never touch another database. */
        },
      });
      this.gate.assert(ticket);
      const tx = db.transaction("backup_manifest", "readwrite");
      this.gate.track(tx, ticket);
      await tx.store.delete(name);
      this.gate.assert(ticket);
      await tx.done;
    } finally {
      db.close();
    }
  }
}
export type Stage = { name: string; manifest: Manifest };
