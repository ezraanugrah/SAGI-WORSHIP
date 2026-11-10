import "fake-indexeddb/auto";
import { beforeEach, afterEach, it, expect } from "vitest";
import { deleteDB } from "idb";
import { writerFixture } from "../testHelpers";
import { openDatabase } from "../db";
import { MediaRepository } from "../data/mediaRepository";
import { payload } from "./integrity";
import {
  clearVerifiedAssets,
  readAsset,
  readVerifiedAsset,
} from "./assetReader";
import type { AssetRef } from "./models";

let name: string,
  writer: ReturnType<typeof writerFixture>,
  repo: MediaRepository;

async function imported(suffix: string) {
  const p = await payload(
      new Blob([`verified image ${suffix}`], { type: "image/png" }),
    ),
    t = await payload(
      new Blob([`verified thumbnail ${suffix}`], { type: "image/png" }),
    );
  const ref = (v: typeof p): AssetRef => ({
    id: v.id,
    digest: v.digest,
    mime: v.mime,
    size: v.size,
    width: 1,
    height: 1,
    kind: "image",
  });
  return repo.import({
    asset: {
      id: `meta:${crypto.randomUUID()}`,
      format: 1 as const,
      revision: 1 as const,
      title: `Verified ${suffix}`,
      filename: "verified.png",
      kind: "image" as const,
      original: ref(p),
      thumbnail: ref(t),
      pages: 1,
      createdAt: new Date().toISOString(),
      compatibility: "Synthetic unit fixture",
    },
    payloads: [p, t],
  });
}
async function tamper(id: string) {
  const db = await openDatabase(name),
    row = await db.get("media_assets", id);
  await db.put("media_assets", {
    ...row,
    blob: new Blob(["tampered"], { type: "image/png" }),
  });
  db.close();
  return row;
}

beforeEach(() => {
  clearVerifiedAssets();
  name = `verified-asset-${crypto.randomUUID()}`;
  writer = writerFixture();
  repo = new MediaRepository(writer.gate, name);
});
afterEach(async () => {
  clearVerifiedAssets();
  writer.stop();
  await deleteDB(name);
});

it("verifies a payload once per window and then skips re-reading storage on later slides", async () => {
  const a = await imported("a");
  const first = await readVerifiedAsset(a.original, [a.original], name);
  expect(first.blob.size).toBe(a.original.size);
  await tamper(a.original.id);
  // The uncached reader still detects the change in storage…
  await expect(readAsset(a.original, [a.original], name)).rejects.toThrow(
    "rusak",
  );
  // …but the render path reuses the payload it already verified.
  const again = await readVerifiedAsset(a.original, [a.original], name);
  expect(again).toBe(first);
  expect(again.blob).toBe(first.blob);
});

it("enforces the presentation snapshot boundary even when the payload is cached", async () => {
  const a = await imported("b");
  await readVerifiedAsset(a.original, [a.original], name);
  await expect(readVerifiedAsset(a.original, [], name)).rejects.toThrow(
    "snapshot",
  );
  await expect(
    readVerifiedAsset(a.original, [{ ...a.original, width: 2 }], name),
  ).rejects.toThrow("snapshot");
});

it("never caches a payload that failed verification", async () => {
  const a = await imported("c");
  const original = await tamper(a.original.id);
  await expect(
    readVerifiedAsset(a.original, [a.original], name),
  ).rejects.toThrow("rusak");
  const db = await openDatabase(name);
  await db.put("media_assets", original);
  db.close();
  const ok = await readVerifiedAsset(a.original, [a.original], name);
  expect(ok.blob.size).toBe(a.original.size);
  expect(ok.decoded).toBe(false);
});

it("remembers a successful decode so later slides skip the decode probe", async () => {
  const a = await imported("d");
  const entry = await readVerifiedAsset(a.original, [a.original], name);
  entry.decoded = true;
  expect(
    (await readVerifiedAsset(a.original, [a.original], name)).decoded,
  ).toBe(true);
});

it("keeps the cache bounded and re-verifies evicted payloads", async () => {
  const first = await imported("e0");
  await readVerifiedAsset(first.original, [first.original], name);
  for (let i = 1; i <= 32; i++) {
    const next = await imported(`e${i}`);
    await readVerifiedAsset(next.original, [next.original], name);
  }
  await tamper(first.original.id);
  // The oldest entry was evicted, so the tampered storage is read and rejected.
  await expect(
    readVerifiedAsset(first.original, [first.original], name),
  ).rejects.toThrow("rusak");
});
