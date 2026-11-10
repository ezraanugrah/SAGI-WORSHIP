import { frameText, type Preview } from "../presentation/models";
import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { MediaAsset } from "../media/models";
import { defaultType } from "../themes/models";
import type { useThemes } from "../hooks/useThemes";
import type { Workspace } from "../domain/models";
import type { ThemeSnapshot, ThemeSpec } from "../themes/models";
import { cssBackground } from "../themes/builtins";
import { ThemeEditor, mediaBackground } from "./ThemeEditor";
import { AssetThumbnail } from "./MediaLibrary";
export function ThemesLibrary({
  services,
  data,
  editable,
  onApply,
  onChanged,
  preview,
  onImportMedia,
}: {
  /** Import an image/video file into Media and return it (backgrounds). */
  onImportMedia?: (file: File) => Promise<MediaAsset>;
  services: ReturnType<typeof useThemes>;
  data: Workspace;
  editable: boolean;
  onApply: (id: string, scope: "item" | "all") => void;
  onChanged: () => void;
  preview?: Preview | null;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState(""),
    [editor, setEditor] = useState<{
      id: string;
      revision: number;
      initial?: ThemeSnapshot;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState<{
      theme: ThemeSnapshot;
      assignments: number;
      isDefault: boolean;
    } | null>(null),
    [replacement, setReplacement] = useState(""),
    [itemId, setItemId] = useState("");
  const theme = services.themes.find((t) => t.id === selected),
    items = data.items.filter(
      (i) => i.type !== "media" && i.scheduleId === data.activeId,
    );
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await services.reload();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const create = () =>
    setEditor({ id: `theme:${crypto.randomUUID()}`, revision: 0 });
  const upload = useRef<HTMLInputElement>(null),
    [status, setStatus] = useState(""),
    [importing, setImporting] = useState(false);
  /**
   * "Impor media" (like the Media tab): images/videos go into the Media
   * library. One file opens a new theme with it as background; several are
   * listed under "Media background" in the theme editor.
   */
  async function importMedia(files: File[]) {
    if (!onImportMedia || !files.length) return;
    setBusy(true);
    setImporting(true);
    setError("");
    setStatus("");
    const done: MediaAsset[] = [],
      failed: string[] = [];
    for (const file of files) {
      try {
        done.push(await onImportMedia(file));
      } catch (e) {
        failed.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    setImporting(false);
    if (failed.length) setError(failed.join(" · "));
    if (files.length === 1 && done.length === 1) {
      const id = `theme:${crypto.randomUUID()}`;
      setEditor({
        id,
        revision: 0,
        initial: {
          id,
          revision: 0,
          name: files[0].name.replace(/\.[^.]+$/, "").slice(0, 80),
          spec: mediaBackground(
            {
              background: { kind: "solid", color: "#08090b" },
              type: defaultType,
            },
            done[0],
          ),
          signature: "",
        },
      });
    } else if (done.length)
      setStatus(
        `${done.length} media diimpor. Pilih di Buat tema › Media background.`,
      );
  }
  return (
    <div className="themes-library">
      <div className="section-heading">
        <h3>Themes Library</h3>
        <div className="section-actions">
          {onImportMedia && (
            <>
              <button
                className="button secondary"
                disabled={!editable || busy || !!editor}
                onClick={() => upload.current?.click()}
              >
                <ImagePlus size={14} />{" "}
                {importing ? "Mengimpor…" : "Impor media"}
              </button>
              <input
                ref={upload}
                className="sr-only"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"
                aria-label="File media tema"
                disabled={!editable || busy || !!editor}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  void importMedia(files);
                }}
              />
            </>
          )}
          <button
            className="button primary"
            disabled={!editable || busy || !!editor}
            onClick={create}
          >
            Buat tema
          </button>
        </div>
      </div>
      {services.error && <p role="alert">{services.error}</p>}
      {error && <p role="alert">{error}</p>}
      {status && (
        <p role="status" className="field-help">
          {status}
        </p>
      )}
      {editor ? (
        <ThemeEditor
          key={editor.id}
          initial={editor.initial}
          assets={data.mediaAssets ?? []}
          onImportMedia={onImportMedia}
          editable={editable && !busy}
          reducedMotion={services.settings.reducedMotion}
          contrastWarnings={services.settings.contrastWarnings}
          sample={
            preview && preview.deck.frames[preview.index].kind !== "media"
              ? {
                  text: frameText(preview.deck, preview.index),
                  caption:
                    preview.deck.frames[preview.index].kind === "scripture"
                      ? preview.deck.frames[preview.index].scripture
                      : undefined,
                }
              : undefined
          }
          onSave={async (name, spec) => {
            await services.repo.save(editor.id, name, spec, editor.revision);
            setSelected(editor.id);
            await services.reload();
          }}
          onCancel={() => setEditor(null)}
        />
      ) : (
        <>
          <div className="media-filters">
            <label>
              Cari tema
              <input
                aria-label="Cari tema"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              Filter tema
              <select
                aria-label="Filter tema"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Semua</option>
                <option value="builtin">Built-in</option>
                <option value="custom">Custom</option>
                {["solid", "gradient", "image", "video"].map((kind) => (
                  <option value={kind} key={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="theme-library-grid" aria-label="Daftar tema">
            {services.themes
              .filter(
                (t) =>
                  t.name
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()) &&
                  (filter === "all" ||
                    (filter === "builtin" && t.id.startsWith("builtin:")) ||
                    (filter === "custom" && t.id.startsWith("theme:")) ||
                    filter === t.spec.background.kind),
              )
              .map((t) => (
                <li key={t.id}>
                  <button
                    className="theme-card"
                    aria-label={`Pilih tema ${t.name}`}
                    aria-pressed={selected === t.id}
                    onClick={() => setSelected(t.id)}
                  >
                    <span
                      className="theme-card-swatch"
                      style={{
                        background: cssBackground(t.spec.background),
                        color: t.spec.type.color,
                      }}
                    >
                      {t.spec.background.kind === "image" ||
                      t.spec.background.kind === "video" ? (
                        <AssetThumbnail refValue={t.spec.background.poster} />
                      ) : (
                        <span
                          style={{
                            fontFamily: t.spec.type.font,
                            fontWeight: t.spec.type.weight,
                          }}
                        >
                          Aa
                        </span>
                      )}
                    </span>
                    <strong>{t.name}</strong>
                    <small>
                      {t.id.startsWith("builtin:") ? "Built-in" : "Custom"} ·{" "}
                      {t.spec.background.kind} · r{t.revision}
                      {services.settings.defaultThemeId === t.id
                        ? " · Default"
                        : ""}
                    </small>
                  </button>
                </li>
              ))}
          </ul>
          {theme && (
            <section className="theme-details" aria-label="Detail tema">
              <h3>{theme.name}</h3>
              <div className="media-filters">
                <button
                  className="button secondary"
                  disabled={
                    !editable || busy || theme.id.startsWith("builtin:")
                  }
                  onClick={() =>
                    setEditor({
                      id: theme.id,
                      revision: theme.revision,
                      initial: theme,
                    })
                  }
                >
                  Edit / rename tema
                </button>
                <button
                  className="button secondary"
                  disabled={!editable || busy}
                  onClick={() =>
                    void run(async () => {
                      const row = await services.repo.save(
                        `theme:${crypto.randomUUID()}`,
                        `${theme.name.slice(0, 85)} (salinan)`,
                        theme.spec,
                        0,
                      );
                      setSelected(row.id);
                    })
                  }
                >
                  Duplikasi tema
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => onApply(theme.id, "item")}
                >
                  Terapkan ke item Preview
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => onApply(theme.id, "all")}
                >
                  Terapkan ke semua teks Preview
                </button>
                <button
                  className="button secondary"
                  disabled={!editable || busy}
                  onClick={() =>
                    void run(() =>
                      services.repo.saveSettings(
                        { ...services.settings, defaultThemeId: theme.id },
                        services.settings.revision,
                      ),
                    )
                  }
                >
                  Jadikan default persiapan
                </button>
                <button
                  className="button secondary"
                  disabled={
                    !editable || busy || theme.id.startsWith("builtin:")
                  }
                  onClick={() =>
                    void run(async () => {
                      const usage = await services.repo.usage(theme.id);
                      setReplacement("");
                      setDeleting({ theme, ...usage });
                    })
                  }
                >
                  Hapus tema
                </button>
              </div>
              <label>
                Item jadwal untuk tema
                <select
                  aria-label="Item jadwal untuk tema"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                >
                  <option value="">Pilih item lagu/Scripture</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.type === "song"
                        ? data.songs.find((s) => s.id === i.songId)?.title
                        : i.type === "scripture"
                          ? i.selection.label
                          : ""}
                      {i.type !== "media" && i.themeId
                        ? " · tema tersimpan"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button primary"
                disabled={
                  !editable || busy || !items.some((i) => i.id === itemId)
                }
                onClick={() =>
                  void run(async () => {
                    const s = data.schedules.find(
                      (s) => s.id === data.activeId,
                    );
                    if (!s) throw new Error("Pilih jadwal aktif");
                    await services.repo.assign(itemId, theme.id, s.revision);
                  })
                }
              >
                Simpan tema pada item
              </button>
              <button
                className="button secondary"
                disabled={
                  !editable || busy || !items.some((i) => i.id === itemId)
                }
                onClick={() =>
                  void run(async () => {
                    const s = data.schedules.find(
                      (s) => s.id === data.activeId,
                    );
                    if (!s) throw new Error("Pilih jadwal");
                    await services.repo.assign(itemId, null, s.revision);
                  })
                }
              >
                Hapus assignment tema item
              </button>
              <p className="field-help">
                Terapkan hanya menyiapkan Preview. Audience berubah melalui Go
                Live. Perubahan pagination membutuhkan persiapan ulang dari
                sumber.
              </p>
            </section>
          )}
        </>
      )}
      {deleting && (
        <section className="theme-delete" aria-label="Konfirmasi hapus tema">
          <h3>Hapus {deleting.theme.name}?</h3>
          <p>
            {deleting.assignments} assignment jadwal ·{" "}
            {deleting.isDefault ? "digunakan sebagai default" : "bukan default"}
            . Preview, LIVE, dan checkpoint yang sudah dibekukan tidak diubah.
          </p>
          <label>
            Tema pengganti
            <select
              aria-label="Tema pengganti"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            >
              <option value="">
                Tanpa pengganti (hanya jika tidak digunakan)
              </option>
              {services.themes
                .filter((t) => t.id !== deleting.theme.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="button primary"
            disabled={
              !editable ||
              busy ||
              ((deleting.assignments > 0 || deleting.isDefault) && !replacement)
            }
            onClick={() =>
              void run(async () => {
                await services.repo.delete(
                  deleting.theme.id,
                  deleting.theme.revision,
                  replacement || null,
                  {
                    assignments: deleting.assignments,
                    isDefault: deleting.isDefault,
                  },
                );
                setDeleting(null);
                setSelected("");
              })
            }
          >
            Konfirmasi hapus tema
          </button>
          <button
            className="button secondary"
            onClick={() => setDeleting(null)}
          >
            Batalkan hapus tema
          </button>
        </section>
      )}
    </div>
  );
}
