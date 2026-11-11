// Shared helpers for writing SAGI Scripture v1 datasets.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const root = join(import.meta.dirname, "..", "..");

// Same algorithm as canonicalJSON/sha256 in src/scriptures/importFormat.ts.
export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/** Signs the dataset and writes public/scriptures/<name>.json. */
export async function writeDataset(name, translation, books, verses) {
  const body = { format: "sagi-scripture", version: 1, translation, books, verses };
  const dataset = {
    ...body,
    integrity: { algorithm: "SHA-256", contentHash: sha256(canonicalJSON(body)) },
  };
  const json = JSON.stringify(dataset);
  await mkdir(join(root, "public", "scriptures"), { recursive: true });
  await writeFile(join(root, "public", "scriptures", `${name}.json`), json);
  console.log(
    `${name}.json: ${books.length} books, ${books.reduce((n, b) => n + b.chapters.length, 0)} chapters, ${verses.length} verses, ${(json.length / 1048576).toFixed(1)} MiB, sha256 ${dataset.integrity.contentHash}`,
  );
}
