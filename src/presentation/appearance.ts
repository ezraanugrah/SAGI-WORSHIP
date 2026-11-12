import type {
  ThemeSpec,
  ThemeSnapshot,
  AdvancedSettings,
} from "../themes/models";
import { frameText, type Deck, type Style } from "./models";
import { columnMeasure, type Measure } from "./layout";
import type { Workspace } from "../domain/models";
import type { Selection } from "./generateSlides";
import type { ThemeRepository } from "../data/themeRepository";
import { signature } from "../themes/builtins";
import {
  DEFAULT_OUTLINE_PX,
  LYRIC_COLOR,
  LYRIC_WEIGHT,
  OUTLINE_COLOR,
  SCRIPTURE_LINES,
  SCRIPTURE_MIN_PX,
  lyricFont,
} from "./fonts";
import { SCRIPTURE_THEME_ID } from "../themes/models";
export type AppearanceContext = {
  settings: AdvancedSettings;
  defaultTheme?: ThemeSnapshot;
  byItem: Record<string, ThemeSnapshot>;
  /** Scriptures' own background (Latar ayat); themes never apply to verses. */
  scripture?: ThemeSnapshot;
};
/**
 * Lyrics and backgrounds are separate: whatever the theme, the lyric font,
 * size, margin and line count come from the global text style (Pengaturan ›
 * Tipografi lirik). The theme keeps its background and the text's colour,
 * weight, alignment, outline and shadow.
 */
export function lyricSpec(spec: ThemeSpec, style: LyricStyle): ThemeSpec {
  const m = style.safeMargin;
  return {
    ...spec,
    type: {
      ...spec.type,
      font: lyricFont(style.font),
      size: style.fontSize,
      minSize: Math.min(spec.type.minSize, style.fontSize),
      margins: { top: m, right: m, bottom: m, left: m },
      lines: style.lines,
      // Fixed look for every font and theme: extra bold, white, black outline.
      weight: LYRIC_WEIGHT,
      color: LYRIC_COLOR,
      outline: {
        width: style.outline ?? DEFAULT_OUTLINE_PX,
        color: OUTLINE_COLOR,
      },
    },
  };
}
export type LyricStyle = Pick<
  Style,
  "font" | "fontSize" | "safeMargin" | "lines" | "outline"
>;
/** A theme snapshot with the global lyric style, signed for its new content. */
export async function lyricTheme(
  theme: ThemeSnapshot,
  style: LyricStyle,
): Promise<ThemeSnapshot> {
  const spec = lyricSpec(theme.spec, style);
  return { ...theme, spec, signature: await signature(spec) };
}
/**
 * Scripture slides: the Scriptures background with the lyric look, and a
 * font that shrinks (down to SCRIPTURE_MIN_PX, as many lines as the screen
 * holds) so a picked range stays on one slide.
 */
export async function scriptureTheme(
  theme: ThemeSnapshot,
  style: LyricStyle,
): Promise<ThemeSnapshot> {
  const base = lyricSpec(theme.spec, style),
    spec: ThemeSpec = {
      ...base,
      type: {
        ...base.type,
        fit: "shrink",
        lines: SCRIPTURE_LINES,
        minSize: Math.min(SCRIPTURE_MIN_PX, base.type.size),
      },
    };
  return { ...theme, spec, signature: await signature(spec) };
}
export function themeFor(deck: Deck, index: number) {
  const key = deck.render?.frames[deck.frames[index]?.id];
  return key ? deck.render?.themes[key] : undefined;
}
export function effectiveType(deck: Deck, index: number) {
  const theme = themeFor(deck, index);
  if (!theme) return undefined;
  return {
    ...theme.spec.type,
    size: deck.render?.sizes[deck.frames[index].id] ?? theme.spec.type.size,
  };
}
export const effectPadding = (t: ThemeSpec["type"]) =>
  t.outline.width +
  Math.max(Math.abs(t.shadow.x), Math.abs(t.shadow.y)) +
  t.shadow.blur;
export function layoutText(
  text: string,
  spec: ThemeSpec,
  measure: Measure,
  scripture = false,
) {
  const t = spec.type,
    padding = effectPadding(t),
    width = 1920 * (1 - (t.margins.left + t.margins.right) / 100) - padding * 2,
    height =
      1080 * (1 - (t.margins.top + t.margins.bottom) / 100) -
      (scripture ? 170 : 0) -
      padding * 2;
  function paginate(size: number) {
    const style: Style & { weight: 400 | 700 | 800; italic: boolean } = {
      font: t.font,
      fontSize: size,
      safeMargin: 0,
      theme: "black",
      lines: t.lines,
      weight: t.weight,
      italic: t.italic,
    };
    const capacity = Math.min(
      t.lines,
      Math.floor(height / (size * t.lineHeight)),
    );
    if (capacity < 1 || width <= 0)
      throw new Error("Area teks/atribusi terlalu kecil");
    const ends: number[] = [];
    let offset = 0,
      line = "";
    const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });
    for (const token of text.match(/\r\n|\r|\n|[^\S\r\n]+|[^\s]+/gu) ?? []) {
      if (/^[\r\n]+$/.test(token)) {
        offset += token.length;
        ends.push(offset);
        line = "";
        continue;
      }
      if (line && measure(line + token, style) > width) {
        ends.push(offset);
        line = "";
      }
      for (const { segment } of segmenter.segment(token)) {
        if (measure(segment, style) > width)
          throw new Error("Karakter tidak muat");
        if (line && measure(line + segment, style) > width) {
          ends.push(offset);
          line = "";
        }
        line += segment;
        offset += segment.length;
      }
    }
    if (offset > (ends.at(-1) ?? 0)) ends.push(offset);
    if (!ends.length) throw new Error("Teks kosong");
    const pages: string[] = [];
    let start = 0;
    for (let i = capacity - 1; i < ends.length; i += capacity) {
      pages.push(text.slice(start, ends[i]));
      start = ends[i];
    }
    if (start < text.length) pages.push(text.slice(start));
    return pages;
  }
  let size = t.size,
    pages = paginate(size);
  if (t.fit === "shrink")
    while (pages.length > 1 && size > t.minSize) {
      size = Math.max(t.minSize, size - 1);
      pages = paginate(size);
    }
  return { pages, size };
}
export function fitsAppearance(deck: Deck, index: number, measure: Measure) {
  const theme = themeFor(deck, index),
    type = effectiveType(deck, index);
  if (!theme || !type) return true;
  if (
    deck.pages[deck.frames[index].page]?.blank &&
    !frameText(deck, index).trim()
  )
    return true;
  const frame = deck.frames[index],
    text =
      deck.overrides.find((o) => o.frameId === frame.id)?.text ??
      deck.pages[frame.page].text,
    spec = { ...theme.spec, type: { ...type, fit: "paginate" as const } },
    parallel = deck.pages[frame.page].parallel;
  // Two-language Scripture: each non-empty column fits on its own.
  if (parallel !== undefined)
    return [text, parallel].every(
      (side) =>
        !side ||
        layoutText(side, spec, columnMeasure(measure), true).pages.length === 1,
    );
  return (
    layoutText(text, spec, measure, frame.kind === "scripture").pages.length ===
    1
  );
}
export async function resolveAppearance(
  repo: ThemeRepository,
  data: Workspace,
  selection: Selection,
  override?: { id: string; scope: "item" | "all" },
  settings?: AdvancedSettings,
): Promise<AppearanceContext> {
  const config = settings ?? (await repo.settings()),
    byItem: Record<string, ThemeSnapshot> = {},
    cache = new Map<string, ThemeSnapshot>();
  const resolve = async (id: string) => {
    if (!cache.has(id)) cache.set(id, await repo.resolve(id));
    return cache.get(id)!;
  };
  let defaultId = config.defaultThemeId;
  if (override?.scope === "all" || (selection.kind !== "schedule" && override))
    defaultId = override.id;
  const defaultTheme = defaultId ? await resolve(defaultId) : undefined;
  if (selection.kind === "schedule") {
    const schedule = data.schedules.find((s) => s.id === selection.scheduleId);
    for (const key of schedule?.itemIds ?? []) {
      const item = data.items.find((i) => i.id === key);
      if (item && item.type !== "media") {
        const id =
          override && (override.scope === "all" || selection.itemId === key)
            ? override.id
            : item.themeId;
        if (id) byItem[key] = await resolve(id);
      }
    }
  }
  // Verses keep their own background whatever theme is chosen.
  const scripture = (await repo.list()).themes.some(
    (th) => th.id === SCRIPTURE_THEME_ID,
  )
    ? await resolve(SCRIPTURE_THEME_ID)
    : undefined;
  return {
    settings: structuredClone(config),
    defaultTheme,
    byItem,
    ...(scripture ? { scripture } : {}),
  };
}
