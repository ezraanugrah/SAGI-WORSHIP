import { fitsAppearance } from "./appearance";
import type {
  ScriptureSnapshot,
  Translation,
  Verse,
} from "../scriptures/models";
import { reference } from "../scriptures/models";
import { paginateExact, fits, columnMeasure, type Measure } from "./layout";
import {
  MAX_BYTES,
  MAX_FRAMES,
  type Deck,
  type Style,
  frameText,
} from "./models";
/** Splits one verse into page slices; themed decks also report a font size. */
export type ScriptureLayout = (
  text: string,
  measure: Measure,
) => { pages: string[]; size?: number; base?: number };
const edition = (t: Translation) =>
  `${t.info.abbreviation} · ${t.info.edition}`;
function register(deck: Deck, t: Translation) {
  deck.scriptureLicenses ??= [];
  if (!deck.scriptureLicenses.some((l) => l.datasetId === t.id))
    deck.scriptureLicenses.push({
      datasetId: t.id,
      license: structuredClone(t.info.license),
      translation: edition(t),
      checksum: t.contentHash,
    });
  if (!deck.sources.some((s) => s.kind === "scripture" && s.id === t.id))
    deck.sources.push({
      kind: "scripture",
      id: t.id,
      revision: t.revision,
      checksum: t.contentHash,
    });
}
const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const verseNumber = (n: number) =>
  String(n).replace(/\d/g, (d) => SUPERSCRIPT[Number(d)]);
/** Several verses on one slide: "⁴ text ⁵ text …". */
const numbered = (verses: Verse[]) =>
  verses.map((v) => `${verseNumber(v.verse)}\u2009${v.text.trim()}`).join(" ");
/** "Bilangan 4:4–7", "Bilangan 4:48–5:2", or one verse's reference. */
function rangeReference(t: Translation, first: Verse, last: Verse) {
  if (first.id === last.id) return reference(t, first);
  if (first.book !== last.book)
    return `${reference(t, first)}–${reference(t, last)}`;
  const name = t.books.find((b) => b.id === first.book)?.name ?? first.book;
  return first.chapter === last.chapter
    ? `${name} ${first.chapter}:${first.verse}–${last.verse}`
    : `${name} ${first.chapter}:${first.verse}–${last.chapter}:${last.verse}`;
}
/**
 * A slide holding several verses: its own font size, and as many lines as
 * the screen height allows at that size (not the song line limit).
 */
export const packStyle = (style: Style, fontSize: number): Style => ({
  ...style,
  fontSize,
  lines: 99,
});
/** Several verses on one slide never go below half the normal size (min 24 px). */
export const minPackSize = (style: Style) =>
  Math.max(24, Math.round(style.fontSize / 2));
/**
 * Adds the selected verses as slides, using as few slides as possible:
 * consecutive verses share a slide (each starting with its number,
 * "⁴ … ⁵ …") with the font shrunk as far as needed, down to half the normal
 * size (themed decks: the theme's minimum), and when more than one slide is
 * needed the verses are spread evenly. A slide holding a single verse shows
 * that verse's exact text at the normal size, continuing over several
 * slides when it is too long.
 * With a parallel translation each slide has two columns (left: the
 * selection's translation, right: the partner) covering the same verses.
 * Returns the font size of every added frame when a themed layout is used.
 */
export function appendScripture(
  deck: Deck,
  snapshot: ScriptureSnapshot,
  itemId: string | null,
  style: Style,
  measure: Measure,
  layout?: ScriptureLayout,
): number[] {
  const t = snapshot.translation,
    p = snapshot.parallel,
    two = !!p && p.verses.length === snapshot.verses.length,
    m = two ? columnMeasure(measure) : measure,
    sizes: number[] = [];
  register(deck, t);
  if (two) register(deck, p!.translation);
  const split = (text: string) =>
    layout ? layout(text, m) : { pages: paginateExact(text, style, m) };
  const pair = (a?: number, b?: number) =>
    a !== undefined && b !== undefined ? Math.min(a, b) : (a ?? b);
  const push = (
    first: number,
    last: number,
    pages: { left: string; right: string | null; fontSize?: number }[],
    size: number | undefined,
  ) => {
    if (deck.frames.length + pages.length > MAX_FRAMES)
      throw new Error("Batas 10.000 slide terlampaui.");
    const verses = snapshot.verses.slice(first, last + 1),
      others = two ? p!.verses.slice(first, last + 1) : [],
      single = verses.length === 1,
      ref = rangeReference(t, verses[0], verses.at(-1)!),
      originalText = single ? verses[0].text : numbered(verses),
      otherText = two ? (single ? others[0].text : numbered(others)) : "";
    pages.forEach(({ left, right, fontSize }, index) => {
      const page =
        deck.pages.push({
          text: left,
          scripture: true,
          ...(right !== null ? { parallel: right } : {}),
          ...(fontSize !== undefined ? { fontSize } : {}),
        }) - 1;
      deck.frames.push({
        kind: "scripture",
        id: JSON.stringify([
          "scripture",
          itemId ?? verses[0].id,
          t.contentHash,
          verses[0].id,
          ...(single ? [] : [verses.at(-1)!.id]),
          index,
          style,
          ...(two ? [p!.translation.contentHash] : []),
        ]),
        page,
        itemId,
        title: ref,
        label: `${t.info.abbreviation}${two ? ` + ${p!.translation.info.abbreviation}` : ""} · ${single ? `${index + 1}/${pages.length}` : `ayat ${verses[0].verse}–${verses.at(-1)!.verse}`}`,
        occurrence: first,
        scripture: {
          datasetId: t.id,
          verseId: verses[0].id,
          reference: ref,
          translation: edition(t),
          attribution: t.info.license.displayAttribution,
          originalText,
          part: index + 1,
          total: pages.length,
          ...(two
            ? {
                parallel: {
                  datasetId: p!.translation.id,
                  verseId: others[0].id,
                  reference: rangeReference(
                    p!.translation,
                    others[0],
                    others.at(-1)!,
                  ),
                  translation: edition(p!.translation),
                  attribution: p!.translation.info.license.displayAttribution,
                  originalText: otherText,
                },
              }
            : {}),
        },
      });
      if (size !== undefined) sizes.push(size);
    });
  };
  type Slide = {
    left: string;
    right: string | null;
    /** Themed: the frame's font size. */
    size?: number;
    /** Plain style: this slide's own font size (several verses shrunk to fit). */
    fontSize?: number;
  };
  const texts = (first: number, last: number) => ({
    left: numbered(snapshot.verses.slice(first, last + 1)),
    right: two ? numbered(p!.verses.slice(first, last + 1)) : null,
  });
  const fitsPlain = (text: string | null, size: number) =>
    text === null ||
    paginateExact(text, packStyle(style, size), m).length === 1;
  /** Verses first..last fit on one slide at the smallest allowed size. */
  function fitsTogether(first: number, last: number) {
    const { left, right } = texts(first, last);
    if (layout)
      return [left, right].every(
        (text) => text === null || layout(text, m).pages.length === 1,
      );
    const min = minPackSize(style);
    return fitsPlain(left, min) && fitsPlain(right, min);
  }
  /**
   * The slide for verses first..last: themed decks use the theme's own fit
   * (shrinking to its minimum size); plain decks get the largest font that
   * fits every column, at least half the normal size.
   */
  function pack(first: number, last: number): Slide {
    const { left, right } = texts(first, last);
    if (layout) {
      const a = layout(left, m),
        b = right === null ? null : layout(right, m);
      return {
        left: a.pages[0],
        right: b ? b.pages[0] : null,
        size: pair(a.size, b?.size),
      };
    }
    let lo = minPackSize(style),
      hi = style.fontSize + 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (fitsPlain(left, mid) && fitsPlain(right, mid)) lo = mid;
      else hi = mid;
    }
    return { left, right, fontSize: lo };
  }
  const n = snapshot.verses.length;
  // reach[i]: the last verse that still fits on one slide starting at verse i.
  // It never moves backwards as i grows, so two pointers find it cheaply.
  const reach: number[] = [];
  for (let i = 0, j = 0; i < n; i++) {
    j = Math.max(j, i);
    while (j + 1 < n && fitsTogether(i, j + 1)) j++;
    reach.push(j);
  }
  // Fewest slides: each slide takes as many verses as fit.
  const groups: [number, number][] = [];
  for (let first = 0; first < n; first = reach[first] + 1)
    groups.push([first, reach[first]]);
  // Same number of slides, verses spread evenly: minimise the longest slide.
  const k = groups.length;
  if (k > 1 && n <= 300) {
    const prefix = [0];
    for (let i = 0; i < n; i++)
      prefix.push(
        prefix[i] +
          snapshot.verses[i].text.length +
          (two ? p!.verses[i].text.length : 0),
      );
    // best[g][j]: smallest longest slide for verses 0..j-1 in g slides.
    const best = Array.from({ length: k + 1 }, () =>
        Array<number>(n + 1).fill(Infinity),
      ),
      cut = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(-1));
    best[0][0] = 0;
    for (let g = 1; g <= k; g++)
      for (let j = 1; j <= n; j++)
        for (let i = j - 1; i >= g - 1 && reach[i] >= j - 1; i--) {
          if (best[g - 1][i] === Infinity) continue;
          const cost = Math.max(best[g - 1][i], prefix[j] - prefix[i]);
          if (cost < best[g][j]) {
            best[g][j] = cost;
            cut[g][j] = i;
          }
        }
    if (best[k][n] < Infinity) {
      groups.length = 0;
      for (let g = k, j = n; g > 0; g--) {
        const i = cut[g][j];
        groups.unshift([i, j - 1]);
        j = i;
      }
    }
  }
  for (const [first, last] of groups) {
    const packed = first === last ? null : pack(first, last);
    if (packed) {
      push(first, last, [packed], packed.size);
      continue;
    }
    // One verse: its exact text at the normal size, over as many slides as
    // its longer side needs.
    const a = split(snapshot.verses[first].text),
      b = two ? split(p!.verses[first].text) : null,
      count = Math.max(a.pages.length, b?.pages.length ?? 0);
    push(
      first,
      first,
      Array.from({ length: count }, (_, i) => ({
        left: a.pages[i] ?? "",
        right: b ? (b.pages[i] ?? "") : null,
      })),
      pair(a.size, b?.size),
    );
  }
  if (new TextEncoder().encode(JSON.stringify(deck)).byteLength > MAX_BYTES)
    throw new Error("Deck melebihi 16 MiB. Kurangi pilihan ayat.");
  return sizes;
}
/** Each non-empty side of a slide fits in one page (a column for two-language slides). */
export function fitsFrame(deck: Deck, index: number, measure: Measure) {
  if (deck.frames[index]?.kind === "media") return true;
  if (deck.render?.frames[deck.frames[index]?.id])
    return fitsAppearance(deck, index, measure);
  const text = frameText(deck, index),
    frame = deck.frames[index];
  if (frame.kind !== "scripture") return fits(text, deck.style, measure);
  const { parallel, fontSize } = deck.pages[frame.page],
    m = parallel === undefined ? measure : columnMeasure(measure),
    style =
      fontSize === undefined ? deck.style : packStyle(deck.style, fontSize);
  return [text, parallel ?? ""].every(
    (side) => !side || paginateExact(side, style, m).length === 1,
  );
}
