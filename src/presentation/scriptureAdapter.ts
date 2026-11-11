import { fitsAppearance } from "./appearance";
import type { ScriptureSnapshot, Translation } from "../scriptures/models";
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
) => { pages: string[]; size?: number };
const edition = (t: Translation) => `${t.info.abbreviation} · ${t.info.edition}`;
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
/**
 * Adds one slide sequence per verse. With a parallel translation each slide
 * has two columns (left: the selection's translation, right: the partner);
 * a verse takes as many slides as its longer side needs and the shorter side
 * gets empty slices. Returns the font size of every added frame when a
 * themed layout is used.
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
    sizes: number[] = [];
  register(deck, t);
  if (p) register(deck, p.translation);
  const split = (text: string, m: Measure) =>
    layout ? layout(text, m) : { pages: paginateExact(text, style, m) };
  for (let occurrence = 0; occurrence < snapshot.verses.length; occurrence++) {
    const verse = snapshot.verses[occurrence],
      other = p?.verses[occurrence],
      ref = reference(t, verse);
    let left: string[],
      right: string[] | null = null,
      size: number | undefined;
    if (p && other) {
      const half = columnMeasure(measure),
        a = split(verse.text, half),
        b = split(other.text, half),
        count = Math.max(a.pages.length, b.pages.length);
      left = Array.from({ length: count }, (_, i) => a.pages[i] ?? "");
      right = Array.from({ length: count }, (_, i) => b.pages[i] ?? "");
      size =
        a.size !== undefined && b.size !== undefined
          ? Math.min(a.size, b.size)
          : (a.size ?? b.size);
    } else {
      const a = split(verse.text, measure);
      left = a.pages;
      size = a.size;
    }
    if (deck.frames.length + left.length > MAX_FRAMES)
      throw new Error("Batas 10.000 slide terlampaui.");
    left.forEach((text, index) => {
      const page =
        deck.pages.push(
          right
            ? { text, scripture: true, parallel: right[index] }
            : { text, scripture: true },
        ) - 1;
      deck.frames.push({
        kind: "scripture",
        id: JSON.stringify([
          "scripture",
          itemId ?? verse.id,
          t.contentHash,
          verse.id,
          index,
          style,
          ...(right && p ? [p.translation.contentHash] : []),
        ]),
        page,
        itemId,
        title: ref,
        label: `${t.info.abbreviation}${right && p ? ` + ${p.translation.info.abbreviation}` : ""} · ${index + 1}/${left.length}`,
        occurrence,
        scripture: {
          datasetId: t.id,
          verseId: verse.id,
          reference: ref,
          translation: edition(t),
          attribution: t.info.license.displayAttribution,
          originalText: verse.text,
          part: index + 1,
          total: left.length,
          ...(right && p && other
            ? {
                parallel: {
                  datasetId: p.translation.id,
                  verseId: other.id,
                  reference: reference(p.translation, other),
                  translation: edition(p.translation),
                  attribution: p.translation.info.license.displayAttribution,
                  originalText: other.text,
                },
              }
            : {}),
        },
      });
      if (size !== undefined) sizes.push(size);
    });
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
  const parallel = deck.pages[frame.page].parallel,
    m = parallel === undefined ? measure : columnMeasure(measure);
  return [text, parallel ?? ""].every(
    (side) => !side || paginateExact(side, deck.style, m).length === 1,
  );
}
