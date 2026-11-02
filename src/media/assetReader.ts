import { openDB } from "idb";
import { validRef, type AssetRef } from "./models";
import { verifyPayload } from "./integrity";
/** Read-only capability bounded to the validated snapshot. Never imports WriterGate or a mutation repository. */
export async function readAsset(
  ref: AssetRef,
  allowed: readonly AssetRef[],
  name = "sagi-worship",
) {
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
