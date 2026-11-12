import { t } from "../i18n";
import { useEffect, useState } from "react";
import type { MediaAsset } from "../media/models";
import { readAsset } from "../media/assetReader";
import { openPdf, renderPdfPage } from "../media/pdfAdapter";
export function DocumentPagePicker({
  asset,
  onPage,
  selected,
}: {
  asset: MediaAsset;
  onPage: (page: number) => void;
  selected: number[];
}) {
  const [offset, setOffset] = useState(0),
    [thumbs, setThumbs] = useState<Record<number, string>>({}),
    [error, setError] = useState("");
  useEffect(() => {
    setOffset(0);
  }, [asset.id]);
  useEffect(() => {
    let active = true;
    const abort = new AbortController(),
      urls: string[] = [];
    setThumbs({});
    setError("");
    void (async () => {
      let pdf: Awaited<ReturnType<typeof openPdf>> | undefined;
      try {
        const blob = await readAsset(asset.original, [asset.original]);
        if (!active) return;
        pdf = await openPdf(blob, abort.signal);
        for (let n = offset + 1; n <= Math.min(asset.pages, offset + 6); n++) {
          const raster = await renderPdfPage(pdf.doc, n, abort.signal, 320);
          if (!active) return;
          const url = URL.createObjectURL(raster);
          urls.push(url);
          setThumbs((previous) => ({ ...previous, [n]: url }));
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        await pdf?.close();
      }
    })();
    return () => {
      active = false;
      abort.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [asset.id, offset]);
  return (
    <div aria-label="Pilih halaman PDF">
      <div className="media-grid">
        {Array.from(
          { length: Math.min(6, asset.pages - offset) },
          (_, i) => offset + i + 1,
        ).map((n) => (
          <button
            type="button"
            className="media-card"
            key={n}
            aria-label={`Pilih halaman ${n}`}
            aria-pressed={selected.includes(n)}
            onClick={() => onPage(n)}
          >
            {thumbs[n] ? (
              <img className="media-thumbnail" src={thumbs[n]} alt="" />
            ) : (
              <span className="media-thumbnail">{t("Memuat halaman…")}</span>
            )}
            <span>
              Halaman {n}
              {selected.includes(n) ? ` · ${t("dipilih")}` : ""}
            </span>
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="media-filters">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 6))}
        >
          {t("Halaman sebelumnya")}
        </button>
        <button
          type="button"
          disabled={offset + 6 >= asset.pages}
          onClick={() => setOffset(offset + 6)}
        >
          {t("Halaman berikutnya")}
        </button>
      </div>
    </div>
  );
}
