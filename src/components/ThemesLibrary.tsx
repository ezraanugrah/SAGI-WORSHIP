import { frameText, type Preview } from "../presentation/models";
import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { MediaAsset } from "../media/models";
import { defaultType } from "../themes/models";
import type { useThemes } from "../hooks/useThemes";
import type { Workspace } from "../domain/models";
import type { ThemeSnapshot } from "../themes/models";
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
  /** Put the theme on the Preview item and then on Live Output. */
  onApply: (id: string) => unknown;
  onChanged: () => void;
  preview?: Preview | null;
}) {
  const [selected, setSelected] = useState(""),
    [editor, setEditor] = useState<{
      id: string;
      revision: number;
      initial?: ThemeSnapshot;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const theme = services.themes.find((t) => t.id === selected);
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
    } else if (done.length) {
      // Several files: each becomes its own theme, named after the file.
      setBusy(true);
      try {
        for (const asset of done)
          await services.repo.save(
            `theme:${crypto.randomUUID()}`,
            asset.title.replace(/\.[^.]+$/, "").slice(0, 80) || "Tema",
            mediaBackground(
              {
                background: { kind: "solid", color: "#08090b" },
                type: defaultType,
              },
              asset,
            ),
            0,
          );
        await services.reload();
        onChanged();
        setStatus(`${done.length} tema dibuat dari media yang diimpor.`);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
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
          <ul className="theme-library-grid" aria-label="Daftar tema">
            {services.themes.map((t) => (
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
                    {t.spec.background.kind}
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
                  className="button primary"
                  disabled={!editable || busy}
                  onClick={() => void onApply(theme.id)}
                >
                  Terapkan ke item Preview + Live Output
                </button>
              </div>
              <p className="field-help">
                Tema dipasang pada item yang sedang di Preview, lalu Live Output
                langsung ikut berganti. Black / Clear Text tetap seperti semula.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
