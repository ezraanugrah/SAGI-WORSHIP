import { readSnapshot } from "../data/backupRepository";
import { dependencyRoots, byStore, validateRows } from "../backup/validation";
import { snapshotHash } from "./restorePlan";
import { validAsset, validRef, type AssetRef } from "../media/models";
import { fingerprint } from "../media/integrity";
import { checkCancel } from "../backup/models";
export type Finding = {
  id: string;
  severity: "error" | "review" | "info";
  message: string;
  repair?: { id: string; refs: AssetRef[] };
};
export type Health = {
  fingerprint: string;
  findings: Finding[];
  bytes: number;
  full: boolean;
  valid: boolean;
};
export async function diagnose(
  name = "sagi-worship",
  full = false,
  signal?: AbortSignal,
): Promise<Health> {
  const rows = await readSnapshot(name),
    findings: Finding[] = [];
  let valid = true,
    bytes = 0;
  try {
    await validateRows(rows, signal, full);
  } catch (e) {
    checkCancel(signal);
    valid = false;
    findings.push({
      id: "validation",
      severity: "error",
      message: (e as Error).message,
    });
  }
  const media = byStore(rows, "media_assets");
  for (const p of media) {
    checkCancel(signal);
    if (p.id?.startsWith("blob:")) {
      bytes += p.blob?.size ?? 0;
      if (full && p.blob instanceof Blob) {
        try {
          const got = await fingerprint(p.blob, signal);
          if (got.digest !== p.digest) throw new Error("hash");
        } catch (e) {
          checkCancel(signal);
          findings.push({
            id: p.id,
            severity: "error",
            message: `Payload rusak: ${p.id}`,
          });
          valid = false;
        }
      }
    }
    if (p.kind === "pin") {
      const owner = p.id.startsWith("pin:theme:")
        ? `Tema ${byStore(rows, "themes").find((t) => `pin:theme:${t.id}` === p.id)?.name ?? p.id}`
        : p.id === "pin:checkpoint"
          ? "Checkpoint pemulihan durabel"
          : p.id.startsWith("pin:recovery:")
            ? "Kandidat recovery yang dipertahankan"
            : p.id.startsWith("pin:prepared:")
              ? "Halaman PDF yang pernah disiapkan"
              : p.id.startsWith("pin:retained:")
                ? "Dependensi arsip dipertahankan secara konservatif"
                : p.id.startsWith("pin:live:")
                  ? "Snapshot sesi LIVE (keaktifan pemilik belum terbukti)"
                  : p.id.startsWith("pin:preview:")
                    ? "Snapshot Preview"
                    : "Pin dengan pemilik yang perlu ditinjau";
      findings.push({
        id: `info:${p.id}`,
        severity: "info",
        message: `${owner} · ${p.id}: ${Array.isArray(p.refs) ? p.refs.length : "?"} aset. Sesi lama bukan bukti aman untuk dihapus.`,
      });
    }
  }
  const roots = dependencyRoots(rows);
  for (const root of roots) {
    if (!root.refs.length) continue;
    const old = media.find((p) => p.id === root.id);
    if (
      !old ||
      !Array.isArray(old.refs) ||
      root.refs.some(
        (r) =>
          !old.refs.some((p: any) => p.id === r.id && p.digest === r.digest),
      )
    ) {
      const verified =
        valid &&
        root.refs.every(
          (r) =>
            validRef(r) &&
            media.some((p) => p.id === r.id && p.digest === r.digest),
        );
      findings.push({
        id: root.id,
        severity: "error",
        message: `Pin dependensi hilang/tidak lengkap: ${root.id}`,
        ...(verified && full
          ? {
              repair: {
                id: root.id,
                refs: [
                  ...new Map(
                    [...(old?.refs ?? []), ...root.refs].map((r) => [r.id, r]),
                  ).values(),
                ],
              },
            }
          : {}),
      });
    }
  }
  const referenced = new Set<string>();
  for (const m of media) {
    if (validAsset(m)) {
      referenced.add(m.original.id);
      referenced.add(m.thumbnail.id);
    }
    if (Array.isArray((m as any).refs))
      for (const r of (m as any).refs) referenced.add(r.id);
  }
  for (const root of roots) for (const r of root.refs) referenced.add(r.id);
  for (const p of media)
    if (p.id?.startsWith("blob:") && !referenced.has(p.id))
      findings.push({
        id: p.id,
        severity: "review",
        message: `Payload tanpa pemilik yang terbukti: ${p.id}. Dipertahankan; tidak dihapus otomatis.`,
      });
  return {
    fingerprint: await snapshotHash(rows),
    findings,
    bytes,
    full,
    valid,
  };
}
