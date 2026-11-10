import { openDB } from "idb";
import { validRef, type AssetRef } from "./models";
import { verifyPayload } from "./integrity";
function assertAllowed(ref: AssetRef, allowed: readonly AssetRef[]) {
  if (
    !validRef(ref) ||
    !allowed.some(
      (a) =>
        a.id === ref.id &&
        a.digest === ref.digest &&
        JSON.stringify(a) === JSON.stringify(ref),
    )
  )
    throw new Error("Aset di luar snapshot presentasi.");
}
/** Read-only capability bounded to the validated snapshot. Never imports WriterGate or a mutation repository. */
export async function readAsset(
  ref: AssetRef,
  allowed: readonly AssetRef[],
  name = "sagi-worship",
) {
  assertAllowed(ref, allowed);
  const db = await openDB(name, 1, {
    upgrade(_db, _old, _next, tx) {
      tx.abort();
    },
  });
  try {
    const tx = db.transaction("media_assets", "readonly");
    const row = await tx.store.get(ref.id);
    await tx.done;
    return await verifyPayload(row, ref);
  } finally {
    db.close();
  }
}

/**
 * Render-path cache of payloads that already passed full integrity
 * verification in this window. Payloads are immutable and addressed by their
 * digest, so the same asset does not need to be re-read and re-hashed on every
 * slide change (a large video background used to cost ~1 s per slide).
 * The snapshot boundary (`allowed`) is still checked on every call. Each
 * window keeps its own cache, so a newly opened or refreshed projector always
 * verifies again.
 */
export type VerifiedAsset = { blob: Blob; decoded: boolean };
const MAX_VERIFIED = 32;
const verified = new Map<string, VerifiedAsset>();
const key = (ref: AssetRef, name: string) => `${name}\n${JSON.stringify(ref)}`;

export async function readVerifiedAsset(
  ref: AssetRef,
  allowed: readonly AssetRef[],
  name = "sagi-worship",
): Promise<VerifiedAsset> {
  assertAllowed(ref, allowed);
  const k = key(ref, name);
  const hit = verified.get(k);
  if (hit) {
    // Refresh recency for the bounded LRU.
    verified.delete(k);
    verified.set(k, hit);
    return hit;
  }
  const entry: VerifiedAsset = {
    blob: await readAsset(ref, allowed, name),
    decoded: false,
  };
  verified.set(k, entry);
  while (verified.size > MAX_VERIFIED)
    verified.delete(verified.keys().next().value!);
  return entry;
}

/** Test helper: forget every verified payload in this window. */
export function clearVerifiedAssets() {
  verified.clear();
}
