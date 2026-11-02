import { WriterGate } from "./writer";
import { diagnose, type Health } from "../recovery/diagnostics";
import { readSnapshot } from "./backupRepository";
import { snapshotHash } from "../recovery/restorePlan";
import { openDatabase } from "../db";
import { putPin, changed } from "./mediaRepository";
import { fail, checkCancel } from "../backup/models";
export class HealthRepository {
  private plans = new Map<string, Health>();
  constructor(
    private gate: WriterGate,
    private ready: () => void,
    private name = "sagi-worship",
  ) {}
  async scan(full: boolean, signal?: AbortSignal) {
    const health = await diagnose(this.name, full, signal);
    const id = crypto.randomUUID();
    this.plans.clear();
    this.plans.set(id, structuredClone(health));
    return { id, ...health };
  }
  async repair(
    scanId: string,
    findingId: string,
    confirmed: boolean,
    signal?: AbortSignal,
  ) {
    const ticket = this.gate.ticket();
    checkCancel(signal);
    this.ready();
    if (!confirmed) fail("konfirmasi repair wajib");
    const plan = this.plans.get(scanId),
      repair = plan?.findings.find((f) => f.id === findingId)?.repair;
    if (!plan?.full || !plan.valid || !repair)
      fail("repair tidak didukung tanpa dependensi terverifikasi");
    // A new full scan prevents stale repair and rechecks actual bytes.
    const fresh = await diagnose(this.name, true, signal);
    if (fresh.fingerprint !== plan.fingerprint || !fresh.valid)
      fail("data berubah; ulangi scan");
    this.gate.assert(ticket);
    checkCancel(signal);
    await this.gate.exclusive(async (permit) => {
      this.ready();
      const before = await readSnapshot(this.name);
      if ((await snapshotHash(before)) !== plan.fingerprint)
        fail("data berubah");
      const db = await openDatabase(this.name);
      const tx = db.transaction(
        ["media_assets", "backup_manifest"],
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
        await putPin(tx, repair.id, repair.refs);
        await tx.objectStore("backup_manifest").add({
          id: `phase7:repair:${crypto.randomUUID()}`,
          format: 1,
          kind: "repair",
          owner: repair.id,
          createdAt: new Date().toISOString(),
        });
        this.gate.assert(permit);
        checkCancel(signal);
        await tx.done;
        this.plans.delete(scanId);
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
