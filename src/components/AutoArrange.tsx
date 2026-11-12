import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Sparkles, X } from "lucide-react";
import type { Repository } from "../data/repository";
import { id } from "../domain/models";
import {
  ARRANGE_LABELS,
  autoArrange,
  toSongInput,
  type Arrangement,
} from "../songs/autoArrange";

const EXAMPLE = `Verse 1
Tuhanku maha besar
…

Chorus
Segala kuasa tunduk dalam nama Nya
…`;

/**
 * Musik › Susun Otomatis: title, author and the whole lyrics in; parts out
 * (from the labels in the lyrics, or guessed from blank lines and returning
 * stanzas). Nothing is saved until the operator checks the result and
 * clicks "Simpan ke Song Library". No AI and nothing sent anywhere.
 */
export function AutoArrange({
  repo,
  editable,
  onSaved,
  onClose,
}: {
  repo: Repository;
  editable: boolean;
  /** The new song is in the Song Library (sync and backups as usual). */
  onSaved: (songId: string, title: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(""),
    [author, setAuthor] = useState(""),
    [lyrics, setLyrics] = useState(""),
    [result, setResult] = useState<Arrangement | null>(null),
    [edited, setEdited] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, []);
  const change = (next: Arrangement) => {
    setResult(next);
    setEdited(true);
  };
  function arrange() {
    if (
      result &&
      edited &&
      !window.confirm(
        t("Susun ulang dari lirik? Koreksi pada hasil di bawah akan diganti."),
      )
    )
      return;
    setError("");
    try {
      setResult(autoArrange(lyrics));
      setEdited(false);
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    }
  }
  const partLabel = (key: string) =>
    result?.parts.find((p) => p.key === key)?.label ?? "";
  const missing = !title.trim()
    ? t("Isi judul lagu dulu.")
    : !result?.parts.some((p) => p.text.trim())
      ? t("Belum ada bagian berisi lirik.")
      : !result.order.length
        ? t("Urutan presentasi masih kosong.")
        : "";
  async function save() {
    if (!result || missing) return;
    setSaving(true);
    setError("");
    try {
      const songId = id();
      await repo.createSong(songId, toSongInput(result, title, author, songId));
      onSaved(songId, title.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function close() {
    if (
      (lyrics.trim() || title.trim()) &&
      !window.confirm(
        t("Tutup Susun Otomatis? Hasil yang belum disimpan hilang."),
      )
    )
      return;
    onClose();
  }
  return (
    <section
      ref={panel}
      className="song-editor panel auto-arrange"
      aria-label="Susun Otomatis"
      data-live-shortcuts="off"
    >
      <div className="editor-title">
        <div>
          <span className="tiny-label">
            {t("SUSUN OTOMATIS · TANPA AI · TIDAK DIKIRIM KE MANA PUN")}
          </span>
          <h2>{title || t("Lagu baru")}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Tutup Susun Otomatis"
          onClick={close}
        >
          <X size={18} />
        </button>
      </div>
      <div className="editor-body">
        <fieldset disabled={!editable || saving}>
          <div className="song-fields">
            <label>
              {t("Judul lagu")}
              <input
                autoFocus
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              {t("Penyanyi / pencipta")}
              <input
                maxLength={200}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </label>
          </div>
          <label>
            {t("Lirik lengkap")}
            <textarea
              aria-label="Lirik lengkap"
              rows={12}
              maxLength={100000}
              placeholder={EXAMPLE}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
            />
          </label>
          <p className="field-help">
            {t(
              "Label seperti Verse 1, [Chorus], Reff:, Pre-Chorus, Bridge, Intro, Outro dikenali otomatis; label yang diulang tanpa lirik mengulang bagian itu. Tanpa label, bait dipisah baris kosong dan bait yang muncul lagi dianggap Chorus. Kata-kata lirik tidak diubah.",
            )}
          </p>
          <div className="editor-actions">
            <button
              className="button primary"
              disabled={!lyrics.trim()}
              onClick={arrange}
            >
              <Sparkles size={15} aria-hidden="true" /> {t("Susun Otomatis")}
            </button>
          </div>
          {error && (
            <p className="error-text" role="alert">
              {t(error)}
            </p>
          )}
          {result && (
            <>
              <p className="arrange-summary" role="status">
                {result.method === "labels"
                  ? t("{n} bagian dari label di lirik.", {
                      n: result.parts.length,
                    })
                  : t(
                      "{n} bagian. Sebagian diperkirakan (tanpa label): periksa yang bertanda Perlu dicek.",
                      { n: result.parts.length },
                    )}
              </p>
              <div className="section-heading">
                <h3>{t("Bagian lagu")}</h3>
              </div>
              {result.parts.map((part, index) => (
                <div
                  className={`song-section${part.sure ? "" : " arrange-check"}`}
                  key={part.key}
                  data-testid="arranged-part"
                >
                  <div className="section-fields">
                    <label>
                      {t("Label bagian {n}", { n: index + 1 })}
                      <select
                        aria-label={`Label hasil ${index + 1}`}
                        value={part.label}
                        onChange={(e) =>
                          change({
                            ...result,
                            parts: result.parts.map((p) =>
                              p.key === part.key
                                ? {
                                    ...p,
                                    label: e.target.value,
                                    sure: true,
                                    note: undefined,
                                  }
                                : p,
                            ),
                          })
                        }
                      >
                        {!ARRANGE_LABELS.some((l) => l === part.label) && (
                          <option>{part.label}</option>
                        )}
                        {ARRANGE_LABELS.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="icon-button danger"
                      aria-label={`Hapus hasil ${index + 1}`}
                      disabled={result.parts.length === 1}
                      onClick={() =>
                        change({
                          ...result,
                          parts: result.parts.filter((p) => p.key !== part.key),
                          order: result.order.filter((k) => k !== part.key),
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {!part.sure && part.note && (
                    <p className="arrange-note">
                      <strong>{t("Perlu dicek")}</strong> · {t(part.note)}
                    </p>
                  )}
                  <label>
                    {t("Lirik bagian {n}", { n: index + 1 })}
                    <textarea
                      aria-label={`Lirik hasil ${index + 1}`}
                      rows={Math.min(
                        8,
                        Math.max(2, part.text.split("\n").length),
                      )}
                      maxLength={30000}
                      value={part.text}
                      placeholder={t("Kosong: menjadi slide kosong.")}
                      onChange={(e) =>
                        change({
                          ...result,
                          parts: result.parts.map((p) =>
                            p.key === part.key
                              ? { ...p, text: e.target.value }
                              : p,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
              <div className="section-heading">
                <div>
                  <h3>{t("Urutan presentasi")}</h3>
                  <p>
                    {t(
                      "Bagian yang sama (mis. Chorus) disimpan sekali dan boleh muncul berkali-kali.",
                    )}
                  </p>
                </div>
              </div>
              <ol className="section-order" aria-label="Urutan hasil">
                {result.order.map((key, index) => (
                  <li key={`${key}-${index}`} data-testid="arranged-order">
                    <span>
                      {index + 1}. {partLabel(key)}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={`Naikkan urutan hasil ${index + 1}`}
                      disabled={index === 0}
                      onClick={() => {
                        const order = [...result.order];
                        [order[index - 1], order[index]] = [
                          order[index],
                          order[index - 1],
                        ];
                        change({ ...result, order });
                      }}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Turunkan urutan hasil ${index + 1}`}
                      disabled={index === result.order.length - 1}
                      onClick={() => {
                        const order = [...result.order];
                        [order[index + 1], order[index]] = [
                          order[index],
                          order[index + 1],
                        ];
                        change({ ...result, order });
                      }}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Hapus urutan hasil ${index + 1}`}
                      disabled={result.order.length === 1}
                      onClick={() =>
                        change({
                          ...result,
                          order: result.order.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ol>
              <label className="arrange-add">
                {t("Tambah ke urutan")}
                <select
                  aria-label="Tambah ke urutan hasil"
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      change({
                        ...result,
                        order: [...result.order, e.target.value],
                      });
                  }}
                >
                  <option value="">{t("Pilih bagian…")}</option>
                  {result.parts.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </fieldset>
        {result && (
          <div className="editor-actions">
            <button
              className="button primary"
              disabled={!editable || saving || !!missing}
              title={missing || undefined}
              onClick={() => void save()}
            >
              {saving ? t("Menyimpan…") : t("Simpan ke Song Library")}
            </button>
            {missing && <span className="field-help">{missing}</span>}
          </div>
        )}
      </div>
    </section>
  );
}
