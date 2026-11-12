import { id, type SectionType, type SongInput } from "../domain/models";

/**
 * Susun Otomatis: splits a pasted song into its parts, without AI and
 * without changing a word of the lyrics.
 *
 * 1. Labelled lyrics ("Verse 1", "[Chorus]", "Reff:", "V2", "Bridge" …): each
 *    label starts a part; a label repeated without lyrics (or with the same
 *    lyrics) repeats that part in the order, stored once.
 * 2. Lyrics without labels: stanzas are split at blank lines; a stanza that
 *    comes back is the Chorus, the others are Verse 1, 2 … Everything guessed
 *    is marked for the operator to check.
 *
 * Part texts are the original lines (CRLF read as LF); only blank lines at
 * the start and end of a part and the label lines themselves are left out.
 */

export type ArrangeKind =
  | "Intro"
  | "Verse"
  | "Pre Chorus"
  | "Chorus"
  | "Post Chorus"
  | "Bridge"
  | "Instrumental"
  | "Outro";
export type ArrangedPart = {
  key: string;
  label: string;
  type: SectionType;
  text: string;
  /** False when guessed (no label in the lyrics): the operator checks it. */
  sure: boolean;
  /** Why it is marked, in plain words. */
  note?: string;
};
export type Arrangement = {
  parts: ArrangedPart[];
  /** Part keys in presentation order; a repeated Chorus appears again. */
  order: string[];
  /** "labels": every part came from a label; "guess": some were guessed. */
  method: "labels" | "guess";
};

/** Labels offered when correcting the result (the editor keeps its own six). */
export const ARRANGE_LABELS = [
  "Intro",
  ...Array.from({ length: 8 }, (_, i) => `Verse ${i + 1}`),
  "Pre Chorus",
  "Chorus",
  "Post Chorus",
  "Bridge",
  "Instrumental",
  "Outro",
] as const;

export const MAX_LYRICS = 100_000;

/** The coarse section type kept in the song data for a label. */
export function typeOf(label: string, first = false): SectionType {
  const kind = kindOf(label);
  switch (kind) {
    case "Intro":
      return "Intro";
    case "Verse":
      return "Verse";
    case "Pre Chorus":
    case "Chorus":
    case "Post Chorus":
      return "Chorus";
    case "Bridge":
      return "Bridge";
    case "Instrumental":
      return first ? "Intro" : "Bridge";
    case "Outro":
      return "Ending";
    default:
      return "Verse";
  }
}
function kindOf(label: string): ArrangeKind | null {
  const header = readHeader(label);
  return header ? header.kind : null;
}

type Header = {
  kind: ArrangeKind;
  number: number | null;
  /** "Chorus 2x" / "Reff (3x)": shown this many times in a row. */
  times: number;
};
const KINDS: [RegExp, ArrangeKind][] = [
  [/^(?:pre[\s-]?(?:chorus|reff?|refrain)|prechorus|pc)$/, "Pre Chorus"],
  [/^(?:post[\s-]?(?:chorus|reff?|refrain)|postchorus)$/, "Post Chorus"],
  [/^(?:verse|vers|bait|stanza)$/, "Verse"],
  [/^(?:chorus|reff?|refrain|korus)$/, "Chorus"],
  [/^(?:bridge|jembatan)$/, "Bridge"],
  [/^intro$/, "Intro"],
  [/^(?:instrumental|instrumen|interlude|musik|music|solo)$/, "Instrumental"],
  [/^(?:outro|ending|coda|tag|penutup)$/, "Outro"],
];
/** Short forms that need a number ("V1", "C2", "B1"), never a lone letter. */
const SHORT: Record<string, ArrangeKind> = {
  v: "Verse",
  c: "Chorus",
  b: "Bridge",
  r: "Chorus",
};
/**
 * A whole line read as a label: "Verse 1", "[Verse 1]", "(Reff)", "V1:",
 * "Chorus 2x", "Pre-Chorus", "BRIDGE". Null for a lyric line.
 */
export function readHeader(line: string): Header | null {
  let s = line.trim();
  if (!s || s.length > 40) return null;
  s = s.replace(/^[[({<#*_\s]+|[\])}>*_\s]+$/g, "").trim(); // [Verse 1], **Chorus**
  s = s.replace(/[:.\-–—]+$/, "").trim(); // "Reff:" / "Verse 1."
  let times = 1;
  const repeat =
    s.match(/^(.*?)[\s([]*(?:x\s*(\d{1,2})|(\d{1,2})\s*x)[\s)\]]*$/i) ?? null;
  if (repeat && repeat[1].trim()) {
    times = Number(repeat[2] ?? repeat[3]);
    s = repeat[1].trim();
  }
  s = s.replace(/[\])}>]+$/, "").trim();
  const m = s.match(/^([a-z][a-z\s-]*?)\s*\.?\s*(\d{1,2})?$/i);
  if (!m) return null;
  const word = m[1].trim().toLowerCase().replace(/\s+/g, " "),
    number = m[2] ? Number(m[2]) : null;
  for (const [pattern, kind] of KINDS)
    if (pattern.test(word)) return { kind, number, times: clampTimes(times) };
  if (number !== null && SHORT[word])
    return { kind: SHORT[word], number, times: clampTimes(times) };
  return null;
}
const clampTimes = (n: number) =>
  Number.isInteger(n) && n >= 1 && n <= 10 ? n : 1;
/** "Reff: Segala kuasa …" – a label with its first lyric line after a colon. */
function inlineHeader(line: string): { header: Header; rest: string } | null {
  const m = line.match(
    /^\s*([[(]?[A-Za-z][A-Za-z\s-]{0,20}\d{0,2}[\])]?)\s*:\s*(\S.*)$/,
  );
  if (!m) return null;
  const header = readHeader(m[1]);
  return header ? { header, rest: m[2] } : null;
}

const labelFor = (kind: ArrangeKind, number: number | null) =>
  number !== null && kind !== "Intro" && kind !== "Outro"
    ? `${kind} ${number}`
    : kind;
/** Same lyrics: equal line by line, ignoring spaces at line ends. */
const sameText = (a: string, b: string) =>
  a
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n") ===
  b
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n");
/** For recognising a returning stanza: letters and digits only. */
const loose = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
/** Drop blank lines at both ends; keep every other line as typed. */
function trimBlank(lines: string[]) {
  let a = 0,
    b = lines.length;
  while (a < b && !lines[a].trim()) a++;
  while (b > a && !lines[b - 1].trim()) b--;
  return lines.slice(a, b);
}
/** Stanzas: runs of lines separated by one or more blank lines. */
function stanzas(lines: string[]) {
  const out: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim()) current.push(line);
    else if (current.length) {
      out.push(current);
      current = [];
    }
  }
  if (current.length) out.push(current);
  return out;
}

class Builder {
  parts: ArrangedPart[] = [];
  order: string[] = [];
  guessed = false;
  private n = 0;
  /** "Chorus" taken: "Chorus 2", then "Chorus 3" … */
  free(label: string) {
    if (!this.find(label)) return label;
    const base = label.replace(/\s+\d+$/, "");
    let n = 2;
    while (this.find(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }
  add(part: Omit<ArrangedPart, "key" | "type">, first = false) {
    const key = `part-${++this.n}`;
    this.parts.push({
      ...part,
      key,
      type: typeOf(part.label, first),
    });
    return key;
  }
  show(key: string, times = 1) {
    for (let i = 0; i < times; i++) this.order.push(key);
  }
  find(label: string) {
    return this.parts.find((p) => p.label === label);
  }
}

/**
 * Stanzas without labels: a stanza that comes back is the Chorus (stored
 * once), one just before each Chorus is the Pre Chorus, the rest are verses.
 */
function guess(
  blocks: string[][],
  into: Builder,
  /** Lyrics before the first label: the operator names them. */
  unlabelled = false,
) {
  into.guessed = true;
  const texts = blocks.map((b) => b.join("\n")),
    keys = texts.map(loose),
    count = new Map<string, number>();
  for (const k of keys) count.set(k, (count.get(k) ?? 0) + 1);
  // The Chorus: the stanza that returns most often (the first on a tie).
  const repeated = [...count.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || keys.indexOf(a[0]) - keys.indexOf(b[0]));
  const chorus = unlabelled ? undefined : repeated[0]?.[0];
  const always = (k: string, step: 1 | -1) =>
    keys.every((key, i) => key !== k || keys[i + step] === chorus);
  const stored: { text: string; key: string }[] = [];
  let verse = 0;
  texts.forEach((text, i) => {
    const k = keys[i],
      again = (count.get(k) ?? 0) > 1;
    const same = stored.find((x) => sameText(x.text, text));
    if (same) {
      into.show(same.key);
      return;
    }
    let label: string, note: string;
    if (unlabelled) {
      label = "Tanpa label";
      note = "Teks sebelum label pertama: pilih labelnya atau hapus.";
    } else if (k === chorus) {
      const first = !into.find("Chorus");
      label = into.free("Chorus");
      note = first
        ? `Bait ini muncul ${count.get(k)} kali.`
        : "Mirip Chorus, tetapi kata-katanya sedikit berbeda.";
    } else if (again && chorus && always(k, 1)) {
      label = into.free("Pre Chorus");
      note = "Berulang, selalu tepat sebelum Chorus.";
    } else if (again && chorus && always(k, -1)) {
      label = into.free("Post Chorus");
      note = "Berulang, selalu tepat sesudah Chorus.";
    } else if (again) {
      label = into.free("Chorus 2");
      note = "Bait ini juga berulang: pilih labelnya.";
    } else {
      label = into.free(`Verse ${++verse}`);
      note = "Tanpa label di lirik: diperkirakan dari baris kosong.";
    }
    const key = into.add({ label, text, sure: false, note }, i === 0);
    stored.push({ text, key });
    into.show(key);
  });
}

/** Splits pasted lyrics into parts and a presentation order. */
export function autoArrange(lyrics: string): Arrangement {
  if (lyrics.length > MAX_LYRICS)
    throw new Error("Lirik terlalu panjang (maksimal 100.000 karakter).");
  const lines = lyrics.replace(/\r\n?/g, "\n").split("\n");
  if (!lines.some((l) => l.trim())) throw new Error("Lirik masih kosong.");
  // Where each label starts.
  type Mark = { at: number; header: Header; rest: string | null };
  const marks: Mark[] = [];
  lines.forEach((line, at) => {
    const header = readHeader(line);
    if (header) marks.push({ at, header, rest: null });
    else {
      const inline = inlineHeader(line);
      if (inline) marks.push({ at, header: inline.header, rest: inline.rest });
    }
  });
  const into = new Builder();
  const leading = trimBlank(lines.slice(0, marks[0]?.at ?? lines.length));
  if (leading.length) guess(stanzas(leading), into, marks.length > 0);
  if (!marks.length)
    return { parts: into.parts, order: into.order, method: "guess" };

  const numbers = new Map<ArrangeKind, number>(); // next number per kind
  marks.forEach((mark, i) => {
    const end = marks[i + 1]?.at ?? lines.length,
      body = trimBlank([
        ...(mark.rest !== null ? [mark.rest] : []),
        ...lines.slice(mark.at + 1, end),
      ]),
      text = body.join("\n"),
      { kind, times } = mark.header;
    let number = mark.header.number;
    // Unnumbered verses count up: Verse 1, Verse 2 …
    if (kind === "Verse" && number === null)
      number = (numbers.get("Verse") ?? 0) + 1;
    if (number !== null)
      numbers.set(kind, Math.max(numbers.get(kind) ?? 0, number));
    let label = labelFor(kind, number);
    const existing =
      into.find(label) ??
      // "Chorus" again after "Chorus 1" was given: the same part. (Verses
      // without a number count up instead.)
      (mark.header.number === null && kind !== "Verse"
        ? into.parts.find((p) => p.sure && kindOf(p.label) === kind)
        : undefined);
    if (existing && (!text || sameText(existing.text, text))) {
      into.show(existing.key, times);
      return;
    }
    let note: string | undefined;
    if (existing) {
      // Same label, other words (e.g. a last Chorus that changes): kept
      // as its own part, nothing merged or dropped.
      label = into.free(`${kind} 2`);
      note = `Label "${existing.label}" dipakai lagi dengan lirik berbeda.`;
    } else if (
      !text &&
      kind !== "Intro" &&
      kind !== "Instrumental" &&
      kind !== "Outro"
    )
      note = "Label tanpa lirik: menjadi slide kosong.";
    const key = into.add(
      { label, text, sure: !note, ...(note ? { note } : {}) },
      !into.parts.length,
    );
    into.show(key, times);
  });
  return {
    parts: into.parts,
    order: into.order,
    method: into.guessed ? "guess" : "labels",
  };
}

/**
 * The checked result as a song for the Song Library (the same data the
 * song editor saves): each part once, the order repeating parts as shown.
 */
export function toSongInput(
  result: Pick<Arrangement, "parts" | "order">,
  title: string,
  author: string,
  songId: string,
): SongInput {
  const ids = new Map<string, string>(result.parts.map((p) => [p.key, id()]));
  return {
    title: title.trim(),
    author: author.trim(),
    category: "",
    language: "Indonesia",
    sections: result.parts.map((p, i) => ({
      id: ids.get(p.key)!,
      songId,
      type: typeOf(p.label, i === 0),
      label: p.label.trim() || "Bagian",
      text: p.text,
    })),
    order: result.order
      .map((key) => ids.get(key))
      .filter((x): x is string => !!x),
  };
}
