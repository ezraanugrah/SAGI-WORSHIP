import { t } from "../i18n";
import { DocumentPagePicker } from "./DocumentPagePicker";
import { useRef, useState, useEffect, type ReactNode } from "react";
import type { useMedia } from "../hooks/useMedia";
import type { Workspace } from "../domain/models";
import type { AssetRef, MediaAsset, MediaSelection } from "../media/models";
import { readAsset } from "../media/assetReader";
import { endDrag, startDrag } from "./dragState";
import type { useFolderWatch } from "../hooks/useFolderWatch";
import { FolderWatchControls, FolderWatchList } from "./FolderWatch";
import {
  MEDIA_TAB_KINDS,
  PRESENTATION_KINDS,
} from "../media/importCoordinator";
/** Drag payload type: a JSON MediaSelection dragged into the active Week. */
export const MEDIA_DRAG_TYPE = "application/x-sagi-media";
/** The Media tab holds pictures and videos; PDFs live in Presentations. */
const KINDS = [
  { id: "all", label: "Semua media" },
  { id: "image", label: "Gambar" },
  { id: "video", label: "Video" },
];
const inTab = (a: MediaAsset, presentations: boolean) =>
  presentations ? a.kind === "pdf" : a.kind !== "pdf";
const clock = (seconds: number) => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
function cardDetail(a: MediaAsset) {
  const size = `${(a.original.size / 1048576).toFixed(1)} MB`;
  if (a.kind === "pdf") return `PDF · ${size} · ${a.pages} halaman`;
  if (a.kind === "video")
    return `Video · ${clock(a.original.duration ?? 0)} · ${size}`;
  return `${t("Gambar")} · ${a.original.width}×${a.original.height} · ${size}`;
}
/** Import status "a.mp4: tersimpan offline · b.pdf: …": each message translated. */
export function mediaStatus(status: string) {
  return status
    .split(" · ")
    .map((part) => {
      const m = part.match(/^(.+?\.[A-Za-z0-9]{2,5}): (.+)$/s);
      return m ? `${m[1]}: ${t(m[2])}` : t(part);
    })
    .join(" · ");
}
export function AssetThumbnail({ refValue }: { refValue: AssetRef }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true,
      value = "";
    void readAsset(refValue, [refValue])
      .then((b) => {
        if (active) {
          value = URL.createObjectURL(b);
          setUrl(value);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (value) URL.revokeObjectURL(value);
    };
  }, [refValue]);
  return url ? (
    <img className="media-thumbnail" src={url} alt="" loading="lazy" />
  ) : (
    <span className="media-thumbnail">{t("Thumbnail tidak tersedia")}</span>
  );
}
export function MediaLibrary({
  services,
  data,
  editable,
  onPreview,
  onChanged,
  mode = "media",
  watch,
  syncLine,
}: {
  /** Whether files reach the other laptops, and transfer progress. */
  syncLine?: ReactNode;
  services: ReturnType<typeof useMedia>;
  /** Watched laptop folder (Media tab); kept by the dashboard so it runs on every tab. */
  watch?: ReturnType<typeof useFolderWatch>;
  data: Workspace;
  editable: boolean;
  onPreview: (s: MediaSelection) => void;
  onChanged: () => void;
  /** "presentations" shows only PDF presentations (exported slides). */
  mode?: "media" | "presentations";
}) {
  const presentations = mode === "presentations";
  const input = useRef<HTMLInputElement>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<MediaAsset | null>(null),
    [pages, setPages] = useState("1"),
    [error, setError] = useState(""),
    [offset, setOffset] = useState(0);
  const [usage, setUsage] = useState("");
  useEffect(() => {
    let active = true;
    void services.repo
      .usage()
      .then((value) => {
        const mb = (bytes: number) => (bytes / 1048576).toFixed(1);
        if (active)
          setUsage(
            [
              t("Media di laptop ini: {lib} MB", {
                lib: mb(value.libraryBytes),
              }),
              value.retainedBytes > 0
                ? t("{kept} MB lagi masih dipakai tema/LIVE", {
                    kept: mb(value.retainedBytes),
                  })
                : "",
            ]
              .filter(Boolean)
              .join(" · "),
          );
      })
      .catch(() => {
        if (active) setUsage("");
      });
    return () => {
      active = false;
    };
  }, [data, services.repo]);
  // Leftover file data of media deleted earlier is freed by itself (never
  // library media, nor what LIVE, a checkpoint or a theme still uses).
  useEffect(() => {
    if (!editable) return;
    const timer = setTimeout(
      () => void services.repo.collect().catch(() => 0),
      2000,
    );
    return () => clearTimeout(timer);
  }, [editable, services.repo]);
  const tabAssets = (data.mediaAssets ?? []).filter((a) =>
    inTab(a, presentations),
  );
  const kind = presentations ? "pdf" : filter;
  const assets = tabAssets.filter(
    (a) =>
      (kind === "all" || a.kind === kind) &&
      a.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  function selection() {
    if (!selected) throw new Error("Pilih media");
    const numbers = new Set<number>();
    for (const part of pages.split(",")) {
      if (!/^\d+(?:-\d+)?$/.test(part.trim()))
        throw new Error("Halaman tidak valid");
      const [a, b] = part.trim().split("-").map(Number);
      if (a < 1 || (b ?? a) > selected.pages || (b ?? a) < a)
        throw new Error("Halaman di luar dokumen");
      for (let n = a; n <= (b ?? a); n++) {
        numbers.add(n);
        if (numbers.size > 100) throw new Error("Maksimum 100 halaman");
      }
    }
    return {
      assetId: selected.id,
      digest: selected.original.digest,
      pages: selected.kind === "pdf" ? [...numbers].sort((a, b) => a - b) : [1],
    };
  }
  const action = (f: () => unknown) => {
    try {
      const r = f();
      if (r instanceof Promise) void r.catch((e) => setError(e.message));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  /** What a card adds when dropped on the Week: the chosen PDF pages for the
   * selected card, otherwise the whole document (max 100) or the image/video. */
  function dragSelection(a: MediaAsset): MediaSelection {
    if (selected?.id === a.id) {
      try {
        return selection();
      } catch {
        /* fall back to the default below */
      }
    }
    return {
      assetId: a.id,
      digest: a.original.digest,
      pages:
        a.kind === "pdf"
          ? Array.from({ length: Math.min(a.pages, 100) }, (_, i) => i + 1)
          : [1],
    };
  }
  return (
    <div className="media-library lib-split">
      <aside className="lib-side">
        <label className="lib-search">
          <span className="sr-only">
            {presentations ? t("Cari presentasi") : t("Cari media")}
          </span>
          <input
            aria-label={presentations ? "Cari presentasi" : "Cari media"}
            placeholder={
              presentations ? t("Cari presentasi…") : t("Cari media…")
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <div className="side-title">
          {presentations ? "Presentations" : "Media"}
        </div>
        {presentations ? (
          <ul className="side-list">
            <li>
              <span className="folder active">
                <span className="side-name">PDF presentasi</span>
                <span className="side-count">{assets.length}</span>
              </span>
            </li>
          </ul>
        ) : (
          <ul className="side-list" aria-label="Jenis media">
            {KINDS.map((k) => (
              <li key={k.id}>
                <button
                  className={filter === k.id ? "active" : ""}
                  aria-pressed={filter === k.id}
                  onClick={() => {
                    setFilter(k.id);
                    setOffset(0);
                  }}
                >
                  <span className="side-name">{t(k.label)}</span>
                  <span className="side-count">
                    {
                      tabAssets.filter((a) => k.id === "all" || a.kind === k.id)
                        .length
                    }
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          className="button primary lib-import"
          disabled={!editable || services.working}
          onClick={() => input.current?.click()}
        >
          {presentations ? t("Impor presentasi") : t("Impor media")}
        </button>
        <input
          className="sr-only"
          ref={input}
          type="file"
          multiple
          accept={
            presentations
              ? ".pdf,application/pdf"
              : ".jpg,.jpeg,.png,.webp,.mp4,.webm,image/jpeg,image/png,image/webp,video/mp4,video/webm"
          }
          aria-label={presentations ? "File presentasi" : "File media"}
          disabled={!editable || services.working}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            void services.importFiles(
              files,
              presentations ? PRESENTATION_KINDS : MEDIA_TAB_KINDS,
            );
            e.target.value = "";
          }}
        />
        <p role="status" className="exact-text field-help">
          {mediaStatus(services.status)}
        </p>
        {services.working && (
          <button className="button secondary" onClick={services.cancel}>
            {t("Batalkan impor media")}
          </button>
        )}
        <p className="field-help">
          {presentations
            ? t("PDF hasil ekspor PowerPoint, Keynote, atau Google Slides.")
            : t(
                "Gambar: JPG · PNG · WebP. Video: MP4 · WebM (paling lancar: MP4 H.264 1080p).",
              )}
        </p>
        {watch && (
          <FolderWatchControls
            watch={watch}
            editable={editable}
            assets={data.mediaAssets ?? []}
          />
        )}
      </aside>
      <div className="lib-main">
        <div className="lib-head">
          <span>Title</span>
          <span className="lib-count">
            {t("{n} item · tarik ke Schedule", { n: assets.length })}
          </span>
        </div>
        {watch && (
          <FolderWatchList
            watch={watch}
            assets={data.mediaAssets ?? []}
            editable={editable}
            working={services.working}
          />
        )}
        {error && (
          <p role="alert" className="error-text">
            {t(error)}
          </p>
        )}
        {!assets.length && (
          <p className="lib-empty">
            {presentations
              ? t(
                  "Belum ada presentasi. Ekspor PowerPoint/Keynote ke PDF, lalu impor di sini.",
                )
              : t(
                  "Belum ada gambar atau video. Klik Impor media (JPG, PNG, WebP, MP4, WebM). PDF presentasi diimpor di tab Presentations.",
                )}
          </p>
        )}
        <ul className="media-grid" aria-label="Daftar media">
          {assets.slice(offset, offset + 24).map((a) => (
            <li
              key={a.id}
              draggable={editable}
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  MEDIA_DRAG_TYPE,
                  JSON.stringify(dragSelection(a)),
                );
                e.dataTransfer.setData("text/plain", a.title);
                e.dataTransfer.effectAllowed = "copy";
                startDrag("media");
              }}
              onDragEnd={endDrag}
            >
              <button
                className={
                  selected?.id === a.id ? "media-card chosen" : "media-card"
                }
                aria-label={`Pilih media ${a.title}`}
                onClick={() => {
                  setSelected(a);
                  setPages("1");
                  setError("");
                }}
              >
                <AssetThumbnail refValue={a.thumbnail} />
                <strong>{a.title}</strong>
                <small>{cardDetail(a)}</small>
              </button>
            </li>
          ))}
        </ul>
        {assets.length > 24 && (
          <div className="media-filters">
            <button
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 24))}
            >
              {t("Media sebelumnya")}
            </button>
            <button
              disabled={offset + 24 >= assets.length}
              onClick={() => setOffset(offset + 24)}
            >
              {t("Media berikutnya")}
            </button>
          </div>
        )}
        {selected &&
          inTab(selected, presentations) &&
          data.mediaAssets?.some((a) => a.id === selected.id) && (
            <section className="media-details" aria-label="Detail media">
              <h3>{selected.title}</h3>
              <p>
                {selected.original.width} × {selected.original.height}
                {selected.original.duration
                  ? ` · ${t("{n} detik", { n: selected.original.duration.toFixed(1) })}`
                  : ""}{" "}
                · {selected.original.mime}
              </p>
              <p>{t(selected.compatibility)}</p>
              <p className="checksum">
                {t("Integritas")}: {selected.original.digest}
              </p>
              {selected.kind === "pdf" && !editable && (
                <p className="field-help">
                  {t(
                    "Tab hanya baca dapat menelusuri halaman; persiapan PDF membutuhkan penulis untuk menyimpan raster offline.",
                  )}
                </p>
              )}
              {selected.kind === "pdf" && (
                <label>
                  {t("Halaman PDF (contoh 1-3,5)")}
                  <input
                    aria-label="Halaman PDF"
                    value={pages}
                    onChange={(e) => setPages(e.target.value)}
                  />
                </label>
              )}
              {selected.kind === "pdf" && (
                <DocumentPagePicker
                  asset={selected}
                  selected={(() => {
                    try {
                      return selection().pages;
                    } catch {
                      return [];
                    }
                  })()}
                  onPage={(n) => {
                    let chosen: number[] = [];
                    try {
                      chosen = selection().pages;
                    } catch {}
                    const next = chosen.includes(n)
                      ? chosen.filter((p) => p !== n)
                      : [...chosen, n].sort((a, b) => a - b);
                    if (next.length > 100) {
                      setError("Maksimum 100 halaman");
                      return;
                    }
                    setPages(next.join(","));
                  }}
                />
              )}
              <div className="media-filters">
                <button
                  className="button secondary"
                  disabled={selected.kind === "pdf" && !editable}
                  onClick={() => action(() => onPreview(selection()))}
                >
                  {t("Preview media")}
                </button>
                <button
                  className="button secondary"
                  disabled={!editable}
                  onClick={() =>
                    action(async () => {
                      if (
                        !window.confirm(
                          t(
                            "Hapus “{title}” dan item jadwal terkait? Yang sedang tampil di LIVE tetap aman sampai diganti.",
                            { title: selected.title },
                          ),
                        )
                      )
                        return;
                      await services.repo.delete(
                        selected.id,
                        selected.original.digest,
                      );
                      // Free its space now (kept while LIVE still uses it).
                      await services.repo.collect().catch(() => 0);
                      setSelected(null);
                      onChanged();
                    })
                  }
                >
                  {t("Hapus media")}
                </button>
              </div>
            </section>
          )}
        {selected?.kind === "pdf" && (
          <p className="field-help">
            {t("Halaman yang dipilih ikut saat kartu ini ditarik ke Schedule.")}
          </p>
        )}
        {usage && (
          <p className="field-help" data-testid="media-usage">
            {usage}
          </p>
        )}
        {syncLine ?? (
          <p className="field-help">
            {t(
              "Media ikut tersinkron ke laptop lain setelah masuk di Songs › Sinkron antar laptop.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}
