import { describe, expect, it, afterEach } from "vitest";
import { EN } from "./en";
import { setLang, t } from "./index";

// Every source file of the app, as text (tests excluded).
const sources = import.meta.glob(
  ["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../i18n/**"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
) as Record<string, string>;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const holes = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("English for the operator screens", () => {
  afterEach(() => setLang("id"));
  // Every literal passed to t("…") in the app has an English entry with the
  // same {placeholders}.
  const literals = Object.entries(sources).flatMap(([file, code]) =>
    [
      ...code.matchAll(
        /\bt\(\s*(?:"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)')/g,
      ),
    ].map((m) => ({ file, text: norm((m[1] ?? m[2]).replace(/\\"/g, '"')) })),
  );
  it("finds the translated texts", () => {
    expect(literals.length).toBeGreaterThan(300);
  });
  it("has an English text for every t() literal", () => {
    const missing = literals
      .filter(({ text }) => EN[text] === undefined)
      .map(({ file, text }) => `${file}: ${text}`);
    expect(missing).toEqual([]);
  });
  it("keeps the same {placeholders}", () => {
    const wrong = Object.entries(EN).filter(([id, en]) =>
      en.split("|").some((form) => holes(id).join() !== holes(form).join()),
    );
    expect(wrong).toEqual([]);
  });
  it("translates fixed texts, run-time messages and placeholders; Indonesian is the default", () => {
    expect(t("Tambah lagu")).toBe("Tambah lagu");
    setLang("en");
    expect(t("Tambah lagu")).toBe("Add song");
    expect(t("{n} lagu", { n: 3 })).toBe("3 songs");
    expect(t("{n} lagu", { n: 1 })).toBe("1 song");
    expect(t("{n} bagian", { n: 1 })).toBe("1 part");
    expect(t("Checkpoint tersimpan · LIVE 4")).toBe(
      "Checkpoint saved · LIVE 4",
    );
    expect(
      t(
        "Draft tersimpan. Isi judul lagu dan lirik minimal satu bagian untuk menyimpan lagu.",
      ),
    ).toBe(
      "Draft saved. Fill in the song title and lyrics in at least one part to save the song.",
    );
    // Unknown text (e.g. lyrics) is never changed.
    expect(t("Kasih setia-Mu tak berkesudahan")).toBe(
      "Kasih setia-Mu tak berkesudahan",
    );
  });
});
