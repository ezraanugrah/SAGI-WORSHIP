import { DocumentPagePicker } from "./DocumentPagePicker";
import { useRef, useState, useEffect } from "react";
import type { useMedia } from "../hooks/useMedia";
import type { Workspace } from "../domain/models";
import type { AssetRef, MediaAsset, MediaSelection } from "../media/models";
import { readAsset } from "../media/assetReader";
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
    <span className="media-thumbnail">Thumbnail tidak tersedia</span>
  );
}
export function MediaLibrary({
  services,
  data,
  editable,
  onPreview,
  onChanged,
}: {
  services: ReturnType<typeof useMedia>;
  data: Workspace;
  editable: boolean;
  onPreview: (s: MediaSelection) => void;
  onChanged: () => void;
}) {
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
        if (active)
          setUsage(
            `Library ${(value.libraryBytes / 1048576).toFixed(1)} MiB · snapshot/tema tertahan ${(value.retainedBytes / 1048576).toFixed(1)} MiB`,
          );
      })
      .catch((e) => {
        if (active) setUsage(e.message);
      });
    return () => {
      active = false;
    };
  }, [data, services.repo]);
  const assets = (data.mediaAssets ?? []).filter(
    (a) =>
      (filter === "all" || a.kind === filter) &&
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
  return (
    <div className="media-library">
      <div className="section-heading">
        <div>
          <h3>Media lokal</h3>
          <p>JPG · PNG · WebP · MP4 · WebM · PDF</p>
        </div>
        <button
          className="button primary"
          disabled={!editable || services.working}
          onClick={() => input.current?.click()}
        >
          Impor media
        </button>
      </div>
      <input
        className="sr-only"
        ref={input}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf,.pptx"
        aria-label="File media"
        disabled={!editable || services.working}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          void services.importFiles(files);
          e.target.value = "";
        }}
      />
      <p role="status" className="exact-text">
        {services.status}
      </p>
      {services.working && (
        <button className="button secondary" onClick={services.cancel}>
          Batalkan impor media
        </button>
      )}
      <div className="media-filters">
        <label>
          Cari media
          <input
            aria-label="Cari media"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label>
          Jenis media
          <select
            aria-label="Jenis media"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setOffset(0);
            }}
          >
            <option value="all">Semua</option>
            <option value="image">Gambar</option>
            <option value="video">Video</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {!assets.length && (
        <p>
          Belum ada media yang sesuai. File tetap di perangkat ini. PPTX
          memerlukan persetujuan terpisah; ekspor lokal sebagai PDF/gambar.
        </p>
      )}
      <ul className="media-grid" aria-label="Daftar media">
        {assets.slice(offset, offset + 24).map((a) => (
          <li key={a.id}>
            <button
              className="media-card"
              aria-label={`Pilih media ${a.title}`}
              onClick={() => {
                setSelected(a);
                setPages("1");
                setError("");
              }}
            >
              <AssetThumbnail refValue={a.thumbnail} />
              <strong>{a.title}</strong>
              <small>
                {a.kind} · {(a.original.size / 1048576).toFixed(1)} MiB ·{" "}
                {a.pages} halaman
              </small>
            </button>
          </li>
        ))}
      </ul>
      <div className="media-filters">
        <button
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 24))}
        >
          Media sebelumnya
        </button>
        <button
          disabled={offset + 24 >= assets.length}
          onClick={() => setOffset(offset + 24)}
        >
          Media berikutnya
        </button>
      </div>
      {selected && data.mediaAssets?.some((a) => a.id === selected.id) && (
        <section className="media-details" aria-label="Detail media">
          <h3>{selected.title}</h3>
          <p>
            {selected.original.width} × {selected.original.height}
            {selected.original.duration
              ? ` · ${selected.original.duration.toFixed(1)} detik`
              : ""}{" "}
            · {selected.original.mime}
          </p>
          <p>{selected.compatibility}</p>
          <p className="checksum">Integritas: {selected.original.digest}</p>
          {selected.kind === "pdf" && !editable && (
            <p className="field-help">
              Tab hanya baca dapat menelusuri halaman; persiapan PDF membutuhkan
              penulis untuk menyimpan raster offline.
            </p>
          )}
          {selected.kind === "pdf" && (
            <label>
              Halaman PDF (contoh 1-3,5)
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
              Preview media
            </button>
            <button
              className="button primary"
              disabled={!editable || !data.activeId}
              onClick={() =>
                action(async () => {
                  const s = data.schedules.find((s) => s.id === data.activeId);
                  if (!s) throw new Error("Pilih jadwal");
                  await services.repo.addToSchedule(
                    s.id,
                    selection(),
                    s.revision,
                  );
                  onChanged();
                })
              }
            >
              Tambahkan media ke jadwal
            </button>
            <button
              className="button secondary"
              disabled={!editable}
              onClick={() =>
                action(async () => {
                  if (
                    !window.confirm(
                      `Hapus “${selected.title}” dan item jadwal terkait? LIVE/checkpoint tetap menyimpan aset yang dibutuhkan; ruang mungkin belum dibebaskan.`,
                    )
                  )
                    return;
                  await services.repo.delete(
                    selected.id,
                    selected.original.digest,
                  );
                  setSelected(null);
                  onChanged();
                })
              }
            >
              Hapus media
            </button>
          </div>
        </section>
      )}
      <p className="field-help">
        {usage} · belum termasuk payload yatim dan overhead browser.
      </p>
      <p className="field-help">
        Simpan file sumber. Aset yang masih dibutuhkan Preview, LIVE, atau
        checkpoint tidak dihapus oleh cleanup. Tidak ada backup media otomatis.
      </p>
      <button
        className="button secondary"
        disabled={!editable || services.working}
        onClick={() =>
          action(async () => {
            if (
              !window.confirm(
                "Bersihkan hanya payload tanpa referensi? Pin sesi lama tetap dipertahankan.",
              )
            )
              return;
            const count = await services.repo.collect();
            setError(`${count} payload tanpa referensi dibersihkan.`);
          })
        }
      >
        Bersihkan media tanpa referensi
      </button>
    </div>
  );
}
