import { useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import type { ScriptureRepository } from "../data/scriptureRepository";
import type {
  ImportCoordinator,
  ImportState,
} from "../scriptures/importCoordinator";
import type { Workspace } from "../domain/models";
import {
  verseKey,
  type ScriptureSelection,
  type Translation,
  type Verse,
} from "../scriptures/models";
import { resolveReference } from "../scriptures/references";
import {
  BUNDLED_BIBLES,
  ENGLISH,
  INDONESIAN,
  downloadBible,
  findBible,
} from "../scriptures/bilingual";
type Target = { id: string; name: string; revision: number };
/** Waits until the importer reaches one of the given phases. */
function settle(importer: ImportCoordinator, phases: ImportState["phase"][]) {
  return new Promise<ImportState>((resolve) => {
    let stop = () => {};
    const check = () => {
      const state = importer.snapshot();
      if (phases.includes(state.phase)) {
        stop();
        resolve(state);
      }
    };
    stop = importer.subscribe(check);
    check();
  });
}
/**
 * Scriptures tab: the two-language Bible. Pick a book, chapter and verse
 * range (or type "Kej 1:3-10"); the verses show side by side, Indonesian
 * (AYT) on the left and English (KJV) on the right, and Preview / LIVE use
 * the same two columns.
 */
export function BibleLibrary({
  repo,
  importer,
  importState,
  data,
  editable,
  busy,
  onPreview,
  onChanged,
  onTarget,
}: {
  repo: ScriptureRepository;
  importer: ImportCoordinator;
  importState: ImportState;
  data: Workspace;
  editable: boolean;
  busy: boolean;
  onPreview: (selection: ScriptureSelection) => void;
  onChanged: () => void;
  /** The Week verses are added to: the active one, else Week 1. */
  onTarget: () => Promise<Target>;
}) {
  const translations = data.translations ?? [],
    id = findBible(INDONESIAN, translations),
    en = findBible(ENGLISH, translations);
  return (
    <div className="scriptures-content">
      <section className="bible-section" aria-label="Alkitab / Bible">
        <div className="bible-heading">
          <span className="library-art" aria-hidden="true">
            <BookOpen size={22} />
          </span>
          <div>
            <h3>Alkitab / Bible</h3>
            <p>
              Indonesia (AYT) di kiri · English (KJV) di kanan · tersimpan
              offline
            </p>
          </div>
        </div>
        {id && en ? (
          <Picker
            repo={repo}
            id={id}
            en={en}
            editable={editable}
            busy={busy}
            onPreview={onPreview}
            onChanged={onChanged}
            onTarget={onTarget}
          />
        ) : (
          <Install
            importer={importer}
            importState={importState}
            translations={translations}
            editable={editable}
          />
        )}
      </section>
    </div>
  );
}

function Install({
  importer,
  importState,
  translations,
  editable,
}: {
  importer: ImportCoordinator;
  importState: ImportState;
  translations: Translation[];
  editable: boolean;
}) {
  const [agreed, setAgreed] = useState(false),
    [working, setWorking] = useState(""),
    [error, setError] = useState("");
  async function install() {
    setError("");
    try {
      for (const bible of BUNDLED_BIBLES) {
        if (findBible(bible, translations)) continue;
        setWorking(`Mengunduh ${bible.label}…`);
        const file = await downloadBible(bible);
        setWorking(`Memeriksa ${bible.label}…`);
        void importer.choose(file);
        const checked = await settle(importer, ["review", "error", "idle"]);
        if (checked.phase !== "review")
          throw new Error(checked.message || "Validasi gagal.");
        setWorking(`Menyimpan ${bible.label}…`);
        await importer.confirm(true);
        const saved = importer.snapshot();
        if (saved.phase !== "done")
          throw new Error(saved.message || "Gagal menyimpan.");
      }
      setWorking("");
    } catch (e) {
      setWorking("");
      setError((e as Error).message);
    }
  }
  const progress =
    importState.phase === "writing" ? ` ${importState.progress}%` : "";
  return (
    <div className="bible-install">
      <ul className="bible-editions">
        <li>
          <strong>Indonesia · Alkitab Yang Terbuka (AYT)</strong>
          <span>
            © 2011–2024 YLSA · Creative Commons BY-NC-SA (non-komersial,
            sebutkan sumber)
          </span>
        </li>
        <li>
          <strong>English · King James Version (KJV, 1769)</strong>
          <span>Public Domain</span>
        </li>
      </ul>
      <p className="field-help">
        Kejadian sampai Wahyu, 66 kitab, 31.102 ayat per bahasa. Diunduh sekali
        (sekitar 3 MB), lalu tersimpan offline di perangkat ini.
      </p>
      <label className="attestation">
        <input
          type="checkbox"
          checked={agreed}
          disabled={!editable || !!working}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        Alkitab ini dipakai untuk ibadah non-komersial, dengan atribusi di
        setiap slide, sesuai lisensi AYT dan KJV.
      </label>
      <button
        className="button primary"
        disabled={!editable || !agreed || !!working}
        onClick={() => void install()}
      >
        {working ? `${working}${progress}` : "Pasang Alkitab"}
      </button>
      {!editable && (
        <p className="field-help">Tab ini hanya baca; pasang dari tab edit.</p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

function Picker({
  repo,
  id,
  en,
  editable,
  busy,
  onPreview,
  onChanged,
  onTarget,
}: {
  repo: ScriptureRepository;
  id: Translation;
  en: Translation;
  editable: boolean;
  busy: boolean;
  onPreview: (selection: ScriptureSelection) => void;
  onChanged: () => void;
  onTarget: () => Promise<Target>;
}) {
  const [bookId, setBook] = useState(id.books[0].id),
    [chapter, setChapter] = useState(1),
    [from, setFrom] = useState(1),
    [to, setTo] = useState(1),
    [query, setQuery] = useState(""),
    [rows, setRows] = useState<{ left: Verse[]; right: Verse[] }>({
      left: [],
      right: [],
    }),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const book = id.books.find((b) => b.id === bookId) ?? id.books[0],
    english = en.books.find((b) => b.id === book.id),
    verses =
      book.chapters.find((c) => c.number === chapter)?.verses ??
      book.chapters[0].verses;
  useEffect(() => {
    let current = true;
    setRows({ left: [], right: [] });
    void Promise.all([
      repo.chapter(id.id, book.id, chapter),
      repo.chapter(en.id, book.id, chapter),
    ])
      .then(([left, right]) => {
        if (current) setRows({ left, right });
      })
      .catch((e) => current && setError((e as Error).message));
    return () => {
      current = false;
    };
  }, [repo, id.id, en.id, book.id, chapter]);
  const shown = useMemo(
    () =>
      range(from, to).map((n) => ({
        n,
        left: rows.left.find((v) => v.verse === n),
        right: rows.right.find((v) => v.verse === n),
      })),
    [rows, from, to],
  );
  const label = `${book.name} ${chapter}:${from}${to > from ? `–${to}` : ""}`;
  function selection(): ScriptureSelection {
    return {
      datasetId: id.id,
      checksum: id.contentHash,
      verseIds: range(from, to).map((n) =>
        verseKey(id.id, book.order, chapter, n),
      ),
      label,
    };
  }
  function choose(nextBook: string, nextChapter: number, a = 1, b = a) {
    setBook(nextBook);
    setChapter(nextChapter);
    setFrom(a);
    setTo(b);
    setMessage("");
    setError("");
  }
  function lookup() {
    try {
      const keys = resolveReference(id, query);
      const parts = keys.map((key) => key.split("|"));
      const [, , order, ch] = parts[0];
      const numbers = parts.map((p) => Number(p[4]));
      if (
        parts.some((p) => p[2] !== order || p[3] !== ch) ||
        numbers.some((n, i) => i > 0 && n !== numbers[i - 1] + 1)
      )
        throw new Error(
          "Pilih satu rentang dalam satu pasal, misalnya Kej 1:3-10.",
        );
      const target = id.books.find((b) => b.order === Number(order))!;
      choose(target.id, Number(ch), numbers[0], numbers.at(-1));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function add() {
    try {
      const schedule = await onTarget();
      await repo.addToSchedule(schedule.id, selection(), schedule.revision);
      onChanged();
      setError("");
      setMessage(`${label} ditambahkan ke ${schedule.name}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="bible-picker" data-live-shortcuts="off">
      <form
        className="bible-reference"
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <label>
          Cari cepat
          <input
            aria-label="Cari ayat"
            placeholder="Kej 1:3-10 atau John 3:16"
            maxLength={60}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="button secondary" disabled={!query.trim()}>
          Pilih
        </button>
      </form>
      <div className="bible-selectors">
        <label>
          Kitab
          <select
            aria-label="Kitab"
            value={book.id}
            onChange={(e) => choose(e.target.value, 1)}
          >
            {id.books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {en.books.find((x) => x.id === b.id)?.name ?? b.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pasal
          <select
            aria-label="Pasal"
            value={chapter}
            onChange={(e) => choose(book.id, Number(e.target.value))}
          >
            {book.chapters.map((c) => (
              <option key={c.number} value={c.number}>
                {c.number}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ayat
          <select
            aria-label="Ayat dari"
            value={from}
            onChange={(e) => {
              const value = Number(e.target.value);
              setFrom(value);
              if (to < value) setTo(value);
            }}
          >
            {verses.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          sampai
          <select
            aria-label="Ayat sampai"
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
          >
            {verses
              .filter((n) => n >= from)
              .map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="bible-actions">
        <strong>
          {label}
          {english
            ? ` · ${english.name} ${chapter}:${from}${to > from ? `–${to}` : ""}`
            : ""}
        </strong>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => onPreview(selection())}
        >
          Preview
        </button>
        <button
          className="button primary"
          disabled={!editable || busy}
          onClick={() => void add()}
        >
          Tambahkan ke jadwal
        </button>
      </div>
      {message && (
        <p className="field-help" role="status">
          {message}
        </p>
      )}
      {error && (
        <div className="alert" role="alert">
          {error}
          <button onClick={() => setError("")}>Tutup</button>
        </div>
      )}
      <div className="bible-columns" role="table" aria-label="Ayat dua bahasa">
        <div className="bible-row bible-head" role="row">
          <span role="columnheader">Ayat</span>
          <span role="columnheader">Indonesia · AYT</span>
          <span role="columnheader">English · KJV</span>
        </div>
        {shown.map(({ n, left, right }) => (
          <div className="bible-row" role="row" key={n}>
            <span role="cell" className="bible-number">
              {chapter}:{n}
            </span>
            <span role="cell" className="exact-text">
              {left?.text ?? "…"}
            </span>
            <span role="cell" className="exact-text">
              {right?.text ?? "…"}
            </span>
          </div>
        ))}
      </div>
      <p className="field-help">
        AYT © YLSA · CC BY-NC-SA · KJV Public Domain. Atribusi ikut tampil di
        setiap slide.
      </p>
    </div>
  );
}
