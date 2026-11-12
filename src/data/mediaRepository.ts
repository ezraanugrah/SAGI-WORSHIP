import { operationalRecord } from "../backup/bookkeeping";
import { validTheme, backgroundRefs } from "../themes/models";
import { validCheckpoint } from "../presentation/models";
import { openPdf, renderPdfPage } from "../media/pdfAdapter";
import { type IDBPTransaction } from "idb";
import { openDatabase } from "../db";
import { WriterGate } from "./writer";
import {
  validAsset,
  validRef,
  validSelection,
  mediaRefs,
  LIMITS,
  type MediaAsset,
  type AssetRef,
  type MediaSelection,
  type MediaSnapshot,
  type Payload,
} from "../media/models";
import {
  cancelled,
  verifyPayload,
  payload,
  payloadMatches,
} from "../media/integrity";
import type { PreparedMedia } from "../media/importCoordinator";
import {
  validSchedule,
  validItem,
  type MediaScheduleItem,
  type Workspace,
} from "../domain/models";
import type { Deck } from "../presentation/models";
import { readAsset, readVerifiedAsset } from "../media/assetReader";
export function changed() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("sagi-library-changed"));
  try {
    const c = new BroadcastChannel("sagi-library-changes");
    c.postMessage("changed");
    c.close();
  } catch {
    /* focus reload */
  }
}
export const metadataRange = () => IDBKeyRange.bound("meta:", "meta:\uffff");
export async function putPin(
  tx: IDBPTransaction<unknown, string[], "readwrite">,
  id: string,
  refs: AssetRef[],
) {
  const unique = [...new Map(refs.map((r) => [r.id, r])).values()];
  for (const r of unique) {
    if (!validRef(r)) throw new Error("Pin media tidak valid");
    const p = await tx.objectStore("media_assets").get(r.id);
    if (!p || p.digest !== r.digest || p.size !== r.size)
      throw new Error("Media snapshot hilang/rusak");
  }
  await tx.objectStore("media_assets").put({
    id,
    format: 1,
    kind: "pin",
    refs: unique,
    createdAt: new Date().toISOString(),
  });
}
export class MediaRepository {
  constructor(
    private gate: WriterGate,
    private name = "sagi-worship",
  ) {}
  private async write<T>(
    stores: string[],
    fn: (tx: IDBPTransaction<unknown, string[], "readwrite">) => Promise<T>,
    signal?: AbortSignal,
    ticket = this.gate.ticket(),
  ) {
    this.gate.assert(ticket);
    cancelled(signal);
    const db = await openDatabase(this.name);
    let tx: IDBPTransaction<unknown, string[], "readwrite"> | undefined;
    const abort = () => {
      try {
        tx?.abort();
      } catch {
        /* completed */
      }
    };
    try {
      this.gate.assert(ticket);
      cancelled(signal);
      tx = db.transaction(stores, "readwrite");
      this.gate.track(tx, ticket);
      signal?.addEventListener("abort", abort, { once: true });
      const result = await fn(tx);
      this.gate.assert(ticket);
      cancelled(signal);
      await tx.done;
      changed();
      return result;
    } catch (e) {
      abort();
      await tx?.done.catch(() => {});
      throw e;
    } finally {
      signal?.removeEventListener("abort", abort);
      db.close();
    }
  }
  /**
   * A stored payload and its chunk hashes, for sync upload. Only the chunk
   * list is checked here (no file read); sync hashes each chunk it sends.
   */
  async payload(ref: AssetRef): Promise<Payload> {
    const db = await openDatabase(this.name);
    try {
      return await payloadMatches(await db.get("media_assets", ref.id), ref);
    } finally {
      db.close();
    }
  }
  async list() {
    const db = await openDatabase(this.name);
    try {
      const rows = await db.getAll("media_assets", metadataRange());
      return {
        assets: rows.filter(validAsset),
        issues: rows
          .filter((r) => !validAsset(r))
          .map(() => "Metadata media rusak; data dipertahankan."),
      };
    } finally {
      db.close();
    }
  }
  async import(
    prepared: PreparedMedia,
    signal?: AbortSignal,
    ticket = this.gate.ticket(),
  ) {
    this.gate.assert(ticket);
    const p = structuredClone(prepared);
    if (
      !validAsset(p.asset) ||
      p.asset.original.size > LIMITS[p.asset.kind] ||
      p.payloads.length !== 2
    )
      throw new Error("Metadata impor media tidak valid");
    for (const r of [p.asset.original, p.asset.thumbnail])
      await verifyPayload(
        p.payloads.find((b) => b.id === r.id),
        r,
      );
    return this.write(
      ["media_assets"],
      async (tx) => {
        const store = tx.objectStore("media_assets");
        const existing = await store.getAll(metadataRange());
        if (
          existing.some(
            (a) =>
              validAsset(a) && a.original.digest === p.asset.original.digest,
          )
        )
          throw new Error("File identik sudah tersedia; tidak ditimpa.");
        if (await store.get(`deleted:${p.asset.id}`))
          throw new Error("Impor kedaluwarsa setelah penghapusan");
        for (const b of p.payloads) await store.add(b);
        await store.add(p.asset);
        return p.asset;
      },
      signal,
      ticket,
    );
  }
  async pin(deck: Deck, slot: string) {
    return this.write(["media_assets"], async (tx) =>
      putPin(tx, `pin:${slot}`, mediaRefs(deck)),
    );
  }
  async resolve(
    selection: MediaSelection,
    signal?: AbortSignal,
  ): Promise<MediaSnapshot> {
    if (!validSelection(selection))
      throw new Error("Pilihan media tidak valid");
    const db = await openDatabase(this.name);
    let asset: MediaAsset;
    try {
      const row = await db.get("media_assets", selection.assetId);
      if (
        !validAsset(row) ||
        row.original.digest !== selection.digest ||
        selection.pages.some((p) => p > row.pages) ||
        (row.kind !== "pdf" &&
          (selection.pages.length !== 1 || selection.pages[0] !== 1))
      )
        throw new Error("Sumber media berubah/hilang");
      asset = row;
    } finally {
      db.close();
    }
    const frames: AssetRef[] = [];
    if (asset.kind !== "pdf") {
      // Verified once per window: previewing a large video again must not
      // re-hash the whole file while the projector may be playing.
      await readVerifiedAsset(asset.original, [asset.original], this.name);
      frames.push(asset.original);
    } else {
      const ticket = this.gate.ticket();
      const original = await readAsset(
          asset.original,
          [asset.original],
          this.name,
        ),
        pdf = await openPdf(original, signal);
      const rows: Payload[] = [];
      let bytes = 0;
      try {
        for (const n of selection.pages) {
          cancelled(signal);
          const b = await renderPdfPage(pdf.doc, n, signal);
          bytes += b.size;
          if (bytes > LIMITS.derived)
            throw new Error("Raster terpilih melebihi 64 MiB");
          const image = await createImageBitmap(b);
          const row = await payload(b, signal);
          frames.push({
            id: row.id,
            digest: row.digest,
            mime: row.mime,
            size: row.size,
            kind: "image",
            width: image.width,
            height: image.height,
          });
          image.close();
          rows.push(row);
        }
      } finally {
        await pdf.close();
      }
      await this.write(
        ["media_assets"],
        async (tx) => {
          const current = await tx.objectStore("media_assets").get(asset.id);
          if (
            !validAsset(current) ||
            current.original.digest !== asset.original.digest ||
            (await tx.objectStore("media_assets").get(`deleted:${asset.id}`))
          )
            throw new Error("Sumber dihapus saat rasterisasi");
          for (const row of rows) await tx.objectStore("media_assets").add(row);
          await putPin(tx, `pin:prepared:${asset.id}`, frames);
        },
        signal,
        ticket,
      );
    }
    return {
      title: asset.title,
      assetId: asset.id,
      digest: asset.original.digest,
      frames,
      pageNumbers: selection.pages,
    };
  }
  async resolveWorkspace(
    data: Workspace,
    selection: {
      kind: string;
      selection?: MediaSelection;
      scheduleId?: string;
    },
    signal?: AbortSignal,
  ) {
    const copy = {
      ...data,
      mediaSnapshots: {} as Record<string, MediaSnapshot>,
    };
    const choices: [string, MediaSelection][] = [];
    if (selection.kind === "media" && selection.selection)
      choices.push(["standalone", selection.selection]);
    if (selection.kind === "schedule") {
      const s = data.schedules.find((s) => s.id === selection.scheduleId);
      for (const key of s?.itemIds ?? []) {
        const item = data.items.find((i) => i.id === key);
        if (item?.type === "media") choices.push([key, item.media]);
      }
    }
    for (const [key, choice] of choices)
      copy.mediaSnapshots[key] = await this.resolve(choice, signal);
    return copy;
  }
  async addToSchedule(
    scheduleId: string,
    selection: MediaSelection,
    revision: number,
  ) {
    if (!validSelection(selection))
      throw new Error("Pilihan media tidak valid");
    return this.write(
      ["media_assets", "schedules", "schedule_items"],
      async (tx) => {
        const a = await tx.objectStore("media_assets").get(selection.assetId),
          s = await tx.objectStore("schedules").get(scheduleId);
        if (
          !validAsset(a) ||
          a.original.digest !== selection.digest ||
          selection.pages.some((n) => n > a.pages) ||
          (a.kind !== "pdf" &&
            (selection.pages.length !== 1 || selection.pages[0] !== 1)) ||
          !validSchedule(s) ||
          s.revision !== revision ||
          s.itemIds.length >= 5000
        )
          throw new Error("Konflik sumber/revisi jadwal");
        const time = new Date().toISOString(),
          item: MediaScheduleItem = {
            id: crypto.randomUUID(),
            type: "media",
            scheduleId,
            media: structuredClone(selection),
            label: a.title,
            createdAt: time,
            updatedAt: time,
          };
        await tx.objectStore("schedule_items").add(item);
        await tx.objectStore("schedules").put({
          ...s,
          revision: s.revision + 1,
          itemIds: [...s.itemIds, item.id],
          updatedAt: time,
        });
        return item;
      },
    );
  }
  async delete(id: string, digest: string) {
    return this.write(
      ["media_assets", "schedule_items", "schedules"],
      async (tx) => {
        const store = tx.objectStore("media_assets"),
          a = await store.get(id);
        if (!validAsset(a) || a.original.digest !== digest)
          throw new Error("Metadata media rusak/berubah");
        const all = await tx.objectStore("schedule_items").getAll(),
          affected = all.filter(
            (i) => i.type === "media" && i.media?.assetId === id,
          );
        if (affected.some((i) => !validItem(i)))
          throw new Error("Referensi rusak");
        for (const scheduleId of new Set(affected.map((i) => i.scheduleId))) {
          const s = await tx.objectStore("schedules").get(scheduleId);
          if (
            !validSchedule(s) ||
            s.itemIds.some(
              (key) =>
                !all.some(
                  (i) => i.id === key && i.scheduleId === s.id && validItem(i),
                ),
            )
          )
            throw new Error("Jadwal rusak");
          await tx.objectStore("schedules").put({
            ...s,
            revision: s.revision + 1,
            itemIds: s.itemIds.filter(
              (key) => !affected.some((i) => i.id === key),
            ),
            updatedAt: new Date().toISOString(),
          });
        }
        for (const i of affected)
          await tx.objectStore("schedule_items").delete(i.id);
        await store.delete(id);
        await store.put({
          id: `deleted:${id}`,
          kind: "tombstone",
          format: 1,
          deletedAt: new Date().toISOString(),
        });
      },
    );
  }
  async usage() {
    const db = await openDatabase(this.name);
    try {
      const tx = db.transaction("media_assets", "readonly"),
        assets = await tx.store.getAll(metadataRange()),
        pins = await tx.store.getAll(IDBKeyRange.bound("pin:", "pin:\uffff"));
      await tx.done;
      if (
        !assets.every(validAsset) ||
        pins.some(
          (p) =>
            p?.kind !== "pin" ||
            p.format !== 1 ||
            !Array.isArray(p.refs) ||
            !p.refs.every(validRef),
        )
      )
        throw new Error("Metadata/pin rusak; estimasi media tidak tersedia");
      const library = new Map<string, AssetRef>(),
        retained = new Map<string, AssetRef>();
      for (const a of assets)
        for (const r of [a.original, a.thumbnail]) library.set(r.id, r);
      for (const p of pins)
        for (const r of p.refs) if (!library.has(r.id)) retained.set(r.id, r);
      return {
        libraryBytes: [...library.values()].reduce((n, r) => n + r.size, 0),
        retainedBytes: [...retained.values()].reduce((n, r) => n + r.size, 0),
      };
    } finally {
      db.close();
    }
  }
  async releaseRetired(session: string, currentDeckId: string) {
    if (!/^[a-zA-Z0-9_-]+$/.test(session))
      throw new Error("Sesi pin tidak valid");
    return this.write(["media_assets"], async (tx) => {
      const store = tx.objectStore("media_assets"),
        prefix = `pin:live:${session}:`,
        keys = await store.getAllKeys(
          IDBKeyRange.bound(prefix, `${prefix}\uffff`),
        );
      for (const key of keys) {
        if (key === `${prefix}${currentDeckId}`) continue;
        const pin = await store.get(key);
        if (
          pin?.kind !== "pin" ||
          pin.format !== 1 ||
          !Array.isArray(pin.refs) ||
          !pin.refs.every(validRef)
        )
          throw new Error("Pin rusak dipertahankan");
        await store.delete(key);
      }
    });
  }
  async collect() {
    return this.write(
      ["media_assets", "themes", "live_session_state", "backup_manifest"],
      async (tx) => {
        const store = tx.objectStore("media_assets");
        const keys = await store.getAllKeys();
        const used = new Set<string>();
        for (const key of keys) {
          const k = String(key);
          if (k.startsWith("blob:")) continue;
          const row = await store.get(key);
          if (k.startsWith("meta:")) {
            if (!validAsset(row))
              throw new Error("Metadata rusak; cleanup diblokir");
            used.add(row.original.id);
            used.add(row.thumbnail.id);
          } else if (k.startsWith("pin:")) {
            if (
              row?.kind !== "pin" ||
              row.format !== 1 ||
              !Array.isArray(row.refs) ||
              !row.refs.every(validRef)
            )
              throw new Error("Pin rusak; cleanup diblokir");
            for (const r of row.refs) used.add(r.id);
          } else if (!k.startsWith("deleted:"))
            throw new Error("Record media tidak dikenal; cleanup diblokir");
        }
        const ensurePin = async (id: string, refs: AssetRef[]) => {
          if (!refs.length) return;
          const pin = await store.get(id);
          if (
            pin?.kind !== "pin" ||
            pin.format !== 1 ||
            !Array.isArray(pin.refs) ||
            !pin.refs.every(validRef) ||
            refs.some(
              (ref) =>
                !pin.refs.some(
                  (r: AssetRef) => r.id === ref.id && r.digest === ref.digest,
                ),
            )
          )
            throw new Error(
              "Pin dependensi tema/checkpoint hilang atau rusak; cleanup diblokir",
            );
        };
        for (const theme of await tx.objectStore("themes").getAll()) {
          if (
            typeof theme?.id === "string" &&
            theme.id.startsWith("deleted:") &&
            theme.format === 1
          )
            continue;
          if (!validTheme(theme))
            throw new Error("Tema rusak/tidak didukung; cleanup diblokir");
          const refs = backgroundRefs(theme.spec);
          await ensurePin(`pin:theme:${theme.id}`, refs);
          for (const r of refs) used.add(r.id);
        }
        const checkpoint = await tx
          .objectStore("live_session_state")
          .get("phase3:checkpoint");
        if (checkpoint !== undefined) {
          if (!validCheckpoint(checkpoint))
            throw new Error("Checkpoint rusak; cleanup diblokir");
          const refs = checkpoint.live ? mediaRefs(checkpoint.live.deck) : [];
          await ensurePin("pin:checkpoint", refs);
          for (const r of refs) used.add(r.id);
        }
        for (const candidate of await tx
          .objectStore("backup_manifest")
          .getAll()) {
          if (candidate.kind !== "candidate") {
            if (!operationalRecord(candidate))
              throw new Error(
                "Record recovery tidak dikenal; cleanup diblokir",
              );
            continue;
          }
          if (!validCheckpoint(candidate.checkpoint))
            throw new Error("Kandidat recovery rusak; cleanup diblokir");
          const refs = candidate.checkpoint.live
            ? mediaRefs(candidate.checkpoint.live.deck)
            : [];
          await ensurePin(`pin:recovery:${candidate.id}`, refs);
          for (const r of refs) used.add(r.id);
        }
        let count = 0;
        for (const key of keys)
          if (String(key).startsWith("blob:") && !used.has(String(key))) {
            await store.delete(key);
            count++;
          }
        return count;
      },
    );
  }
}
