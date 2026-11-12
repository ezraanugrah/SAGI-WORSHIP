import { t } from "../i18n";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import {
  ESV_LINKS,
  LAI_BASE,
  ONLINE_ATTRIBUTION,
  ONLINE_LIMIT,
  OnlineCache,
  ensureOnline,
  esvPassageUrl,
  fetchEsv,
  fetchLai,
  fetchSabda,
  sabdaChapterUrl,
  loadSettings,
  saveSettings,
  usesOnline,
  type OnlineSettings,
} from "../scriptures/online";
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
  background,
}: {
  /** Latar ayat: the verses' own background (not the Themes one). */
  background?: ReactNode;
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
              {t(
                "Indonesia (AYT) di kiri · English (KJV) di kanan · tersimpan offline",
              )}
            </p>
          </div>
        </div>
        {background}
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
        setWorking(t("Mengunduh {name}…", { name: bible.label }));
        const file = await downloadBible(bible);
        setWorking(t("Memeriksa {name}…", { name: bible.label }));
        void importer.choose(file);
        const checked = await settle(importer, ["review", "error", "idle"]);
        if (checked.phase !== "review")
          throw new Error(checked.message || "Validasi gagal.");
        setWorking(t("Menyimpan {name}…", { name: bible.label }));
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
            {t(
              "© 2011–2024 YLSA · Creative Commons BY-NC-SA (non-komersial, sebutkan sumber)",
            )}
          </span>
        </li>
        <li>
          <strong>English · King James Version (KJV, 1769)</strong>
          <span>Public Domain</span>
        </li>
      </ul>
      <p className="field-help">
        {t(
          "Kejadian sampai Wahyu, 66 kitab, 31.102 ayat per bahasa. Diunduh sekali (sekitar 3 MB), lalu tersimpan offline di perangkat ini.",
        )}
      </p>
      <label className="attestation">
        <input
          type="checkbox"
          checked={agreed}
          disabled={!editable || !!working}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        {t(
          "Alkitab ini dipakai untuk ibadah non-komersial, dengan atribusi di setiap slide, sesuai lisensi AYT dan KJV.",
        )}
      </label>
      <button
        className="button primary"
        disabled={!editable || !agreed || !!working}
        onClick={() => void install()}
      >
        {working ? `${working}${progress}` : t("Pasang Alkitab")}
      </button>
      {!editable && (
        <p className="field-help">
          {t("Tab ini hanya baca; pasang dari tab edit.")}
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {t(error)}
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
    [error, setError] = useState(""),
    [settings, setSettings] = useState(() => loadSettings()),
    [cache] = useState(() => new OnlineCache()),
    // Bumped after online text is cached so the table re-reads it.
    [cached, setCached] = useState(0),
    [fetching, setFetching] = useState(false);
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
  const online = usesOnline(settings),
    passage = {
      book: {
        id: book.id,
        order: book.order,
        idName: book.name,
        enName: english?.name ?? book.id,
      },
      chapter,
      from,
      to,
    };
  /** Fetches TB2/ESV for the picked verses; errors are shown, never thrown. */
  async function fetchOnline() {
    if (!online) return;
    setFetching(true);
    try {
      await ensureOnline(settings, passage, cache);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFetching(false);
      setCached((n) => n + 1);
    }
  }
  useEffect(() => {
    if (!online) return;
    const timer = setTimeout(() => void fetchOnline(), 500);
    return () => clearTimeout(timer);
  }, [online, settings, book.id, chapter, from, to]);
  const shown = useMemo(
    () =>
      range(from, to).map((n) => ({
        n,
        left:
          settings.left === "ayt"
            ? rows.left.find((v) => v.verse === n)?.text
            : cache.get(settings.left, book.id, chapter, n),
        right:
          settings.right === "esv"
            ? cache.get("esv", book.id, chapter, n)
            : rows.right.find((v) => v.verse === n)?.text,
      })),
    [rows, from, to, settings, cached, book.id, chapter],
  );
  const leftName =
      settings.left === "tb"
        ? "TB (SABDA)"
        : settings.left === "tb2"
          ? "TB2 (online)"
          : "AYT",
    rightName = settings.right === "esv" ? "ESV (online)" : "KJV";
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
    await fetchOnline();
    try {
      const schedule = await onTarget();
      await repo.addToSchedule(schedule.id, selection(), schedule.revision);
      onChanged();
      setError("");
      setMessage(
        t("{label} ditambahkan ke {name}.", { label, name: schedule.name }),
      );
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
          {t("Cari cepat")}
          <input
            aria-label="Cari ayat"
            placeholder={t("Kej 1:3-10 atau John 3:16")}
            maxLength={60}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="button secondary" disabled={!query.trim()}>
          {t("Pilih")}
        </button>
      </form>
      <div className="bible-selectors">
        <label>
          {t("Kitab")}
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
          {t("Pasal")}
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
          {t("Ayat")}
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
          {t("sampai")}
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
        <a
          className="bible-esv-link"
          href={sabdaChapterUrl(book.order, chapter)}
          target="_blank"
          rel="noreferrer"
          title={t("Buka pasal ini (TB) di sabda.org")}
        >
          sabda.org ↗
        </a>
        {english && (
          <a
            className="bible-esv-link"
            href={esvPassageUrl(english.name, chapter, from, to)}
            target="_blank"
            rel="noreferrer"
            title={t("Buka perikop ini di www.esv.org")}
          >
            esv.org ↗
          </a>
        )}
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void fetchOnline().then(() => onPreview(selection()))}
        >
          Preview
        </button>
        <button
          className="button primary"
          disabled={!editable || busy}
          onClick={() => void add()}
        >
          {t("Tambahkan ke jadwal")}
        </button>
      </div>
      {message && (
        <p className="field-help" role="status">
          {t(message)}
        </p>
      )}
      {fetching && (
        <p className="field-help" role="status">
          {t("Mengambil {what} dari API resmi…", {
            what: [
              settings.left === "tb" && t("TB dari Alkitab SABDA"),
              settings.left === "tb2" && "TB2",
              settings.right === "esv" && "ESV",
            ]
              .filter(Boolean)
              .join(` ${t("dan")} `),
          })}
        </p>
      )}
      {error && (
        <div className="alert" role="alert">
          {t(error)}
          <button onClick={() => setError("")}>{t("Tutup")}</button>
        </div>
      )}
      <div className="bible-columns" role="table" aria-label="Ayat dua bahasa">
        <div className="bible-row bible-head" role="row">
          <span role="columnheader">{t("Ayat")}</span>
          <span role="columnheader">Indonesia · {leftName}</span>
          <span role="columnheader">English · {rightName}</span>
        </div>
        {shown.map(({ n, left, right }) => (
          <div className="bible-row" role="row" key={n}>
            <span role="cell" className="bible-number">
              {chapter}:{n}
            </span>
            <span role="cell" className="exact-text">
              {left ?? "…"}
            </span>
            <span role="cell" className="exact-text">
              {right ?? "…"}
            </span>
          </div>
        ))}
      </div>
      <p className="field-help">
        {settings.left === "tb"
          ? `${ONLINE_ATTRIBUTION.tb} (Alkitab SABDA)`
          : settings.left === "tb2"
            ? ONLINE_ATTRIBUTION.tb2
            : "AYT © YLSA · CC BY-NC-SA"}{" "}
        ·{" "}
        {settings.right === "esv" ? (
          <>
            ESV® © Crossway ·{" "}
            <a href="https://www.esv.org" target="_blank" rel="noreferrer">
              www.esv.org
            </a>
          </>
        ) : (
          "KJV Public Domain"
        )}
        . {t("Atribusi ikut tampil di setiap slide.")}
      </p>
      <OnlineSources
        settings={settings}
        cache={cache}
        onChange={(next) => {
          setSettings(next);
          setCached((n) => n + 1);
        }}
      />
    </div>
  );
}

/**
 * ESV (esv.org's official ESV API) and TB2 (LAI Bible API) with the
 * church's own API keys,
 * kept only in this browser. See src/scriptures/online.ts for the rules.
 */
function OnlineSources({
  settings,
  cache,
  onChange,
}: {
  settings: OnlineSettings;
  cache: OnlineCache;
  onChange: (settings: OnlineSettings) => void;
}) {
  const [tb2Key, setTb2Key] = useState(settings.tb2?.key ?? ""),
    [tb2Base, setTb2Base] = useState(settings.tb2?.base ?? LAI_BASE),
    [tb2Version, setTb2Version] = useState(settings.tb2?.version ?? "tb2"),
    [tb2Agreed, setTb2Agreed] = useState(settings.tb2?.agreed ?? false),
    [esvKey, setEsvKey] = useState(settings.esv?.key ?? ""),
    [esvAgreed, setEsvAgreed] = useState(settings.esv?.agreed ?? false),
    [tbAgreed, setTbAgreed] = useState(settings.tb?.agreed ?? false),
    [status, setStatus] = useState({ tb: "", tb2: "", esv: "" }),
    [, setTick] = useState(0);
  const tb2 = {
      key: tb2Key.trim(),
      base: tb2Base.trim() || LAI_BASE,
      version: tb2Version.trim() || "tb2",
      agreed: tb2Agreed,
    },
    esv = { key: esvKey.trim(), agreed: esvAgreed };
  function save(
    next: OnlineSettings,
    version: "tb" | "tb2" | "esv",
    note: string,
  ) {
    try {
      saveSettings(next);
      onChange(next);
      setStatus((s) => ({ ...s, [version]: note }));
    } catch (e) {
      setStatus((s) => ({ ...s, [version]: (e as Error).message }));
    }
  }
  const refresh = () => setTick((n) => n + 1),
    counts = {
      tb: cache.count("tb"),
      tb2: cache.count("tb2"),
      esv: cache.count("esv"),
    };
  async function test(version: "tb" | "tb2" | "esv") {
    setStatus((s) => ({ ...s, [version]: "Menguji…" }));
    try {
      if (version === "tb") {
        const [v] = await fetchSabda("Yohanes", 43, 3, 16, 16);
        setStatus((s) => ({ ...s, tb: `Berhasil · Yohanes 3:16: ${v.text}` }));
      } else if (version === "esv") {
        const [v] = await fetchEsv(esv.key, 1, 1, 1, 1);
        setStatus((s) => ({ ...s, esv: `Berhasil · Genesis 1:1: ${v.text}` }));
      } else {
        const checked: string[] = [];
        for (const [name, chapter] of [
          ["Kejadian", 1],
          ["1 Raja-raja", 1],
          ["Kisah Para Rasul", 1],
          ["Wahyu", 22],
        ] as const) {
          await fetchLai(tb2, name, chapter, 1, 1);
          checked.push(`${name} ${chapter}:1`);
        }
        setStatus((s) => ({ ...s, tb2: `Berhasil · ${checked.join(", ")}` }));
      }
    } catch (e) {
      setStatus((s) => ({ ...s, [version]: (e as Error).message }));
    }
  }
  return (
    <details className="bible-online">
      <summary>
        {t("Sumber online: TB (SABDA), ESV (esv.org), TB2 (LAI)")}
      </summary>
      <p className="field-help">
        {t(
          "Teks diambil per perikop dari sumber resmi. Pengaturan dan API key hanya disimpan di browser ini (tidak ikut backup). Hanya ayat yang dipilih yang diambil, maks. {n} ayat per versi, terhapus otomatis setelah 30 hari. Tanpa internet, ayat yang belum tersimpan memakai AYT/KJV.",
          { n: ONLINE_LIMIT },
        )}
      </p>
      <div className="bible-columns-choice">
        <label>
          {t("Kolom kiri (Indonesia)")}
          <select
            aria-label="Kolom kiri"
            value={settings.left}
            onChange={(e) =>
              save(
                { ...settings, left: e.target.value as OnlineSettings["left"] },
                "tb2",
                "",
              )
            }
          >
            <option value="ayt">AYT · offline</option>
            <option value="tb" disabled={!settings.tb?.agreed}>
              TB · online (Alkitab SABDA)
            </option>
            <option value="tb2" disabled={!settings.tb2?.agreed}>
              TB2 · online (Bible API LAI)
            </option>
          </select>
        </label>
        <label>
          {t("Kolom kanan (English)")}
          <select
            aria-label="Kolom kanan"
            value={settings.right}
            onChange={(e) =>
              save(
                {
                  ...settings,
                  right: e.target.value as OnlineSettings["right"],
                },
                "esv",
                "",
              )
            }
          >
            <option value="kjv">KJV · offline</option>
            <option value="esv" disabled={!settings.esv?.agreed}>
              ESV · online (ESV API)
            </option>
          </select>
        </label>
      </div>
      <fieldset className="bible-api">
        <legend>TB · Alkitab SABDA (sabda.org)</legend>
        <p className="field-help">
          {t("Alkitab Terjemahan Baru 1974 © LAI, diambil per perikop dari")}{" "}
          <a
            href="https://sabda.org/alkitab/tb/"
            target="_blank"
            rel="noreferrer"
          >
            Alkitab SABDA
          </a>
          . {t("Tanpa API key. Sesuai")}{" "}
          <a
            href="https://www.alkitab.or.id/tentang-kami/penggunaan-teks"
            target="_blank"
            rel="noreferrer"
          >
            {t("kebijakan teks LAI")}
          </a>
          ,{" "}
          {t(
            "kutipan untuk ibadah non-komersial (bukan satu kitab utuh) boleh tanpa izin tertulis.",
          )}
        </p>
        <label className="attestation">
          <input
            type="checkbox"
            checked={tbAgreed}
            onChange={(e) => setTbAgreed(e.target.checked)}
          />
          {t(
            'TB dipakai untuk ibadah non-komersial, per perikop, dengan atribusi "TB © LAI 1974" di setiap slide.',
          )}
        </label>
        <div className="bible-api-actions">
          <button
            className="button primary"
            disabled={!tbAgreed}
            onClick={() =>
              save(
                { ...settings, tb: { agreed: true }, left: "tb" },
                "tb",
                t("TB aktif di Kolom kiri."),
              )
            }
          >
            {t("Pakai TB")}
          </button>
          <button className="button secondary" onClick={() => void test("tb")}>
            {t("Tes TB")}
          </button>
          <button
            className="text-button"
            disabled={!settings.tb}
            onClick={() => {
              cache.clear("tb");
              refresh();
              setTbAgreed(false);
              save(
                {
                  ...settings,
                  tb: null,
                  left: settings.left === "tb" ? "ayt" : settings.left,
                },
                "tb",
                t("TB dimatikan dan cache-nya dihapus."),
              );
            }}
          >
            {t("Matikan TB")}
          </button>
        </div>
        {status.tb && (
          <p className="field-help" role="status">
            {t(status.tb)}
          </p>
        )}
      </fieldset>
      <fieldset className="bible-api">
        <legend>ESV · esv.org (Crossway)</legend>
        <ol className="bible-steps">
          <li>
            <a href={ESV_LINKS.register} target="_blank" rel="noreferrer">
              {t("Buat akun gratis di esv.org")}
            </a>{" "}
            {t("atas nama gereja, atau")}{" "}
            <a href={ESV_LINKS.signIn} target="_blank" rel="noreferrer">
              {t("masuk")}
            </a>
            .
          </li>
          <li>
            <a href={ESV_LINKS.createKey} target="_blank" rel="noreferrer">
              {t("Buat aplikasi di api.esv.org")}
            </a>
            :{" "}
            {t(
              'beri nama (mis. SagiWorship) dan keterangan "proyeksi ayat untuk ibadah gereja, non-komersial".',
            )}
          </li>
          <li>
            {t(
              "Salin API key aplikasi itu ke kolom di bawah, centang ketentuan, klik Simpan ESV lalu Tes ESV.",
            )}
          </li>
        </ol>
        <label>
          {t("API key ESV")}
          <input
            aria-label="API key ESV"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={esvKey}
            onChange={(e) => setEsvKey(e.target.value)}
          />
        </label>
        <label className="attestation">
          <input
            type="checkbox"
            checked={esvAgreed}
            onChange={(e) => setEsvAgreed(e.target.checked)}
          />
          {t("Dipakai untuk ibadah non-komersial sesuai")}{" "}
          <a href={ESV_LINKS.terms} target="_blank" rel="noreferrer">
            {t("ketentuan ESV API")}
          </a>
          :{" "}
          {t(
            "paling banyak 500 ayat tersimpan, teks tidak diubah, atribusi ESV dan www.esv.org.",
          )}
        </label>
        <div className="bible-api-actions">
          <button
            className="button primary"
            disabled={!esv.key || !esvAgreed}
            onClick={() =>
              save(
                { ...settings, esv },
                "esv",
                t("Tersimpan di perangkat ini. Pilih ESV di Kolom kanan."),
              )
            }
          >
            {t("Simpan ESV")}
          </button>
          <button
            className="button secondary"
            disabled={!esv.key}
            onClick={() => void test("esv")}
          >
            {t("Tes ESV")}
          </button>
          <button
            className="text-button"
            disabled={!settings.esv}
            onClick={() => {
              cache.clear("esv");
              refresh();
              setEsvKey("");
              setEsvAgreed(false);
              save(
                { ...settings, esv: null, right: "kjv" },
                "esv",
                t("Key ESV dan cache dihapus."),
              );
            }}
          >
            {t("Hapus key")}
          </button>
        </div>
        {status.esv && (
          <p className="field-help" role="status">
            {t(status.esv)}
          </p>
        )}
        <p className="field-help">
          {ONLINE_ATTRIBUTION.esvNotice}{" "}
          <a href="https://www.esv.org" target="_blank" rel="noreferrer">
            www.esv.org
          </a>
        </p>
      </fieldset>
      <fieldset className="bible-api">
        <legend>TB2 · Bible API Lembaga Alkitab Indonesia</legend>
        <p className="field-help">
          {t(
            "Minta akses ke LAI (info@alkitab.or.id, bible-api.alkitab.or.id). Isi alamat dan kode versi sesuai dokumentasi yang diberikan LAI.",
          )}
        </p>
        <label>
          {t("API key / token LAI")}
          <input
            aria-label="API key LAI"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={tb2Key}
            onChange={(e) => setTb2Key(e.target.value)}
          />
        </label>
        <label>
          {t("Alamat API")}
          <input
            aria-label="Alamat API LAI"
            spellCheck={false}
            value={tb2Base}
            onChange={(e) => setTb2Base(e.target.value)}
          />
        </label>
        <label>
          {t("Kode versi")}
          <input
            aria-label="Kode versi LAI"
            spellCheck={false}
            value={tb2Version}
            onChange={(e) => setTb2Version(e.target.value)}
          />
        </label>
        <label className="attestation">
          <input
            type="checkbox"
            checked={tb2Agreed}
            onChange={(e) => setTb2Agreed(e.target.checked)}
          />
          {t(
            "Gereja kami punya akses resmi Bible API LAI dan mengikuti perjanjian lisensinya untuk TB2.",
          )}
        </label>
        <div className="bible-api-actions">
          <button
            className="button primary"
            disabled={!tb2.key || !tb2Agreed}
            onClick={() =>
              save(
                { ...settings, tb2 },
                "tb2",
                t("Tersimpan di perangkat ini. Pilih TB2 di Kolom kiri."),
              )
            }
          >
            {t("Simpan TB2")}
          </button>
          <button
            className="button secondary"
            disabled={!tb2.key}
            onClick={() => void test("tb2")}
          >
            {t("Tes TB2")}
          </button>
          <button
            className="text-button"
            disabled={!settings.tb2}
            onClick={() => {
              cache.clear("tb2");
              refresh();
              setTb2Key("");
              setTb2Agreed(false);
              save(
                { ...settings, tb2: null, left: "ayt" },
                "tb2",
                t("Key TB2 dan cache dihapus."),
              );
            }}
          >
            {t("Hapus key")}
          </button>
        </div>
        {status.tb2 && (
          <p className="field-help" role="status">
            {t(status.tb2)}
          </p>
        )}
      </fieldset>
      <div className="bible-api-actions">
        <span className="field-help">
          {t("Tersimpan: TB {tb}/{n} · TB2 {tb2}/{n} · ESV {esv}/{n} ayat", {
            tb: counts.tb,
            tb2: counts.tb2,
            esv: counts.esv,
            n: ONLINE_LIMIT,
          })}
        </span>
        <button
          className="text-button"
          onClick={() => {
            cache.clear("tb");
            cache.clear("tb2");
            cache.clear("esv");
            refresh();
          }}
        >
          {t("Hapus cache online")}
        </button>
      </div>
    </details>
  );
}
