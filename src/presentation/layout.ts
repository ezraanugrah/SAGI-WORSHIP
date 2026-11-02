import type { Style } from "./models";
export type Measure = (
  text: string,
  style: Style & { weight?: 400 | 700; italic?: boolean },
) => number;
let context: CanvasRenderingContext2D | null = null;
export const browserMeasure: Measure = (text, style) => {
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) throw new Error("Pengukuran teks tidak tersedia.");
  context.font = `${style.italic ? "italic " : ""}${style.weight ?? 400} ${style.fontSize}px ${style.font}`;
  return context.measureText(text).width;
};
export function lineCapacity(style: Style) {
  return Math.min(
    style.lines,
    Math.floor((1080 * (1 - style.safeMargin / 50)) / (style.fontSize * 1.3)),
  );
}
/** Wrap at word boundaries, splitting an oversized token only at grapheme boundaries. */
export function wrap(text: string, style: Style, measure: Measure): string[] {
  const width = 1920 * (1 - style.safeMargin / 50),
    lines: string[] = [];
  const segmenter = new Intl.Segmenter("id", { granularity: "grapheme" });
  for (const source of text.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const token of source.match(/\S+\s*|\s+/gu) ?? []) {
      if (measure(line + token, style) <= width) {
        line += token;
        continue;
      }
      if (line) {
        lines.push(line.trimEnd());
        line = "";
      }
      for (const { segment } of segmenter.segment(token)) {
        if (measure(segment, style) > width)
          throw new Error("Karakter tidak dapat dimuat dalam area slide.");
        if (line && measure(line + segment, style) > width) {
          lines.push(line.trimEnd());
          line = "";
        }
        line += segment;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
export function paginate(text: string, style: Style, measure: Measure) {
  const lines = wrap(text, style, measure),
    capacity = lineCapacity(style),
    pages: string[] = [];
  if (capacity < 1) throw new Error("Area teks terlalu kecil.");
  for (let i = 0; i < lines.length; i += capacity) {
    const page = lines.slice(i, i + capacity).join("\n");
    if (page.trim()) pages.push(page);
  }
  return pages;
}
export function fits(text: string, style: Style, measure: Measure) {
  return (
    !!text.trim() &&
    text.length <= 30000 &&
    wrap(text, style, measure).length <= lineCapacity(style)
  );
}

/** Slice original text at measured page boundaries; concatenation is byte-for-byte identical. */
export const SCRIPTURE_FOOTER = 170;
export function paginateExact(
  text: string,
  style: Style,
  measure: Measure,
): string[] {
  const capacity = Math.min(
      style.lines,
      Math.floor(
        (1080 * (1 - style.safeMargin / 50) - SCRIPTURE_FOOTER) /
          (style.fontSize * 1.3),
      ),
    ),
    width = 1920 * (1 - style.safeMargin / 50);
  if (capacity < 1) throw new Error("Area ayat dan atribusi terlalu kecil.");
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
        throw new Error("Karakter tidak dapat dimuat.");
      if (line && measure(line + segment, style) > width) {
        ends.push(offset);
        line = "";
      }
      line += segment;
      offset += segment.length;
    }
  }
  if (offset > (ends.at(-1) ?? 0)) ends.push(offset);
  if (!ends.length) throw new Error("Teks ayat kosong.");
  const pages: string[] = [];
  let start = 0;
  for (let i = capacity - 1; i < ends.length; i += capacity) {
    pages.push(text.slice(start, ends[i]));
    start = ends[i];
  }
  if (start < text.length) pages.push(text.slice(start));
  return pages;
}
