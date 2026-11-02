import { type Payload, type AssetRef, LIMITS } from "./models";
const CHUNK = 4 * 1024 * 1024;
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
export async function fingerprint(blob: Blob, signal?: AbortSignal) {
  const chunks: string[] = [];
  for (let offset = 0; offset < blob.size; offset += CHUNK) {
    cancelled(signal);
    chunks.push(
      await sha(
        new Uint8Array(await blob.slice(offset, offset + CHUNK).arrayBuffer()),
      ),
    );
  }
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
export async function verifyPayload(value: unknown, ref: AssetRef) {
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
  const got = await fingerprint(p.blob);
  if (got.digest !== ref.digest || got.chunks.some((h, i) => p.chunks[i] !== h))
    throw new Error("Integritas media gagal; data dipertahankan.");
  return p.blob;
}
