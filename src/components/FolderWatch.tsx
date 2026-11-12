import { t } from "../i18n";
import { FolderOpen } from "lucide-react";
import { fileKey, inLibrary, type WatchedFile } from "../media/folderWatch";
import type { MediaAsset } from "../media/models";
import type { useFolderWatch } from "../hooks/useFolderWatch";
type Watch = ReturnType<typeof useFolderWatch>;
const size = (bytes: number) =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const when = (time: number) =>
  new Date(time).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
/** Sidebar: choose, re-allow or drop the watched folder; auto-import switch. */
export function FolderWatchControls({
  watch,
  editable,
  assets,
}: {
  watch: Watch;
  editable: boolean;
  assets: MediaAsset[];
}) {
  const s = watch.state;
  return (
    <section className="folder-watch" aria-label="Folder pantauan">
      <div className="side-title">{t("Folder pantauan")}</div>
      {s.status === "unsupported" && (
        <p className="field-help">
          {t("Pantau folder butuh Chrome atau Edge di laptop.")}
        </p>
      )}
      {s.status === "none" && (
        <>
          <p className="field-help">
            {t(
              "Pilih folder di laptop (mis. Downloads). File media baru di sana langsung terdeteksi.",
            )}
          </p>
          <button
            className="button secondary"
            onClick={() => void watch.choose()}
          >
            {t("Pilih folder")}
          </button>
        </>
      )}
      {s.status === "permission" && (
        <>
          <p className="folder-name">
            <FolderOpen size={14} aria-hidden="true" /> {s.name}
          </p>
          <p className="field-help">
            {t("Browser minta izin lagi untuk folder ini.")}
          </p>
          <button
            className="button secondary"
            onClick={() => void watch.allow()}
          >
            {t("Izinkan akses folder")}
          </button>
          <button className="text-button" onClick={() => void watch.forget()}>
            {t("Lepas folder")}
          </button>
        </>
      )}
      {s.status === "watching" && (
        <>
          <p className="folder-name" title={s.name}>
            <FolderOpen size={14} aria-hidden="true" /> {s.name}
          </p>
          <p className="field-help" role="status">
            {t("Dipantau · {n} file belum di Media", {
              n: s.files.filter((f) => !inLibrary(f, assets)).length,
            })}
          </p>
          {s.files.some((f) => !inLibrary(f, assets)) && (
            <button
              className="text-button"
              onClick={() => watch.setShowAll(!watch.showAll)}
            >
              {watch.showAll
                ? t("Sembunyikan daftar")
                : t("Lihat semua yang belum di Media")}
            </button>
          )}
          <label className="folder-auto">
            <input
              type="checkbox"
              checked={watch.auto}
              disabled={!editable}
              onChange={(e) => void watch.setAuto(e.target.checked)}
            />
            {t("Impor otomatis file baru")}
          </label>
          <div className="folder-actions">
            <button className="text-button" onClick={() => void watch.choose()}>
              {t("Ganti folder")}
            </button>
            <button className="text-button" onClick={() => void watch.forget()}>
              {t("Lepas folder")}
            </button>
          </div>
        </>
      )}
      {watch.note && (
        <p className="field-help" role="status">
          {t(watch.note)}
        </p>
      )}
    </section>
  );
}
/** Above the media grid: files in the folder that are not in the library yet. */
export function FolderWatchList({
  watch,
  assets,
  editable,
  working,
}: {
  watch: Watch;
  assets: MediaAsset[];
  editable: boolean;
  working: boolean;
}) {
  const s = watch.state;
  if (s.status !== "watching") return null;
  const isNew = (f: WatchedFile) => s.fresh.has(fileKey(f));
  const missing = s.files.filter((f) => !inLibrary(f, assets)),
    fresh = missing.filter(isNew),
    list = (watch.showAll ? missing : fresh).slice(0, 20);
  if (!list.length) return null;
  return (
    <section className="folder-new" aria-label="File baru di folder">
      <div className="folder-new-head">
        <strong>
          {watch.showAll
            ? t("{n} file di “{name}” belum ada di Media", {
                n: missing.length,
                name: s.name,
              })
            : t("{n} file baru di “{name}”", { n: fresh.length, name: s.name })}
        </strong>
        <button
          className="button primary"
          disabled={!editable || working}
          onClick={() => void watch.importNow(list)}
        >
          {t("Impor semua ({n})", { n: list.length })}
        </button>
      </div>
      <ul aria-label="File di folder">
        {list.map((f) => (
          <li key={fileKey(f)}>
            {isNew(f) && <span className="folder-badge">{t("Baru")}</span>}
            <span className="folder-file" title={f.name}>
              {f.name}
            </span>
            <span className="folder-meta">
              {size(f.size)} · {when(f.lastModified)}
            </span>
            <button
              className="button secondary"
              aria-label={`Impor ${f.name}`}
              disabled={!editable || working}
              onClick={() => void watch.importNow([f])}
            >
              {t("Impor")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
