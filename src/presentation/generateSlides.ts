import { layoutText, lyricTheme, type AppearanceContext } from "./appearance";
import { builtins } from "../themes/builtins";
import type { ThemeSnapshot } from "../themes/models";
import type { MediaSelection } from "../media/models";
import { appendScripture } from "./scriptureAdapter";
import type { ScriptureSelection } from "../scriptures/models";
import { validSong, type Workspace } from "../domain/models";
import {
  clone,
  uid,
  validDeck,
  validStyle,
  MAX_FRAMES,
  MAX_BYTES,
  type Deck,
  type Style,
} from "./models";
import { paginate, type Measure } from "./layout";
export type Selection =
  | { kind: "media"; selection: MediaSelection }
  | { kind: "song"; songId: string }
  | { kind: "scripture"; selection: ScriptureSelection }
  | { kind: "schedule"; scheduleId: string; itemId?: string };
export async function generateSlides(
  workspace: Workspace,
  selection: Selection,
  style: Style,
  measure: Measure,
  cancelled = () => false,
  appearance?: AppearanceContext,
): Promise<{ deck: Deck; index: number }> {
  if (!validStyle(style)) throw new Error("Pengaturan slide tidak valid.");
  const data = clone(workspace),
    deck: Deck = {
      id: uid(),
      label: "",
      createdAt: new Date().toISOString(),
      style: clone(style),
      pages: [],
      frames: [],
      sources: [],
      schedule: null,
      overrides: [],
    };
  // Every theme draws lyrics with the global text style (see lyricSpec):
  // the theme only brings the background and the text's look.
  if (appearance)
    appearance = {
      ...appearance,
      defaultTheme:
        appearance.defaultTheme &&
        (await lyricTheme(appearance.defaultTheme, style)),
      byItem: Object.fromEntries(
        await Promise.all(
          Object.entries(appearance.byItem).map(
            async ([key, theme]) =>
              [key, await lyricTheme(theme, style)] as const,
          ),
        ),
      ),
    };
  let fallback = appearance?.defaultTheme;
  if (
    appearance &&
    !fallback &&
    (appearance.settings.reference !== 1080 ||
      appearance.settings.scaling !== "fit")
  ) {
    const base = (await builtins()).find(
      (t) => t.id === `builtin:${style.theme}`,
    )!;
    fallback = await lyricTheme(
      {
        ...base,
        spec: {
          ...base.spec,
          type: { ...base.spec.type, minSize: Math.min(32, style.fontSize) },
        },
      },
      style,
    );
  }
  if (
    appearance &&
    (fallback ||
      Object.keys(appearance.byItem).length ||
      appearance.settings.reference !== 1080 ||
      appearance.settings.scaling !== "fit")
  )
    deck.render = {
      version: 2,
      canvas: {
        width: appearance.settings.reference === 720 ? 1280 : 1920,
        height: appearance.settings.reference,
        scaling: appearance.settings.scaling,
      },
      themes: {},
      frames: {},
      sizes: {},
    };
  function capture(
    theme: ThemeSnapshot | undefined,
    start: number,
    sizes: number[],
  ) {
    if (!theme || !deck.render) return;
    const key = `${theme.id}@${theme.signature}`;
    deck.render.themes[key] = clone(theme);
    deck.frames.slice(start).forEach((frame, i) => {
      frame.id = JSON.stringify([frame.id, theme.signature]);
      deck.render!.frames[frame.id] = key;
      deck.render!.sizes[frame.id] = sizes[i] ?? theme.spec.type.size;
    });
  }
  let items: (
    | { songId: string; itemId: string | null }
    | { scriptureKey: string; itemId: string | null }
    | { mediaKey: string; itemId: string | null }
  )[] = [];
  if (selection.kind === "song") {
    const song = data.songs.find((s) => s.id === selection.songId);
    if (!song) throw new Error("Lagu tidak tersedia.");
    deck.label = song.title;
    items = [{ songId: song.id, itemId: null }];
  } else if (selection.kind === "scripture") {
    const snapshot = data.scriptureSnapshots?.standalone;
    if (!snapshot) throw new Error("Pilihan Scripture belum diresolusikan.");
    deck.label = selection.selection.label;
    items = [{ scriptureKey: "standalone", itemId: null }];
  } else if (selection.kind === "media") {
    const snapshot = data.mediaSnapshots?.standalone;
    if (!snapshot) throw new Error("Media belum siap");
    deck.label = snapshot.title;
    items = [{ mediaKey: "standalone", itemId: null }];
  } else {
    const schedule = data.schedules.find((s) => s.id === selection.scheduleId);
    if (!schedule || !schedule.itemIds.length)
      throw new Error("Jadwal kosong/tidak tersedia.");
    deck.label = schedule.name;
    deck.schedule = { id: schedule.id, revision: schedule.revision };
    items = schedule.itemIds.map((itemId) => {
      const item = data.items.find(
        (i) => i.id === itemId && i.scheduleId === schedule.id,
      );
      if (!item) throw new Error("Referensi jadwal tidak lengkap.");
      return item.type === "media"
        ? { mediaKey: itemId, itemId }
        : item.type === "scripture"
          ? { scriptureKey: itemId, itemId }
          : { songId: item.songId, itemId };
    });
  }
  const cached = new Map<string, number[]>();
  let sourceBytes = 0;
  for (const item of items) {
    if (cancelled()) throw new Error("Persiapan dibatalkan.");
    const theme =
      (item.itemId ? appearance?.byItem[item.itemId] : undefined) ?? fallback;
    const start = deck.frames.length;
    const effectiveSizes: number[] = [];
    if ("mediaKey" in item) {
      const snapshot = data.mediaSnapshots?.[item.mediaKey];
      if (!snapshot) throw new Error("Sumber media tidak tersedia");
      if (!deck.sources.some((s) => s.id === snapshot.assetId))
        deck.sources.push({
          kind: "media",
          id: snapshot.assetId,
          revision: 1,
          checksum: snapshot.digest,
        });
      snapshot.frames.forEach((media, i) => {
        const page = deck.pages.push({ text: "", media: true }) - 1;
        deck.frames.push({
          kind: "media",
          id: JSON.stringify([
            item.itemId ?? snapshot.assetId,
            media.id,
            snapshot.pageNumbers[i],
          ]),
          page,
          itemId: item.itemId,
          title: snapshot.title,
          label: `${media.kind === "video" ? "Video" : "Media"} · ${snapshot.pageNumbers[i]}`,
          occurrence: i,
          media,
          sourceId: snapshot.assetId,
          sourceDigest: snapshot.digest,
          pageNumber: snapshot.pageNumbers[i],
        });
      });
      continue;
    }
    if ("scriptureKey" in item) {
      const snapshot = data.scriptureSnapshots?.[item.scriptureKey];
      if (!snapshot) throw new Error("Sumber Scripture hilang.");
      effectiveSizes.push(
        ...appendScripture(
          deck,
          snapshot,
          item.itemId,
          style,
          measure,
          theme
            ? (text, m) => ({
                ...layoutText(text, theme.spec, m, true),
                base: theme.spec.type.size,
              })
            : undefined,
        ),
      );
      capture(theme, start, effectiveSizes);
      continue;
    }
    const song = data.songs.find((s) => s.id === item.songId);
    if (!validSong(song))
      throw new Error(
        "Sumber lagu rusak atau tidak tersedia. LIVE dipertahankan.",
      );
    if (!deck.sources.some((s) => s.id === song.id)) {
      deck.sources.push({ id: song.id, revision: song.revision });
      sourceBytes += new TextEncoder().encode(JSON.stringify(song)).byteLength;
      if (sourceBytes > MAX_BYTES)
        throw new Error("Materi melebihi batas 16 MiB. Kurangi jadwal.");
    }
    for (let occurrence = 0; occurrence < song.order.length; occurrence++) {
      const section = song.sections.find(
        (s) => s.id === song.order[occurrence],
      )!;
      const key = `${song.id}:${song.revision}:${section.id}:${theme?.signature ?? "legacy"}`;
      // An empty part is one blank slide (e.g. a quiet first slide).
      const blank = !section.text.trim();
      const themed =
        theme && !blank ? layoutText(section.text, theme.spec, measure) : null;
      let pages = cached.get(key);
      if (!pages) {
        pages = (
          blank
            ? [""]
            : (themed?.pages ?? paginate(section.text, style, measure))
        ).map((text) => {
          if (deck.pages.length >= MAX_FRAMES)
            throw new Error("Batas 10.000 slide terlampaui.");
          return (
            deck.pages.push({
              text,
              ...(theme ? { themed: true as const } : {}),
              ...(blank ? { blank: true as const } : {}),
            }) - 1
          );
        });
        cached.set(key, pages);
      }
      if (deck.frames.length + pages.length > MAX_FRAMES)
        throw new Error("Batas 10.000 slide terlampaui.");
      for (let page = 0; page < pages.length; page++) {
        effectiveSizes.push(
          themed?.size ?? (theme ? theme.spec.type.size : style.fontSize),
        );
        deck.frames.push({
          id: JSON.stringify([
            item.itemId ?? song.id,
            song.revision,
            occurrence,
            page,
            style,
          ]),
          page: pages[page],
          songId: song.id,
          itemId: item.itemId,
          title: song.title,
          label: section.label,
          occurrence,
        });
      }
      if (occurrence % 50 === 0)
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    capture(theme, start, effectiveSizes);
  }
  if (cancelled()) throw new Error("Persiapan dibatalkan.");
  if (!validDeck(deck))
    throw new Error("Deck tidak valid atau melebihi batas 16 MiB.");
  const index =
    selection.kind === "schedule" && selection.itemId
      ? deck.frames.findIndex((f) => f.itemId === selection.itemId)
      : 0;
  return { deck, index: Math.max(0, index) };
}
