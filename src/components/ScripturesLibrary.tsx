import { useEffect, useRef, useState } from "react";
import {
  ScriptureRepository,
  selectionLabel,
} from "../data/scriptureRepository";
import {
  ImportCoordinator,
  type ImportState,
} from "../scriptures/importCoordinator";
import {
  reference,
  SELECTION_LIMIT,
  type Translation,
  type Verse,
  type ScriptureSelection,
} from "../scriptures/models";
import { resolveReference } from "../scriptures/references";
import { SearchClient } from "../scriptures/searchClient";
import type { Workspace } from "../domain/models";
import { ScriptureImportDialog } from "./ScriptureImportDialog";
export function ScripturesLibrary({
  repo,
  importer,
  importState,
  data,
  editable,
  busy,
  onPreview,
  onChanged,
}: {
  repo: ScriptureRepository;
  importer: ImportCoordinator;
  importState: ImportState;
  data: Workspace;
  editable: boolean;
  busy: boolean;
  onPreview: (selection: ScriptureSelection) => void;
  onChanged: () => void;
}) {
  const translations = data.translations ?? [],
    [datasetId, setDataset] = useState(""),
    [bookId, setBook] = useState(""),
    [chapter, setChapter] = useState(1),
    [verses, setVerses] = useState<Verse[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [textQuery, setTextQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [results, setResults] = useState<{ total: number; results: Verse[] }>({
      total: 0,
      results: [],
    }),
    [searching, setSearching] = useState(false);
  const cache = useRef(new Map<string, Verse>()),
    search = useRef(new SearchClient()),
    request = useRef(0),
    referenceRequest = useRef(0);
  const translation = translations.find((t) => t.id === datasetId),
    book = translation?.books.find((b) => b.id === bookId);
  useEffect(() => {
    if (!translations.some((t) => t.id === datasetId)) {
      const t = translations[0];
      setDataset(t?.id ?? "");
      setBook(t?.books[0].id ?? "");
      setChapter(t?.books[0].chapters[0].number ?? 1);
      setSelected([]);
      referenceRequest.current++;
      cache.current.clear();
    }
  }, [translations, datasetId]);
  useEffect(() => {
    const token = ++request.current;
    if (!translation || !book) {
      setVerses([]);
      return;
    }
    setVerses([]);
    void repo
      .chapter(translation.id, book.id, chapter)
      .then((rows) => {
        if (token !== request.current) return;
        rows.forEach((v) => cache.current.set(v.id, v));
        setVerses(rows);
        setError("");
      })
      .catch((e) => {
        if (token === request.current) setError(e.message);
      });
  }, [repo, translation, book, chapter]);
  useEffect(() => {
    if (!translation || !textQuery.trim()) {
      search.current.cancel();
      setResults({ total: 0, results: [] });
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(
      () =>
        void search.current.query(
          repo,
          translation,
          textQuery,
          offset,
          (result) => {
            result.results.forEach((v) => cache.current.set(v.id, v));
            setResults(result);
            setSearching(false);
          },
          (message) => {
            setError(message);
            setSearching(false);
          },
        ),
      250,
    );
    return () => {
      clearTimeout(timer);
      search.current.cancelQuery();
    };
  }, [repo, translation, textQuery, offset]);
  useEffect(
    () => () => {
      search.current.cancel();
      referenceRequest.current++;
    },
    [],
  );
  function changeTranslation(id: string) {
    if (
      selected.length &&
      !window.confirm("Kosongkan pilihan saat mengganti terjemahan?")
    )
      return;
    referenceRequest.current++;
    const t = translations.find((t) => t.id === id);
    setDataset(id);
    setBook(t?.books[0].id ?? "");
    setChapter(t?.books[0].chapters[0].number ?? 1);
    setSelected([]);
    setTextQuery("");
    setQuery("");
    cache.current.clear();
    search.current.cancel();
  }
  function choose(v: Verse) {
    referenceRequest.current++;
    cache.current.set(v.id, v);
    if (!selected.includes(v.id) && selected.length >= SELECTION_LIMIT) {
      setError("Maksimal 500 ayat per pilihan.");
      return;
    }
    setSelected((previous) =>
      previous.includes(v.id)
        ? previous.filter((id) => id !== v.id)
        : [...previous, v.id].sort(),
    );
  }
  function selection(): ScriptureSelection {
    if (!translation || !selected.length)
      throw new Error("Pilih ayat terlebih dahulu.");
    const rows = selected.map((key) => cache.current.get(key));
    if (rows.some((v) => !v)) throw new Error("Pilihan perlu dimuat ulang.");
    return {
      datasetId: translation.id,
      checksum: translation.contentHash,
      verseIds: selected,
      label: selectionLabel(translation, rows as Verse[]),
    };
  }
  async function searchReference() {
    if (!translation) return;
    const token = ++referenceRequest.current;
    try {
      const ids = resolveReference(translation, query),
        combined = [...new Set([...selected, ...ids])].sort();
      if (combined.length > SELECTION_LIMIT)
        throw new Error("Maksimal 500 ayat.");
      const chosen = {
        datasetId: translation.id,
        checksum: translation.contentHash,
        verseIds: ids,
        label: "Pilihan ayat",
      };
      const snapshot = await repo.resolve(chosen);
      if (token !== referenceRequest.current) return;
      snapshot.verses.forEach((v) => cache.current.set(v.id, v));
      setSelected(combined);
      const first = snapshot.verses[0];
      setBook(first.book);
      setChapter(first.chapter);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function add() {
    try {
      const s = data.schedules.find((s) => s.id === data.activeId);
      if (!s) throw new Error("Pilih jadwal aktif.");
      await repo.addToSchedule(s.id, selection(), s.revision);
      onChanged();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove() {
    if (!translation) return;
    const count = data.items.filter(
      (i) => i.type === "scripture" && i.selection.datasetId === translation.id,
    ).length;
    if (
      !window.confirm(
        `Hapus dataset “${translation.info.name}” dan ${count} item jadwal terkait? LIVE/checkpoint yang telah dibekukan tidak dihapus. Tindakan permanen.`,
      )
    )
      return;
    try {
      await repo.deleteDataset(translation.id, translation.contentHash);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const renderVerse = (v: Verse) => (
    <li key={v.id}>
      <label>
        <input
          type="checkbox"
          aria-label={reference(translation!, v)}
          checked={selected.includes(v.id)}
          onChange={() => choose(v)}
        />
        <strong>{reference(translation!, v)}</strong>
      </label>
      <p className="exact-text">{v.text}</p>
    </li>
  );
  return (
    <div className="scriptures-content">
      <ScriptureImportDialog
        importer={importer}
        state={importState}
        editable={editable}
      />
      {error && (
        <div className="alert" role="alert">
          {error}
          <button onClick={() => setError("")}>Tutup</button>
        </div>
      )}
      {!translations.length ? (
        <div className="library-empty">
          <div>
            <h3>Belum ada dataset Alkitab</h3>
            <p>
              Impor file JSON yang Anda berhak gunakan. Tidak ada terjemahan
              bawaan.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="scripture-selectors">
            <label>
              Terjemahan
              <select
                aria-label="Terjemahan"
                value={datasetId}
                onChange={(e) => changeTranslation(e.target.value)}
              >
                {translations.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.info.name} · {t.info.abbreviation} ({t.info.edition})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kitab
              <select
                aria-label="Kitab"
                value={bookId}
                onChange={(e) => {
                  setBook(e.target.value);
                  setChapter(
                    translation!.books.find((b) => b.id === e.target.value)!
                      .chapters[0].number,
                  );
                }}
              >
                {translation?.books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pasal
              <select
                aria-label="Pasal"
                value={chapter}
                onChange={(e) => setChapter(Number(e.target.value))}
              >
                {book?.chapters.map((c) => (
                  <option key={c.number}>{c.number}</option>
                ))}
              </select>
            </label>
          </div>
          {translation && (
            <p className="field-help">
              {translation.info.publisher} · {translation.info.edition} ·{" "}
              {translation.info.versification} · {translation.info.coverage} ·{" "}
              {translation.verseCount} ayat
            </p>
          )}
          <form
            className="reference-search"
            onSubmit={(e) => {
              e.preventDefault();
              void searchReference();
            }}
          >
            <label>
              Referensi ayat
              <input
                aria-label="Referensi ayat"
                placeholder="John 3:16-18,20"
                maxLength={250}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              className="button secondary"
              disabled={!translation || !query.trim()}
            >
              Cari referensi
            </button>
          </form>
          <div className="selection-bar">
            <strong>{selected.length} ayat dipilih</strong>
            <button
              className="button secondary"
              disabled={!selected.length || busy}
              onClick={() => {
                try {
                  onPreview(selection());
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Preview ayat
            </button>
            <button
              className="button primary"
              disabled={!editable || busy || !selected.length || !data.activeId}
              onClick={() => void add()}
            >
              Tambahkan ayat ke jadwal
            </button>
            <button
              className="text-button"
              disabled={!selected.length}
              onClick={() => {
                referenceRequest.current++;
                setSelected([]);
              }}
            >
              Kosongkan pilihan
            </button>
          </div>
          <ul className="scripture-verses" aria-label="Daftar ayat">
            {translation && verses.map(renderVerse)}
          </ul>
          <div className="scripture-text-search">
            <label>
              Cari teks ayat
              <input
                aria-label="Cari teks ayat"
                maxLength={200}
                value={textQuery}
                onChange={(e) => {
                  setTextQuery(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            {searching && <p role="status">Mencari offline…</p>}
            {textQuery.trim() && !searching && (
              <p role="status">
                {results.total} hasil · halaman {Math.floor(offset / 100) + 1}
              </p>
            )}
            <ul className="scripture-verses" aria-label="Hasil pencarian">
              {translation && results.results.map(renderVerse)}
            </ul>
            {results.total > 100 && (
              <div className="preview-navigation">
                <button
                  className="button secondary"
                  disabled={offset === 0 || searching}
                  onClick={() => setOffset(offset - 100)}
                >
                  Hasil sebelumnya
                </button>
                <button
                  className="button secondary"
                  disabled={offset + 100 >= results.total || searching}
                  onClick={() => setOffset(offset + 100)}
                >
                  Hasil berikutnya
                </button>
              </div>
            )}
          </div>
          <button
            className="button secondary danger"
            disabled={!editable || busy}
            onClick={() => void remove()}
          >
            Hapus terjemahan
          </button>
          <p className="field-help">
            Simpan file sumber berizin Anda. Checkpoint bukan backup dataset.
            Teks dan atribusi tidak diedit otomatis.
          </p>
        </>
      )}
    </div>
  );
}
