import { fitsAppearance } from "./appearance";
import type { ScriptureSnapshot } from "../scriptures/models";
import { reference } from "../scriptures/models";
import { paginateExact, fits, type Measure } from "./layout";
import {
  MAX_BYTES,
  MAX_FRAMES,
  type Deck,
  type Style,
  frameText,
} from "./models";
export function appendScripture(
  deck: Deck,
  snapshot: ScriptureSnapshot,
  itemId: string | null,
  style: Style,
  measure: Measure,
  paginateOverride?: (text: string) => string[],
) {
  const t = snapshot.translation;
  deck.scriptureLicenses ??= [];
  if (!deck.scriptureLicenses.some((l) => l.datasetId === t.id))
    deck.scriptureLicenses.push({
      datasetId: t.id,
      license: structuredClone(t.info.license),
      translation: `${t.info.abbreviation} · ${t.info.edition}`,
      checksum: t.contentHash,
    });
  if (!deck.sources.some((s) => s.kind === "scripture" && s.id === t.id))
    deck.sources.push({
      kind: "scripture",
      id: t.id,
      revision: t.revision,
      checksum: t.contentHash,
    });
  for (let occurrence = 0; occurrence < snapshot.verses.length; occurrence++) {
    const verse = snapshot.verses[occurrence],
      pages = paginateOverride
        ? paginateOverride(verse.text)
        : paginateExact(verse.text, style, measure),
      ref = reference(t, verse);
    if (deck.frames.length + pages.length > MAX_FRAMES)
      throw new Error("Batas 10.000 slide terlampaui.");
    pages.forEach((text, index) => {
      const page = deck.pages.push({ text, scripture: true }) - 1;
      deck.frames.push({
        kind: "scripture",
        id: JSON.stringify([
          "scripture",
          itemId ?? verse.id,
          t.contentHash,
          verse.id,
          index,
          style,
        ]),
        page,
        itemId,
        title: ref,
        label: `${t.info.abbreviation} · ${index + 1}/${pages.length}`,
        occurrence,
        scripture: {
          datasetId: t.id,
          verseId: verse.id,
          reference: ref,
          translation: `${t.info.abbreviation} · ${t.info.edition}`,
          attribution: t.info.license.displayAttribution,
          originalText: verse.text,
          part: index + 1,
          total: pages.length,
        },
      });
    });
  }
  if (new TextEncoder().encode(JSON.stringify(deck)).byteLength > MAX_BYTES)
    throw new Error("Deck melebihi 16 MiB. Kurangi pilihan ayat.");
}
export function fitsFrame(deck: Deck, index: number, measure: Measure) {
  if (deck.frames[index]?.kind === "media") return true;
  if (deck.render?.frames[deck.frames[index]?.id])
    return fitsAppearance(deck, index, measure);
  const text = frameText(deck, index),
    frame = deck.frames[index];
  return frame.kind === "scripture"
    ? paginateExact(text, deck.style, measure).length === 1
    : fits(text, deck.style, measure);
}
