import { canonicalJSON, sha256 } from "../scriptures/importFormat";
import { stores } from "../db";
import {
  LIMITS,
  checkCancel,
  fail,
  hashPattern,
  type Entry,
  type Manifest,
  type Archive,
  type Snapshot,
} from "./models";
const MAGIC = new TextEncoder().encode("SAGIBAK1");
const END = new TextEncoder().encode("SAGIEND1");
const encoder = new TextEncoder();
function safeJSON(bytes: Uint8Array): any {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const value = JSON.parse(text, (key, value) => {
    if (["__proto__", "prototype", "constructor"].includes(key))
      fail("key berbahaya");
    return value;
  });
  if (canonicalJSON(value) !== text)
    fail("JSON harus canonical; field duplikat/ambigu ditolak");
  return value;
}
function exact(value: any, keys: string[]) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((k) => Object.hasOwn(value, k))
  );
}
export async function encodeArchive(
  rows: Snapshot,
  omissions: string[] = [],
  signal?: AbortSignal,
) {
  const entries: Entry[] = [],
    parts: BlobPart[] = [];
  let offset = 0,
    metadata = 0,
    payloads = 0;
  if (rows.length > LIMITS.records) fail("batas jumlah record");
  const append = async (
    row: Snapshot[number],
    bytes: Blob,
    kind: Entry["kind"],
    index?: number,
  ) => {
    checkCancel(signal);
    if (bytes.size > (kind === "chunk" ? LIMITS.chunk : LIMITS.record))
      fail("entry melebihi batas");
    const hash = await sha256(new Uint8Array(await bytes.arrayBuffer()));
    entries.push({
      store: row.store,
      id: row.value.id,
      offset,
      length: bytes.size,
      hash,
      kind,
      ...(index === undefined ? {} : { index }),
    });
    parts.push(bytes);
    offset += bytes.size;
    if (offset > LIMITS.archive) fail("batas arsip 2 GiB");
  };
  for (const row of rows) {
    checkCancel(signal);
    const { blob, ...record } = row.value;
    const bytes = new Blob([
      encoder.encode(canonicalJSON(JSON.parse(JSON.stringify(record)))),
    ]);
    metadata += bytes.size;
    if (metadata > LIMITS.metadata) fail("metadata melebihi 64 MiB");
    await append(row, bytes, "json");
    if (blob !== undefined) {
      if (!(blob instanceof Blob) || ++payloads > LIMITS.payloads)
        fail("payload tidak valid/terlalu banyak");
      for (
        let start = 0, index = 0;
        start < blob.size;
        start += LIMITS.chunk, index++
      )
        await append(
          row,
          blob.slice(start, start + LIMITS.chunk),
          "chunk",
          index,
        );
    }
  }
  const manifest: Manifest = {
    format: "sagi-backup",
    version: 1,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    appVersion: "0.7.0",
    entries,
    bytes: offset,
    complete: !omissions.length,
    omissions,
  };
  const json = encoder.encode(canonicalJSON(manifest));
  if (json.length > LIMITS.manifest) fail("manifest terlalu besar");
  const header = new Uint8Array(12);
  header.set(MAGIC);
  new DataView(header.buffer).setUint32(8, json.length, true);
  const result = new Blob(
    [header, json, ...parts, encoder.encode(await sha256(json)), END],
    { type: "application/octet-stream" },
  );
  if (result.size > LIMITS.archive) fail("arsip melebihi 2 GiB");
  return { blob: result, manifest };
}
export async function decodeArchive(
  file: Blob,
  signal?: AbortSignal,
  progress?: (done: number, total: number) => void,
): Promise<Archive> {
  checkCancel(signal);
  if (file.size < 84 || file.size > LIMITS.archive)
    fail("ukuran arsip tidak didukung");
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!MAGIC.every((b, i) => head[i] === b))
    fail("format/versi tidak didukung");
  const length = new DataView(head.buffer).getUint32(8, true);
  if (length > LIMITS.manifest || 12 + length + 72 > file.size)
    fail("manifest terpotong/berlebihan");
  const bytes = new Uint8Array(await file.slice(12, 12 + length).arrayBuffer());
  const m = safeJSON(bytes) as Manifest;
  if (
    !exact(m, [
      "format",
      "version",
      "id",
      "createdAt",
      "appVersion",
      "entries",
      "bytes",
      "complete",
      "omissions",
    ]) ||
    m.format !== "sagi-backup" ||
    m.version !== 1 ||
    typeof m.id !== "string" ||
    m.id.length > 160 ||
    !Number.isFinite(Date.parse(m.createdAt)) ||
    typeof m.appVersion !== "string" ||
    m.appVersion.length > 50 ||
    !Array.isArray(m.entries) ||
    m.entries.length > LIMITS.records + LIMITS.payloads * 64 ||
    !Number.isSafeInteger(m.bytes) ||
    m.bytes < 0 ||
    typeof m.complete !== "boolean" ||
    !Array.isArray(m.omissions) ||
    m.omissions.length > LIMITS.records ||
    !m.omissions.every((x) => typeof x === "string" && x.length <= 1000) ||
    m.complete !== !m.omissions.length
  )
    fail("manifest tidak valid");
  if (12 + length + m.bytes + 72 !== file.size)
    fail("panjang arsip tidak cocok");
  const tail = new Uint8Array(await file.slice(-72).arrayBuffer());
  if (
    !END.every((b, i) => tail[64 + i] === b) ||
    new TextDecoder().decode(tail.slice(0, 64)) !== (await sha256(bytes))
  )
    fail("arsip tidak lengkap/hash manifest gagal");
  const rows: Snapshot = [],
    blobs = new Map<string, Blob[]>();
  let offset = 0,
    metadata = 0,
    payloads = 0;
  const seen = new Set<string>();
  for (let n = 0; n < m.entries.length; n++) {
    checkCancel(signal);
    const e = m.entries[n];
    if (
      !exact(
        e,
        e.kind === "chunk"
          ? ["store", "id", "offset", "length", "hash", "kind", "index"]
          : ["store", "id", "offset", "length", "hash", "kind"],
      ) ||
      !stores.includes(e.store) ||
      typeof e.id !== "string" ||
      !e.id.length ||
      e.id.length > 2000 ||
      !Number.isSafeInteger(e.offset) ||
      e.offset !== offset ||
      !Number.isSafeInteger(e.length) ||
      e.length < 1 ||
      !hashPattern.test(e.hash) ||
      !["json", "chunk"].includes(e.kind) ||
      e.length > (e.kind === "chunk" ? LIMITS.chunk : LIMITS.record) ||
      offset + e.length > m.bytes
    )
      fail("entry tidak valid/berlebihan");
    const part = file.slice(
      12 + length + offset,
      12 + length + offset + e.length,
    );
    const raw = new Uint8Array(await part.arrayBuffer());
    if ((await sha256(raw)) !== e.hash)
      fail(`integritas gagal: ${e.store}/${e.id}`);
    const key = e.store + "|" + e.id;
    if (e.kind === "json") {
      metadata += e.length;
      if (
        metadata > LIMITS.metadata ||
        rows.length >= LIMITS.records ||
        seen.has(key)
      )
        fail("record duplikat/berlebihan");
      seen.add(key);
      const value = safeJSON(raw);
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        value.id !== e.id ||
        Object.hasOwn(value, "blob")
      )
        fail("record tidak valid");
      rows.push({ store: e.store, value });
      if (e.store === "media_assets" && e.id.startsWith("blob:")) {
        if (++payloads > LIMITS.payloads) fail("payload berlebihan");
        blobs.set(key, []);
      }
    } else {
      const chunks = blobs.get(key);
      const last = rows[rows.length - 1];
      if (
        !chunks ||
        e.index !== chunks.length ||
        last?.store !== e.store ||
        last?.value.id !== e.id
      )
        fail("chunk tanpa pemilik/urutan rusak");
      chunks.push(part);
    }
    offset += e.length;
    progress?.(n + 1, m.entries.length);
  }
  if (offset !== m.bytes) fail("data tidak lengkap");
  for (const row of rows) {
    const chunks = blobs.get(row.store + "|" + row.value.id);
    if (chunks) row.value.blob = new Blob(chunks, { type: row.value.mime });
  }
  return { manifest: m, rows };
}
