import { includeSnapshotRecord } from "../backup/bookkeeping";
import { openDatabase, stores } from "../db";
import { WriterGate } from "./writer";
import { readSnapshot, type Stage } from "./backupRepository";
import {
  makePlan,
  snapshotHash,
  type RestoreMode,
  type RestorePlan,
} from "../recovery/restorePlan";
import { validateRows } from "../backup/validation";
import { checkCancel, fail, type Snapshot } from "../backup/models";
import { canonicalJSON } from "../scriptures/importFormat";
import { putPin, changed } from "./mediaRepository";
export class RestoreRepository {
  private plans = new Map<string, RestorePlan>();
  constructor(
    private gate: WriterGate,
    private ready: () => void,
    private name = "sagi-worship",
  ) {}
  async preview(stage: Stage, mode: RestoreMode) {
    this.gate.assert();
    const db = await openDatabase(this.name);
    let journal: any;
    try {
      journal = await db.get("backup_manifest", stage.name);
      if (journal?.kind !== "stage" || journal.state !== "ready")
        fail("staging belum lengkap/terdaftar");
    } finally {
      db.close();
    }
    const source = await readSnapshot(stage.name);
    if (
      source.length !== journal.count ||
      (await snapshotHash(source)) !== journal.expectedFingerprint
    )
      fail("staging berbeda dari arsip tervalidasi");
    const plan = await makePlan(
      source,
      await readSnapshot(this.name),
      mode,
      stage.name,
      this.name,
    );
    this.plans.clear();
    this.plans.set(plan.id, structuredClone(plan));
    return structuredClone(plan);
  }
  async publish(id: string, confirmed: boolean, signal?: AbortSignal) {
    if (!confirmed) fail("konfirmasi restore wajib");
    const ticket = this.gate.ticket();
    this.ready();
    const plan = this.plans.get(id);
    if (!plan) fail("preview restore tidak tersedia");
    checkCancel(signal);
    // Read and hash before the destination transaction; never perform external async work inside it.
    const source = await readSnapshot(plan.stage),
      destination = await readSnapshot(this.name);
    await validateRows(source, signal);
    await validateRows(destination, signal);
    if (
      (await snapshotHash(source)) !== plan.incomingFingerprint ||
      (await snapshotHash(destination)) !== plan.fingerprint
    )
      fail("data berubah; ulangi preview restore");
    this.gate.assert(ticket);
    await this.gate.exclusive(async (permit) => {
      this.ready();
      checkCancel(signal);
      const db = await openDatabase(this.name);
      const tx = db.transaction([...stores], "readwrite", {
        durability: "strict",
      });
      this.gate.track(tx, permit);
      const abort = () => {
        try {
          tx.abort();
        } catch {}
      };
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const current: Snapshot = [];
        for (const store of stores)
          for (const value of await tx.objectStore(store).getAll())
            if (includeSnapshotRecord(store, value))
              current.push({ store, value });
        // Synchronous canonical comparison prevents changes in the read/maintenance gap.
        const plain = (rows: Snapshot) =>
          canonicalJSON(
            rows
              .map((r) => {
                const { blob, ...v } = r.value;
                return { store: r.store, value: v };
              })
              .sort((a, b) =>
                (a.store + "|" + a.value.id).localeCompare(
                  b.store + "|" + b.value.id,
                ),
              ),
          );
        if (plain(current) !== plain(destination))
          fail("tujuan berubah setelah preview");
        for (const row of plan.rows) {
          this.gate.assert(permit);
          checkCancel(signal);
          await tx.objectStore(row.store).put(row.value);
        }
        await tx.objectStore("backup_manifest").add({
          id: `phase7:receipt:${plan.id}`,
          format: 1,
          kind: "receipt",
          stage: plan.stage,
          mode: plan.mode,
          createdAt: new Date().toISOString(),
          count: plan.rows.length,
        });
        this.gate.assert(permit);
        checkCancel(signal);
        await tx.done;
        this.plans.delete(id);
      } catch (e) {
        abort();
        await tx.done.catch(() => {});
        throw e;
      } finally {
        signal?.removeEventListener("abort", abort);
        db.close();
      }
    });
    changed();
    this.gate.revoke(
      "Restore selesai. Muat ulang aplikasi sebelum mengedit atau Resume.",
    );
  }
  async candidates() {
    const db = await openDatabase(this.name);
    try {
      return (await db.getAll("backup_manifest")).filter(
        (r) => r.kind === "candidate",
      );
    } finally {
      db.close();
    }
  }
  async activateCandidate(
    id: string,
    confirmed: boolean,
    signal?: AbortSignal,
  ) {
    const ticket = this.gate.ticket();
    checkCancel(signal);
    if (!confirmed) fail("konfirmasi kandidat wajib");
    this.ready();
    const rows = await readSnapshot(this.name);
    await validateRows(rows, signal);
    const candidate = rows.find(
      (r) => r.store === "backup_manifest" && r.value.id === id,
    )?.value;
    if (!candidate) fail("kandidat tidak tersedia");
    const checkpoint = structuredClone(candidate.checkpoint);
    const old = rows.find((r) => r.store === "live_session_state")?.value;
    // Existing valid recovery remains preserved as another candidate, never silently lost.
    checkpoint.revision = (old?.revision ?? 0) + 1;
    checkpoint.sessionId = crypto.randomUUID();
    checkpoint.sequence = 0;
    if (checkpoint.live?.playback) {
      checkpoint.live.playback.paused = true;
      delete checkpoint.live.playback.target;
    }
    if (checkpoint.live?.backgroundPlayback) {
      checkpoint.live.backgroundPlayback.paused = true;
      delete checkpoint.live.backgroundPlayback.target;
    }
    const { mediaRefs } = await import("../media/models");
    const refs = checkpoint.live ? mediaRefs(checkpoint.live.deck) : [];
    this.gate.assert(ticket);
    checkCancel(signal);
    await this.gate.exclusive(async (permit) => {
      this.ready();
      const db = await openDatabase(this.name);
      const tx = db.transaction(
        ["backup_manifest", "live_session_state", "media_assets"],
        "readwrite",
      );
      this.gate.track(tx, permit);
      const abort = () => {
        try {
          tx.abort();
        } catch {}
      };
      signal?.addEventListener("abort", abort, { once: true });
      try {
        checkCancel(signal);
        const actual = await tx
          .objectStore("live_session_state")
          .get("phase3:checkpoint");
        if (canonicalJSON(actual ?? null) !== canonicalJSON(old ?? null))
          fail("checkpoint berubah");
        const actualCandidate = await tx.objectStore("backup_manifest").get(id);
        if (canonicalJSON(actualCandidate) !== canonicalJSON(candidate))
          fail("kandidat berubah");
        if (old?.live) {
          const retainedId = `phase7:candidate:${crypto.randomUUID()}`;
          await tx.objectStore("backup_manifest").add({
            id: retainedId,
            format: 1,
            kind: "candidate",
            checkpoint: old,
            createdAt: new Date().toISOString(),
          });
          await putPin(
            tx,
            `pin:recovery:${retainedId}`,
            mediaRefs(old.live.deck),
          );
        }
        await putPin(tx, "pin:checkpoint", refs);
        await tx.objectStore("live_session_state").put(checkpoint);
        this.gate.assert(permit);
        checkCancel(signal);
        await tx.done;
      } catch (e) {
        try {
          tx.abort();
        } catch {}
        await tx.done.catch(() => {});
        throw e;
      } finally {
        signal?.removeEventListener("abort", abort);
        db.close();
      }
    });
    changed();
  }
}
