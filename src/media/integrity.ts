import { type Payload, type AssetRef, LIMITS } from "./models";
/** Payloads are hashed (and synced) in chunks of this size. */
export const CHUNK = 4 * 1024 * 1024;
export function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Impor dibatalkan", "AbortError");
}
export async function sha(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as BufferSource),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
/**
 * Chunks read and hashed at the same time. WebCrypto hashes off the main
 * thread, so a few chunks in flight make a large video verify several times
 * faster (import, first Preview, first Go Live) with at most ~16 MiB in memory.
 */
const PARALLEL = 4;
export async function fingerprint(blob: Blob, signal?: AbortSignal) {
  const count = Math.ceil(blob.size / CHUNK),
    chunks: string[] = new Array(count);
  let next = 0,
    failed = false;
  const lane = async () => {
    while (!failed && next < count) {
      const i = next++;
      try {
        cancelled(signal);
        const part = blob.slice(i * CHUNK, (i + 1) * CHUNK);
        chunks[i] = await sha(new Uint8Array(await part.arrayBuffer()));
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, count) }, () => lane()),
  );
  cancelled(signal);
  return {
    chunks,
    digest: await sha(
      new TextEncoder().encode(JSON.stringify({ size: blob.size, chunks })),
    ),
  };
}
export async function payload(
  blob: Blob,
  signal?: AbortSignal,
): Promise<Payload> {
  if (!blob.size || blob.size > LIMITS.video)
    throw new Error("Ukuran payload tidak didukung");
  return {
    id: `blob:${crypto.randomUUID()}`,
    format: 1,
    blob,
    size: blob.size,
    mime: blob.type,
    ...(await fingerprint(blob, signal)),
  };
}
/**
 * The stored payload belongs to `ref` and its chunk list adds up to the
 * digest, without reading the file. Each chunk can then be checked on its
 * own (sync sends and receives chunk by chunk).
 */
export async function payloadMatches(value: unknown, ref: AssetRef) {
  checkShape(value, ref);
  const p = value as Payload;
  if (
    (await sha(
      new TextEncoder().encode(
        JSON.stringify({ size: p.size, chunks: p.chunks }),
      ),
    )) !== ref.digest
  )
    throw new Error("Integritas media gagal; data dipertahankan.");
  return p;
}
export async function verifyPayload(value: unknown, ref: AssetRef) {
  checkShape(value, ref);
  const p = value as Payload;
  const got = await fingerprint(p.blob);
  if (got.digest !== ref.digest || got.chunks.some((h, i) => p.chunks[i] !== h))
    throw new Error("Integritas media gagal; data dipertahankan.");
  return p.blob;
}
function checkShape(value: unknown, ref: AssetRef) {
  const p = value as Payload;
  if (
    !p ||
    p.id !== ref.id ||
    p.format !== 1 ||
    !(p.blob instanceof Blob) ||
    p.size !== ref.size ||
    p.blob.size !== ref.size ||
    p.mime !== ref.mime ||
    p.blob.type !== ref.mime ||
    p.digest !== ref.digest ||
    !Array.isArray(p.chunks) ||
    p.chunks.length !== Math.ceil(p.size / CHUNK)
  )
    throw new Error("Aset hilang/rusak; output sebelumnya dipertahankan.");
}
