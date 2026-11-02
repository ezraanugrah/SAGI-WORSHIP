import { useRef, useState } from "react";
import {
  ImportCoordinator,
  type ImportState,
} from "../scriptures/importCoordinator";
export function ScriptureImportDialog({
  importer,
  state,
  editable,
}: {
  importer: ImportCoordinator;
  state: ImportState;
  editable: boolean;
}) {
  const file = useRef<HTMLInputElement>(null),
    [accepted, setAccepted] = useState(false);
  const t = state.prepared?.dataset.translation;
  return (
    <section className="scripture-import" aria-label="Impor dataset Alkitab">
      <div className="section-heading">
        <div>
          <h3>Impor dataset berizin</h3>
          <p>JSON SAGI Scripture v1 · lokal · maksimum 32 MiB</p>
        </div>
        <button
          className="button secondary"
          disabled={
            !editable ||
            state.phase === "writing" ||
            state.phase === "validating"
          }
          onClick={() => {
            setAccepted(false);
            file.current?.click();
          }}
        >
          Pilih file dataset
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        aria-label="File dataset Alkitab"
        className="sr-only"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          if (chosen) {
            setAccepted(false);
            void importer.choose(chosen);
          }
          e.target.value = "";
        }}
      />
      {state.message && (
        <p
          className={state.phase === "error" ? "error-text" : "field-help"}
          role="status"
        >
          {state.message}
        </p>
      )}
      {state.phase === "writing" && (
        <progress
          max={100}
          value={state.progress}
          aria-label="Kemajuan impor"
        />
      )}
      {t && state.phase === "review" && (
        <div className="import-review">
          <h3>
            {t.name} · {t.abbreviation}
          </h3>
          <dl>
            <dt>Penerbit / edisi</dt>
            <dd>
              {t.publisher} · {t.edition}
            </dd>
            <dt>Bahasa / versifikasi</dt>
            <dd>
              {t.language} · {t.versification}
            </dd>
            <dt>Cakupan</dt>
            <dd>
              {t.coverage} (berdasarkan manifest, bukan verifikasi eksternal)
            </dd>
            <dt>Jumlah</dt>
            <dd>
              {state.prepared!.dataset.books.length} kitab ·{" "}
              {state.prepared!.dataset.verses.length} ayat
            </dd>
            <dt>Sumber / lisensi</dt>
            <dd>
              {t.source} · {t.license.kind} · {t.license.reference}
            </dd>
            <dt>Pemberitahuan lisensi</dt>
            <dd className="exact-text">{t.license.notice}</dd>
            <dt>Atribusi wajib pada slide</dt>
            <dd className="exact-text">{t.license.displayAttribution}</dd>
            <dt>Izin dinyatakan</dt>
            <dd>
              Offline storage · projection · local snapshots · ekspor:{" "}
              {t.license.permissions.export ? "diizinkan" : "tidak diizinkan"}
            </dd>
            <dt>SHA-256 konten</dt>
            <dd className="checksum">
              {state.prepared!.dataset.integrity.contentHash}
            </dd>
          </dl>
          <label className="attestation">
            <input
              type="checkbox"
              aria-label="Saya berhak menyimpan, memproyeksikan, dan membuat snapshot lokal dataset ini"
              checked={accepted}
              disabled={!editable}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            Saya sudah memeriksa lisensi dan berhak menyimpan, memproyeksikan,
            serta membuat snapshot lokal dataset ini sesuai ketentuannya.
          </label>
          <p className="field-help">
            Validasi struktur dan checksum bukan bukti kepemilikan hak. Tidak
            ada data dikirim ke server.
          </p>
          <button
            className="button primary"
            disabled={!editable || !accepted}
            onClick={() => void importer.confirm(accepted)}
          >
            Konfirmasi dan impor
          </button>
        </div>
      )}
      {["validating", "review", "writing"].includes(state.phase) && (
        <button className="button secondary" onClick={() => importer.cancel()}>
          Batalkan impor
        </button>
      )}
    </section>
  );
}
