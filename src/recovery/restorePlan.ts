import { canonicalJSON, sha256 } from "../scriptures/importFormat";
import { dependencyRoots, byStore, validateRows } from "../backup/validation";
import { type Snapshot, fail } from "../backup/models";
import { validAsset } from "../media/models";
export type RestoreMode = "fresh" | "existing" | "both";
export type RestorePlan = {
  mode: RestoreMode;
  destination: string;
  stage: string;
  fingerprint: string;
  incomingFingerprint: string;
  rows: Snapshot;
  summary: string[];
  id: string;
};
export async function snapshotHash(rows: Snapshot) {
  return sha256(
    canonicalJSON(
      rows
        .map(({ store, value }) => {
          const { blob, ...v } = value;
          return { store, value: v };
        })
        .sort((a, b) =>
          (a.store + "|" + a.value.id).localeCompare(
            b.store + "|" + b.value.id,
          ),
        ),
    ),
  );
}
const key = (r: Snapshot[number]) => r.store + "|" + r.value.id;
const same = (a: Snapshot[number], b: Snapshot[number]) => {
  const { blob: _, ...av } = a.value,
    { blob: __, ...bv } = b.value;
  return canonicalJSON(av) === canonicalJSON(bv);
};
// Parent equality includes children and the content their references resolve to.
// Cache signatures so repeated schedule occurrences do not repeatedly serialize songs.
async function aggregateSignatures(rows: Snapshot) {
  const index = new Map(rows.map((r) => [key(r), r.value]));
  const signatures = new Map<string, string>();
  const children = new Map<string, Snapshot[number]["value"][]>();
  for (const r of rows) {
    const parent =
      r.store === "song_sections"
        ? `songs|${r.value.songId}`
        : r.store === "schedule_items"
          ? `schedules|${r.value.scheduleId}`
          : null;
    if (parent) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent)!.push(r.value);
    }
  }
  const signature = async (
    store: string,
    id: string,
  ): Promise<string | null> => {
    const k = `${store}|${id}`;
    if (signatures.has(k)) return signatures.get(k)!;
    const value = index.get(k);
    if (!value) return null; // Built-in themes are definitions in the same app.
    const { blob: _, ...plain } = value;
    const owned = (children.get(k) ?? [])
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));
    const dependencies = [];
    if (store === "schedules")
      for (const item of owned)
        dependencies.push({
          id: item.id,
          song: item.songId ? await signature("songs", item.songId) : null,
          theme: item.themeId ? await signature("themes", item.themeId) : null,
          media: item.media
            ? await signature("media_assets", item.media.assetId)
            : null,
          scripture: item.selection
            ? await signature(
                "scripture_translations",
                item.selection.datasetId,
              )
            : null,
        });
    const result = await sha256(
      canonicalJSON({ value: plain, children: owned, dependencies }),
    );
    signatures.set(k, result);
    return result;
  };
  for (const r of rows)
    if (r.store === "songs" || r.store === "schedules")
      await signature(r.store, r.value.id);
  return signatures;
}
export async function makePlan(
  source: Snapshot,
  destination: Snapshot,
  mode: RestoreMode,
  stage: string,
  name: string,
): Promise<RestorePlan> {
  await validateRows(source);
  await validateRows(destination);
  if (mode === "fresh" && destination.length)
    fail("workspace tidak kosong; gunakan merge");
  const incoming = structuredClone(source),
    summary: string[] = [],
    map = new Map<string, string>(),
    skipped = new Set<string>();
  const dest = new Map(destination.map((r) => [key(r), r]));
  const sourceAggregates = await aggregateSignatures(incoming),
    destinationAggregates = await aggregateSignatures(destination),
    childConflicts = new Set<string>();
  // A colliding child identity belongs to the whole incoming aggregate, even
  // when its parent has a new ID. Never remap a child under an unchanged parent.
  for (const r of incoming) {
    const old = dest.get(key(r));
    if (!old || same(old, r)) continue;
    if (r.store === "song_sections")
      childConflicts.add(`songs|${r.value.songId}`);
    if (r.store === "schedule_items")
      childConflicts.add(`schedules|${r.value.scheduleId}`);
  }
  const remappable = new Set([
    "songs",
    "song_sections",
    "schedules",
    "schedule_items",
    "themes",
  ]);
  for (const row of incoming) {
    const old = dest.get(key(row));
    const aggregate = sourceAggregates.get(key(row));
    const conflict =
      childConflicts.has(key(row)) ||
      (old &&
        (aggregate !== undefined
          ? aggregate !== destinationAggregates.get(key(row))
          : !same(old, row)));
    if (!conflict) continue;
    if (row.store === "media_assets" && row.value.id.startsWith("pin:"))
      continue;
    if (
      row.store === "live_session_state" ||
      row.store === "settings" ||
      row.store === "backup_manifest"
    )
      continue;
    if (
      mode === "both" &&
      remappable.has(row.store) &&
      !row.value.id.startsWith("deleted:")
    ) {
      map.set(
        row.value.id,
        (row.store === "themes" ? "theme:" : "") + crypto.randomUUID(),
      );
      summary.push(`Duplikasi ${row.store}/${row.value.id}`);
    } else {
      skipped.add(key(row));
      summary.push(`Pertahankan tujuan; lewati ${key(row)}`);
    }
  }
  // Every section/item in a duplicated aggregate gets its own identity, including IDs not conflicting individually.
  for (const r of incoming)
    if (
      (r.store === "song_sections" && map.has(r.value.songId)) ||
      (r.store === "schedule_items" && map.has(r.value.scheduleId))
    )
      map.set(r.value.id, crypto.randomUUID());
  // Do not resurrect destination-deleted IDs; safe keep-both creates a fresh identity instead.
  for (const r of incoming) {
    const tomb =
      r.store === "songs"
        ? `settings|phase2:deleted:song:${r.value.id}`
        : r.store === "themes" || r.store === "media_assets"
          ? `${r.store}|deleted:${r.value.id}`
          : "";
    if (tomb && dest.has(tomb)) {
      if (mode === "both" && (r.store === "songs" || r.store === "themes")) {
        map.set(
          r.value.id,
          (r.store === "themes" ? "theme:" : "") + crypto.randomUUID(),
        );
        summary.push(`Identitas baru untuk sumber terhapus ${r.value.id}`);
      } else {
        skipped.add(key(r));
        summary.push(`Tombstone tujuan dipertahankan ${r.value.id}`);
      }
    }
  }
  // Re-run child mapping after tombstone decisions.
  for (const r of incoming)
    if (
      (r.store === "song_sections" && map.has(r.value.songId)) ||
      (r.store === "schedule_items" && map.has(r.value.scheduleId))
    )
      if (!map.has(r.value.id)) map.set(r.value.id, crypto.randomUUID());
  if (map.size) {
    const identities = new Set<string>();
    for (const row of incoming.filter((r) => remappable.has(r.store))) {
      if (identities.has(row.value.id))
        fail("remapping identitas lintas store ambigu");
      identities.add(row.value.id);
    }
  }
  if (
    (map.size ||
      incoming.some(
        (r) =>
          skipped.has(key(r)) &&
          [
            "songs",
            "song_sections",
            "schedules",
            "schedule_items",
            "themes",
          ].includes(r.store),
      )) &&
    byStore(incoming, "slide_overrides").length
  )
    fail(
      "merge dengan override memerlukan remapping signature yang tidak aman; gunakan workspace kosong atau backup tanpa konflik",
    );
  const badSource = new Set(
    incoming.filter((r) => skipped.has(key(r))).map((r) => r.value.id),
  );
  const blockedSchedules = new Set(
    byStore(incoming, "schedule_items")
      .filter(
        (i) =>
          badSource.has(i.songId) ||
          badSource.has(i.selection?.datasetId) ||
          badSource.has(i.media?.assetId) ||
          badSource.has(i.themeId),
      )
      .map((i) => i.scheduleId),
  );
  const writes: Snapshot = [];
  for (const row of incoming) {
    const v = row.value,
      originalKey = key(row);
    if (skipped.has(originalKey)) continue;
    if (
      (row.store === "song_sections" && badSource.has(v.songId)) ||
      (row.store === "scripture_verses" && badSource.has(v.datasetId)) ||
      (row.store === "schedule_items" &&
        (badSource.has(v.scheduleId) || blockedSchedules.has(v.scheduleId))) ||
      (row.store === "schedules" && blockedSchedules.has(v.id))
    ) {
      summary.push(`Lewati dependensi ${originalKey}`);
      continue;
    }
    if (
      row.store === "settings" &&
      v.id.startsWith("phase2:draft:song:") &&
      (badSource.has(v.songId) || map.has(v.songId))
    )
      fail(
        "draft berkonflik tidak dapat diremap aman; pilih arsip tanpa konflik draft",
      );
    if (row.store === "live_session_state") {
      if (v.live) {
        const id = `phase7:candidate:${crypto.randomUUID()}`;
        writes.push({
          store: "backup_manifest",
          value: {
            id,
            format: 1,
            kind: "candidate",
            checkpoint: v,
            createdAt: new Date().toISOString(),
          },
        });
        summary.push(
          "Checkpoint masuk disimpan sebagai kandidat; Resume tidak otomatis",
        );
      }
      // Fresh restore can preserve the checkpoint; old transport identifiers are neutralized below.
      if (mode !== "fresh") continue;
      v.sessionId = crypto.randomUUID();
      v.sequence = 0;
      if (v.live?.playback) {
        v.live.playback.paused = true;
        delete v.live.playback.target;
      }
      if (v.live?.backgroundPlayback) {
        v.live.backgroundPlayback.paused = true;
        delete v.live.backgroundPlayback.target;
      }
    }
    if (row.store === "media_assets" && v.kind === "pin") {
      v.id = `pin:retained:${crypto.randomUUID()}`;
      summary.push(`Retensi konservatif ${originalKey}`);
    } else if (
      row.store === "themes" &&
      v.id.startsWith("deleted:") &&
      dest.has("themes|" + v.id.slice(8))
    ) {
      summary.push(`Lewati tombstone masuk ${v.id}`);
      continue;
    } else if (
      row.store === "media_assets" &&
      v.id.startsWith("deleted:") &&
      dest.has("media_assets|" + v.id.slice(8))
    ) {
      summary.push(`Lewati tombstone masuk ${v.id}`);
      continue;
    } else if (
      row.store === "settings" &&
      v.id.startsWith("phase2:deleted:song:") &&
      dest.has("songs|" + v.id.slice("phase2:deleted:song:".length))
    ) {
      summary.push(`Lewati tombstone masuk ${v.id}`);
      continue;
    } else if (dest.has(originalKey)) {
      if (same(dest.get(originalKey)!, row) && !map.has(v.id)) continue;
      if (!map.has(v.id)) {
        summary.push(`Pertahankan ${originalKey}`);
        continue;
      }
    }
    if (
      row.store === "settings" &&
      v.id === "phase2:active-schedule" &&
      (badSource.has(v.value) || blockedSchedules.has(v.value))
    )
      continue;
    if (map.has(v.id)) v.id = map.get(v.id)!;
    if (row.store === "songs") {
      v.order = v.order.map((id: string) => map.get(id) ?? id);
      if (v.sectionIds)
        v.sectionIds = v.sectionIds.map((id: string) => map.get(id) ?? id);
    }
    if (row.store === "song_sections") v.songId = map.get(v.songId) ?? v.songId;
    if (row.store === "schedules")
      v.itemIds = v.itemIds.map((id: string) => map.get(id) ?? id);
    if (row.store === "schedule_items") {
      v.scheduleId = map.get(v.scheduleId) ?? v.scheduleId;
      if (v.songId) v.songId = map.get(v.songId) ?? v.songId;
      if (v.themeId) v.themeId = map.get(v.themeId) ?? v.themeId;
    }
    if (row.store === "settings" && v.id === "phase2:active-schedule")
      v.value = map.get(v.value) ?? v.value;
    if (row.store === "settings" && v.id === "phase6:settings")
      v.defaultThemeId = map.get(v.defaultThemeId) ?? v.defaultThemeId;
    writes.push(row);
  }
  let combined = [...destination, ...writes];
  for (const root of dependencyRoots(combined)) {
    const old = combined.find(
      (r) => r.store === "media_assets" && r.value.id === root.id,
    );
    const refs = [
      ...new Map(
        [...(old?.value.refs ?? []), ...root.refs].map((r: any) => [r.id, r]),
      ).values(),
    ];
    const pin = {
      store: "media_assets" as const,
      value: {
        id: root.id,
        format: 1,
        kind: "pin",
        refs,
        createdAt: old?.value.createdAt ?? new Date().toISOString(),
      },
    };
    const wi = writes.findIndex(
      (r) => r.store === pin.store && r.value.id === pin.value.id,
    );
    if (wi >= 0) writes[wi] = pin;
    else writes.push(pin);
  }
  combined = [
    ...destination.filter((d) => !writes.some((w) => key(d) === key(w))),
    ...writes,
  ];
  await validateRows(combined);
  // All retained payloads are intentionally included; no automatic reclamation during restore.
  summary.unshift(
    `Payload masuk ${(
      byStore(writes, "media_assets")
        .filter((v) => v.blob instanceof Blob)
        .reduce((n, v) => n + v.blob.size, 0) / 1048576
    ).toFixed(
      1,
    )} MiB; staging dan publikasi memerlukan ruang tambahan. Estimasi browser bukan jaminan quota.`,
  );
  summary.unshift(
    `${writes.length} record dipublikasikan; ${byStore(writes, "media_assets").filter(validAsset).length} media library`,
  );
  return {
    id: crypto.randomUUID(),
    mode,
    destination: name,
    stage,
    fingerprint: await snapshotHash(destination),
    incomingFingerprint: await snapshotHash(source),
    rows: writes,
    summary,
  };
}
