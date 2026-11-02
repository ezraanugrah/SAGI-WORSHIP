import { canonicalJSON } from "../scriptures/importFormat";
import { openDatabase } from "../db";
import { WriterGate } from "./writer";
import { putPin, changed } from "./mediaRepository";
import { readAsset } from "../media/assetReader";
import { builtins, signature } from "../themes/builtins";
import {
  validTheme,
  validSpec,
  validAdvanced,
  advancedDefaults,
  backgroundRefs,
  themeId,
  type ThemeRecord,
  type ThemeSpec,
  type ThemeSnapshot,
  type AdvancedSettings,
} from "../themes/models";
import { validSchedule, validItem } from "../domain/models";
import type { IDBPTransaction } from "idb";
export class ThemeRepository {
  constructor(
    private gate: WriterGate,
    private name = "sagi-worship",
  ) {}
  private async write<T>(
    fn: (tx: IDBPTransaction<unknown, string[], "readwrite">) => Promise<T>,
    ticket = this.gate.ticket(),
  ) {
    this.gate.assert(ticket);
    const db = await openDatabase(this.name);
    let tx: IDBPTransaction<unknown, string[], "readwrite"> | undefined;
    try {
      this.gate.assert(ticket);
      tx = db.transaction(
        ["themes", "media_assets", "settings", "schedules", "schedule_items"],
        "readwrite",
      );
      this.gate.track(tx, ticket);
      const result = await fn(tx);
      this.gate.assert(ticket);
      await tx.done;
      changed();
      return result;
    } catch (e) {
      try {
        tx?.abort();
      } catch {}
      await tx?.done.catch(() => {});
      throw e;
    } finally {
      db.close();
    }
  }
  async list() {
    const db = await openDatabase(this.name);
    try {
      const rows = await db.getAll("themes");
      const valid: ThemeSnapshot[] = await builtins(),
        issues: string[] = [];
      for (const r of rows) {
        if (
          typeof r?.id === "string" &&
          r.id.startsWith("deleted:") &&
          r.format === 1
        )
          continue;
        if (validTheme(r) && (await signature(r.spec)) === r.signature)
          valid.push({
            id: r.id,
            revision: r.revision,
            name: r.name,
            spec: r.spec,
            signature: r.signature,
          });
        else issues.push("Tema rusak/tidak didukung dipertahankan.");
      }
      return { themes: valid, issues };
    } finally {
      db.close();
    }
  }
  async resolve(id: string): Promise<ThemeSnapshot> {
    const data = await this.list(),
      value = data.themes.find((t) => t.id === id);
    if (!value)
      throw new Error("Tema hilang/rusak; tidak ada penggantian otomatis.");
    const refs = backgroundRefs(value.spec);
    for (const ref of refs) await readAsset(ref, refs, this.name);
    return structuredClone(value);
  }
  private async checked(id: string) {
    const db = await openDatabase(this.name);
    try {
      const value = await db.get("themes", id);
      if (value === undefined) return undefined;
      if (
        !validTheme(value) ||
        (await signature(value.spec)) !== value.signature
      )
        throw new Error("Tema rusak dipertahankan");
      return value;
    } finally {
      db.close();
    }
  }
  async save(id: string, name: string, spec: ThemeSpec, revision: number) {
    const ticket = this.gate.ticket();
    if (
      !themeId(id) ||
      !id.startsWith("theme:") ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      !validSpec(spec)
    )
      throw new Error("Tema tidak valid");
    const checked = await this.checked(id);
    const copy = structuredClone(spec),
      hash = await signature(copy);
    const refs = backgroundRefs(copy);
    for (const ref of refs) await readAsset(ref, refs, this.name);
    return this.write(async (tx) => {
      const store = tx.objectStore("themes"),
        old = await store.get(id);
      if (await store.get(`deleted:${id}`))
        throw new Error("Tema telah dihapus; simpan kedaluwarsa ditolak");
      if (
        (old !== undefined && !validTheme(old)) ||
        (old?.revision ?? 0) !== revision ||
        canonicalJSON(old ?? null) !== canonicalJSON(checked ?? null)
      )
        throw new Error("Konflik revisi tema");
      const time = new Date().toISOString(),
        row: ThemeRecord = {
          id,
          format: 1,
          revision: revision + 1,
          name: name.trim(),
          spec: copy,
          signature: hash,
          createdAt: old?.createdAt ?? time,
          updatedAt: time,
        };
      await putPin(tx, `pin:theme:${id}`, refs);
      await store.put(row);
      return row;
    }, ticket);
  }
  async settings() {
    const db = await openDatabase(this.name);
    try {
      const value = await db.get("settings", "phase6:settings");
      if (value === undefined) return structuredClone(advancedDefaults);
      if (!validAdvanced(value))
        throw new Error("Pengaturan lanjutan rusak; data dipertahankan");
      return value;
    } finally {
      db.close();
    }
  }
  async saveSettings(value: AdvancedSettings, revision: number) {
    value = structuredClone(value);
    if (!validAdvanced(value)) throw new Error("Pengaturan tidak valid");
    return this.write(async (tx) => {
      const store = tx.objectStore("settings"),
        old = await store.get(value.id);
      if (
        (old !== undefined && !validAdvanced(old)) ||
        (old?.revision ?? 0) !== revision
      )
        throw new Error("Konflik pengaturan");
      if (value.defaultThemeId)
        await this.requireTheme(tx, value.defaultThemeId);
      const row = { ...structuredClone(value), revision: revision + 1 };
      await store.put(row);
      return row;
    });
  }
  private async requireTheme(
    tx: IDBPTransaction<unknown, string[], "readwrite">,
    id: string,
  ) {
    if (!themeId(id)) throw new Error("ID tema tidak valid");
    if (id.startsWith("builtin:")) return;
    const row = await tx.objectStore("themes").get(id);
    if (!validTheme(row)) throw new Error("Tema hilang/rusak");
  }
  async assign(itemId: string, id: string | null, revision: number) {
    return this.write(async (tx) => {
      const items = tx.objectStore("schedule_items"),
        item = await items.get(itemId);
      if (!validItem(item) || item.type === "media")
        throw new Error("Pilih item lagu/Scripture");
      const schedules = tx.objectStore("schedules"),
        s = await schedules.get(item.scheduleId);
      if (
        !validSchedule(s) ||
        s.revision !== revision ||
        !s.itemIds.includes(itemId)
      )
        throw new Error("Konflik jadwal");
      if (id) await this.requireTheme(tx, id);
      await items.put({
        ...item,
        themeId: id,
        updatedAt: new Date().toISOString(),
      });
      await schedules.put({
        ...s,
        revision: s.revision + 1,
        updatedAt: new Date().toISOString(),
      });
    });
  }
  async usage(id: string) {
    const db = await openDatabase(this.name);
    try {
      const items = await db.getAll("schedule_items"),
        settings = await this.settings();
      return {
        assignments: items.filter((i) => i.themeId === id).length,
        isDefault: settings.defaultThemeId === id,
      };
    } finally {
      db.close();
    }
  }
  async delete(
    id: string,
    revision: number,
    replacement: string | null,
    expected: { assignments: number; isDefault: boolean },
  ) {
    const ticket = this.gate.ticket();
    const checked = await this.checked(id);
    return this.write(async (tx) => {
      const themes = tx.objectStore("themes"),
        old = await themes.get(id);
      if (
        !validTheme(old) ||
        old.revision !== revision ||
        canonicalJSON(old) !== canonicalJSON(checked ?? null)
      )
        throw new Error("Tema berubah/rusak");
      if (replacement === id) throw new Error("Pengganti tidak valid");
      if (replacement) await this.requireTheme(tx, replacement);
      const settings = tx.objectStore("settings"),
        a =
          (await settings.get("phase6:settings")) ??
          structuredClone(advancedDefaults);
      if (!validAdvanced(a)) throw new Error("Pengaturan rusak");
      const items = tx.objectStore("schedule_items"),
        all = await items.getAll(),
        affected = all.filter((i) => i.themeId === id);
      if (
        affected.length !== expected.assignments ||
        (a.defaultThemeId === id) !== expected.isDefault
      )
        throw new Error("Pemakaian tema berubah; periksa ulang");
      if ((affected.length || a.defaultThemeId === id) && !replacement)
        throw new Error("Pilih pengganti secara eksplisit atau batalkan");
      for (const scheduleId of new Set(affected.map((i) => i.scheduleId))) {
        const s = await tx.objectStore("schedules").get(scheduleId);
        if (
          !validSchedule(s) ||
          s.itemIds.some(
            (key) =>
              !all.some(
                (i) =>
                  i.id === key && i.scheduleId === scheduleId && validItem(i),
              ),
          )
        )
          throw new Error("Jadwal rusak");
        await tx.objectStore("schedules").put({
          ...s,
          revision: s.revision + 1,
          updatedAt: new Date().toISOString(),
        });
      }
      for (const item of affected) {
        if (!validItem(item)) throw new Error("Item rusak");
        await items.put({
          ...item,
          themeId: replacement,
          updatedAt: new Date().toISOString(),
        });
      }
      if (a.defaultThemeId === id)
        await settings.put({
          ...a,
          defaultThemeId: replacement,
          revision: a.revision + 1,
        });
      await themes.delete(id);
      await themes.put({
        id: `deleted:${id}`,
        format: 1,
        deletedAt: new Date().toISOString(),
      });
      await putPin(tx, `pin:theme:${id}`, []);
    }, ticket);
  }
}
