/** The app's media and theme stores, as the library sync sees them. */
import type { MediaRepository } from "../data/mediaRepository";
import type { ThemeRepository } from "../data/themeRepository";
import type { LibraryRepos } from "./librarySync";
import type { Repository } from "../data/repository";
import type { ScheduleItem } from "../domain/models";
import { weekSchedules } from "../domain/weeks";
import type { PortableItem, ScheduleSyncRepo } from "./scheduleSync";

export function libraryRepos(
  media: MediaRepository,
  themes: ThemeRepository,
  /** Also sync Week 1–4 (the songs repository holds the schedules). */
  songs?: Repository,
): LibraryRepos {
  return {
    ...(songs ? { schedules: scheduleRepo(songs, themes) } : {}),
    media: {
      list: async () => (await media.list()).assets,
      payload: (ref) => media.payload(ref),
      importRemote: async (asset, payloads) => {
        try {
          await media.import({ asset, payloads });
        } catch (e) {
          const message = (e as Error).message;
          // Same file already here, or deleted here earlier (that deletion
          // is then sent to the other laptops): nothing to import.
          if (/File identik|kedaluwarsa setelah penghapusan/.test(message))
            return;
          throw e;
        }
      },
      remove: async (id, digest) => {
        await media.delete(id, digest);
      },
    },
    themes: {
      list: async () =>
        (await themes.list()).themes.filter((t) => t.id.startsWith("theme:")),
      apply: async (id, name, spec) => {
        const current = (await themes.list()).themes.find((t) => t.id === id);
        await themes.save(id, name, spec, current?.revision ?? 0);
      },
    },
  };
}

/**
 * Week 1–4 as the schedule sync sees them: items in a form every laptop can
 * read (songs by id, media by file fingerprint, verses by Bible edition),
 * and back to this laptop's own media and Bible ids.
 */
export function scheduleRepo(
  songs: Repository,
  themes: ThemeRepository,
): ScheduleSyncRepo {
  return {
    weeks: async () => {
      const data = await songs.load();
      return weekSchedules(data.schedules).map((week) =>
        week
          ? week.itemIds.flatMap((key) => {
              const item = data.items.find(
                (i) => i.id === key && i.scheduleId === week.id,
              );
              const p = item && portable(item);
              return p ? [p] : [];
            })
          : null,
      );
    },
    apply: async (n, items) => {
      const data = await songs.load(),
        themeIds = new Set((await themes.list()).themes.map((th) => th.id)),
        missing = new Set<string>(),
        out: Parameters<Repository["applyRemoteWeek"]>[1] = [];
      for (const p of items) {
        const themeId = p.kind !== "media" && p.themeId ? p.themeId : null;
        if (themeId && !themeIds.has(themeId)) {
          missing.add("tema");
          continue;
        }
        const withTheme = themeId ? { themeId } : {};
        if (p.kind === "song") {
          if (!data.songs.some((s) => s.id === p.songId)) missing.add("lagu");
          else
            out.push({
              id: p.id,
              type: "song",
              songId: p.songId,
              ...withTheme,
            });
        } else if (p.kind === "media") {
          const asset = data.mediaAssets?.find(
            (a) => a.original.digest === p.digest,
          );
          if (!asset || p.pages.some((page) => page > asset.pages))
            missing.add("media");
          else
            out.push({
              id: p.id,
              type: "media",
              media: {
                assetId: asset.id,
                digest: p.digest,
                pages: [...p.pages],
              },
              label: p.label,
            });
        } else {
          const bible = data.translations?.find(
            (tr) => tr.contentHash === p.checksum,
          );
          if (!bible) missing.add("Alkitab");
          else
            out.push({
              id: p.id,
              type: "scripture",
              selection: {
                datasetId: bible.id,
                checksum: p.checksum,
                verseIds: p.verses.map((v) => `v|${bible.id}|${v}`),
                label: p.label,
              },
              ...withTheme,
            });
        }
      }
      if (missing.size)
        return {
          waiting: missing.has("Alkitab")
            ? `Week ${n} menunggu Alkitab: pasang di tab Scriptures.`
            : `Week ${n} menunggu ${[...missing].join(", ")} sampai di laptop ini.`,
        };
      await songs.applyRemoteWeek(n, out);
      return {};
    },
  };
}
/** A schedule item as other laptops can read it (null: not portable). */
function portable(item: ScheduleItem): PortableItem | null {
  const theme =
    item.type !== "media" && item.themeId ? { themeId: item.themeId } : {};
  if (item.type === "song")
    return { kind: "song", id: item.id, songId: item.songId, ...theme };
  if (item.type === "media")
    return {
      kind: "media",
      id: item.id,
      label: item.label,
      digest: item.media.digest,
      pages: [...item.media.pages],
    };
  const prefix = `v|${item.selection.datasetId}|`;
  if (!item.selection.verseIds.every((v) => v.startsWith(prefix))) return null;
  return {
    kind: "scripture",
    id: item.id,
    ...theme,
    checksum: item.selection.checksum,
    label: item.selection.label,
    verses: item.selection.verseIds.map((v) => v.slice(prefix.length)),
  };
}
