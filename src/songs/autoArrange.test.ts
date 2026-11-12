import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import {
  autoArrange,
  readHeader,
  toSongInput,
  type Arrangement,
} from "./autoArrange";
import { Repository } from "../data/repository";
import { writerFixture } from "../testHelpers";
import { generateSlides } from "../presentation/generateSlides";
import { validSong, type Song } from "../domain/models";
import type { Style } from "../presentation/models";

const SERUKAN = `Verse 1
Tuhanku maha besar
Tuhanku maha kuasa
Raja segala raja.

Verse 2
Dia takkan tergoyahkan
Dia takkan terkalahkan
Dia hidup dan berkuasa

Pre-Chorus
Serukan nama Nya
Yesus Tuhan Raja

Chorus
Segala kuasa tunduk dalam nama Nya
Dia luar biasa perkasa mulia
Yesus nama diatas segala nama`;

const labels = (r: Arrangement) => r.parts.map((p) => p.label);
const lineCount = (r: Arrangement, label: string) =>
  r.parts.find((p) => p.label === label)!.text.split("\n").length;
/** The lyrics as shown, part after part in the order. */
const shown = (r: Arrangement) =>
  r.order.map((key) => r.parts.find((p) => p.key === key)!.text);
/** Every lyric line of the input (label lines left out), in input order. */
const lyricLines = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim() && !readHeader(l));

describe("Susun Otomatis (no AI)", () => {
  it("1. labelled lyrics: the example song gives four parts with their lines, words untouched", () => {
    const r = autoArrange(SERUKAN);
    expect(r.method).toBe("labels");
    expect(labels(r)).toEqual(["Verse 1", "Verse 2", "Pre Chorus", "Chorus"]);
    expect(r.parts.every((p) => p.sure)).toBe(true);
    expect(
      ["Verse 1", "Verse 2", "Pre Chorus", "Chorus"].map((l) =>
        lineCount(r, l),
      ),
    ).toEqual([3, 3, 2, 3]);
    expect(r.order).toHaveLength(4);
    expect(shown(r).join("\n").split("\n")).toEqual(lyricLines(SERUKAN));
    expect(r.parts[0].text).toBe(
      "Tuhanku maha besar\nTuhanku maha kuasa\nRaja segala raja.",
    );
    expect(r.parts.map((p) => p.type)).toEqual([
      "Verse",
      "Verse",
      "Chorus",
      "Chorus",
    ]);
  });

  it("2. plain lyrics without labels: stanzas by blank lines, the returning one is the Chorus, all marked to check", () => {
    const text = [
      "Baris satu bait satu\nBaris dua bait satu",
      "Engkau layak dipuji\nEngkau layak disembah",
      "Baris satu bait dua\nBaris dua bait dua",
      "Engkau layak dipuji\nEngkau layak disembah",
    ].join("\n\n");
    const r = autoArrange(text);
    expect(r.method).toBe("guess");
    expect(labels(r)).toEqual(["Verse 1", "Chorus", "Verse 2"]);
    expect(r.parts.every((p) => !p.sure && !!p.note)).toBe(true);
    expect(r.order.map((k) => r.parts.find((p) => p.key === k)!.label)).toEqual(
      ["Verse 1", "Chorus", "Verse 2", "Chorus"],
    );
    expect(shown(r).join("\n").split("\n")).toEqual(lyricLines(text));
  });

  it("3. a Chorus repeated (label only, same lyrics again, or 2x) is stored once and shown again", () => {
    const text = `Verse 1
Bait pertama
Chorus
Haleluya Tuhan
Pujilah Dia
Verse 2
Bait kedua
Chorus

Reff
Haleluya Tuhan
Pujilah Dia
Chorus 2x`;
    const r = autoArrange(text);
    expect(labels(r)).toEqual(["Verse 1", "Chorus", "Verse 2"]);
    expect(r.order.map((k) => r.parts.find((p) => p.key === k)!.label)).toEqual(
      ["Verse 1", "Chorus", "Verse 2", "Chorus", "Chorus", "Chorus", "Chorus"],
    );
    // A last Chorus with other words stays a part of its own.
    const changed = autoArrange(
      "Chorus\nHaleluya Tuhan\nVerse\nKasih-Mu kekal\nChorus\nHaleluya Tuhan selamanya",
    );
    expect(labels(changed)).toEqual(["Chorus", "Verse 1", "Chorus 2"]);
    expect(changed.parts[2].note).toMatch(/lirik berbeda/);
  });

  it("4. no Bridge, Intro or Instrumental is invented when the lyrics have none", () => {
    for (const text of [
      SERUKAN,
      "Bait satu\nbaris\n\nReff satu\nbaris\n\nBait dua\nbaris\n\nReff satu\nbaris",
    ]) {
      const kinds = labels(autoArrange(text));
      expect(kinds.some((l) => /Bridge|Intro|Instrumental|Outro/.test(l))).toBe(
        false,
      );
    }
    // Only a label in the lyrics makes one; without words it is a blank slide.
    const r = autoArrange(
      "Intro\n\nVerse 1\nTuhan baik\n\nInstrumental\n\nOutro",
    );
    expect(labels(r)).toEqual(["Intro", "Verse 1", "Instrumental", "Outro"]);
    expect(r.parts.filter((p) => !p.text).map((p) => p.label)).toEqual([
      "Intro",
      "Instrumental",
      "Outro",
    ]);
    expect(r.parts.map((p) => p.type)).toEqual([
      "Intro",
      "Verse",
      "Bridge",
      "Ending",
    ]);
  });

  it("5. label variants are recognised", () => {
    const text = `[Verse 1]
Satu
V2:
Dua
Verse
Tiga
Bait 4
Empat
PRE-REFF
Pra
Reff: Kuasa-Mu nyata
dan besar
**Bridge**
Jembatan
(Post Chorus)
Sesudah
Interlude
Coda
Akhir`;
    const r = autoArrange(text);
    expect(labels(r)).toEqual([
      "Verse 1",
      "Verse 2",
      "Verse 3",
      "Verse 4",
      "Pre Chorus",
      "Chorus",
      "Bridge",
      "Post Chorus",
      "Instrumental",
      "Outro",
    ]);
    expect(r.parts.find((p) => p.label === "Chorus")!.text).toBe(
      "Kuasa-Mu nyata\ndan besar",
    );
    for (const [line, kind] of [
      ["Chorus:", "Chorus"],
      ["refrain", "Chorus"],
      ["PreChorus", "Pre Chorus"],
      ["Pre Chorus 2", "Pre Chorus"],
      ["C2", "Chorus"],
      ["B1", "Bridge"],
      ["Ending", "Outro"],
    ] as const)
      expect(readHeader(line)?.kind).toBe(kind);
    expect(readHeader("Reff (3x)")).toMatchObject({ kind: "Chorus", times: 3 });
    // Lyric lines stay lyrics.
    for (const line of [
      "Haleluya",
      "Tuhan: Engkau baik",
      "V",
      "C",
      "Yesus nama diatas segala nama",
      "Bridge over troubled water today",
    ])
      expect(readHeader(line)).toBeNull();
  });

  it("6. long lyrics (many verses) stay whole and fast", () => {
    const parts: string[] = [];
    for (let v = 1; v <= 40; v++)
      parts.push(
        `Verse ${v}\n${Array.from({ length: 6 }, (_, i) => `Bait ${v} baris ${i + 1} dengan kata-kata yang cukup panjang`).join("\n")}`,
        "Chorus\nKami sembah Engkau\nKami tinggikan Engkau",
      );
    const text = parts.join("\n\n");
    const started = performance.now();
    const r = autoArrange(text);
    expect(performance.now() - started).toBeLessThan(500);
    expect(r.parts).toHaveLength(41);
    expect(r.order).toHaveLength(80);
    expect(shown(r).join("\n").split("\n")).toEqual(lyricLines(text));
  });

  it("7. empty or oversized input says why; CRLF and spaces are kept as typed", () => {
    expect(() => autoArrange("  \n\n ")).toThrow("Lirik masih kosong.");
    expect(() => autoArrange("a".repeat(100_001))).toThrow(/terlalu panjang/);
    const r = autoArrange("Verse 1\r\n  Tuhan   baik  \r\n\r\nChorus\r\nKudus");
    expect(r.parts[0].text).toBe("  Tuhan   baik  ");
    expect(r.parts[1].text).toBe("Kudus");
    // Text before the first label is kept for the operator to name or drop.
    const titled = autoArrange(
      "Serukan NamaNya - True Worshippers\n\n" + SERUKAN,
    );
    expect(titled.parts[0]).toMatchObject({
      label: "Tanpa label",
      sure: false,
      text: "Serukan NamaNya - True Worshippers",
    });
    expect(labels(titled).slice(1)).toEqual([
      "Verse 1",
      "Verse 2",
      "Pre Chorus",
      "Chorus",
    ]);
  });
});

describe("saved like any other song", () => {
  let name = "";
  afterEach(async () => {
    if (name) await deleteDB(name);
  });
  it("8–10. saves, reopens, presents in order, and stays a valid song for backups and sync", async () => {
    name = `arrange-${crypto.randomUUID()}`;
    const writer = writerFixture(),
      repo = new Repository(writer.gate, name),
      songId = crypto.randomUUID();
    const r = autoArrange(
      SERUKAN + "\n\nChorus\n\nVerse 3\nBait ketiga\nOutro",
    );
    const input = toSongInput(
      r,
      " Serukan NamaNya ",
      "True Worshippers",
      songId,
    );
    await repo.createSong(songId, input);
    const data = await repo.load(),
      song = data.songs.find((s) => s.id === songId) as Song;
    writer.stop();
    expect(validSong(song)).toBe(true);
    expect(song.title).toBe("Serukan NamaNya");
    expect(song.author).toBe("True Worshippers");
    expect(song.sections.map((s) => s.label)).toEqual([
      "Verse 1",
      "Verse 2",
      "Pre Chorus",
      "Chorus",
      "Verse 3",
      "Outro",
    ]);
    // Chorus stored once, shown twice.
    const chorus = song.sections.find((s) => s.label === "Chorus")!.id;
    expect(song.order.filter((x) => x === chorus)).toHaveLength(2);
    const style: Style = {
      font: "Montserrat",
      fontSize: 64,
      safeMargin: 8,
      theme: "black",
      lines: 6,
    };
    const { deck } = await generateSlides(
      data,
      { kind: "song", songId },
      style,
      (text, s) => text.length * s.fontSize * 0.5,
    );
    expect(deck.frames.map((f) => f.label)).toEqual([
      "Verse 1",
      "Verse 2",
      "Pre Chorus",
      "Chorus",
      "Chorus",
      "Verse 3",
      "Outro",
    ]);
    // The Outro without words is a blank slide.
    expect(deck.pages[deck.frames.at(-1)!.page]).toMatchObject({
      text: "",
      blank: true,
    });
  });
});
