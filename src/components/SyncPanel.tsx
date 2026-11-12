import { t } from "../i18n";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { useSongSync } from "../hooks/useSongSync";
type Sync = ReturnType<typeof useSongSync>;
/**
 * The sync line, translated part by part ("Tersinkron 10.42 · 25 lagu ·
 * 12 media"), or a media file on its way ("Mengirim media: … · 3/8 bagian").
 */
export function syncLine(sync: Sync) {
  const { transfer } = sync;
  if (transfer)
    return t(
      transfer.direction === "up"
        ? "Mengirim media: {title} · {done}/{total} bagian"
        : "Mengambil media: {title} · {done}/{total} bagian",
      { title: transfer.title, done: transfer.done, total: transfer.total },
    );
  return sync.status.message
    .split(" · ")
    .map((part) =>
      part.startsWith("Media/Tema: ")
        ? t("Media/Tema: {msg}", { msg: t(part.slice(12)) })
        : part.startsWith("Jadwal: ")
          ? t("Jadwal: {msg}", { msg: t(part.slice(8)) })
          : t(part),
    )
    .join(" · ");
}
/**
 * Media / Presentations: whether files go to the other laptops, and what
 * the sync is doing now.
 */
export function MediaSyncLine({ sync }: { sync: Sync }) {
  if (!sync.configured) return null;
  if (!sync.email)
    return (
      <p className="field-help" data-testid="media-sync">
        {t(
          "Media hanya ada di laptop ini sampai Anda masuk di Songs › Sinkron antar laptop.",
        )}
      </p>
    );
  const line = syncLine(sync);
  return (
    <p
      className={`field-help sync-status sync-${sync.transfer ? "syncing" : sync.status.phase}`}
      role="status"
      data-testid="media-sync"
    >
      {t("Sinkron")} ({sync.email}): {line || t("menunggu…")}
    </p>
  );
}
/** Songs sidebar: sign in to sync the Musik library between laptops. */
export function SyncPanel({
  sync,
  editable,
}: {
  sync: ReturnType<typeof useSongSync>;
  editable: boolean;
}) {
  const [address, setAddress] = useState(""),
    [password, setPassword] = useState("");
  const { status } = sync;
  return (
    <section className="sync-panel" aria-labelledby="sync-title">
      <h3 id="sync-title" className="side-title">
        <RefreshCw size={13} aria-hidden="true" /> {t("Sinkron antar laptop")}
      </h3>
      {!sync.configured ? (
        <p className="field-help">
          {t(
            "Belum disiapkan. Admin perlu mengisi alamat server sinkron (docs/SYNC.md).",
          )}
        </p>
      ) : !sync.email ? (
        <form
          className="sync-login"
          onSubmit={(e) => {
            e.preventDefault();
            void sync.signIn(address, password).then(() => setPassword(""));
          }}
        >
          <p className="field-help">
            {t(
              "Masuk dengan akun gereja agar lagu, media, dan tema sama di semua laptop.",
            )}
          </p>
          <input
            aria-label="Email sinkron"
            type="email"
            autoComplete="username"
            placeholder="email@gereja"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <input
            aria-label="Password sinkron"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="button primary"
            disabled={
              !address.trim() || !password || status.phase === "syncing"
            }
          >
            {t("Masuk")}
          </button>
        </form>
      ) : (
        <>
          <p className="sync-account" title={sync.email}>
            {sync.email}
          </p>
          {!editable && (
            <p className="field-help">{t("Sinkron berjalan di tab edit.")}</p>
          )}
          <div className="sync-actions">
            <button
              className="button secondary"
              disabled={!editable || status.phase === "syncing"}
              onClick={() => void sync.syncNow()}
            >
              {t("Sinkron sekarang")}
            </button>
            <button className="text-button" onClick={sync.signOut}>
              {t("Keluar")}
            </button>
          </div>
        </>
      )}
      {sync.configured && (status.message || sync.transfer) && (
        <p
          className={`sync-status sync-${sync.transfer ? "syncing" : status.phase}`}
          role={status.phase === "error" ? "alert" : "status"}
        >
          {syncLine(sync)}
        </p>
      )}
    </section>
  );
}
