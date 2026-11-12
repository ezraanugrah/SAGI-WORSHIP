import { t } from "../i18n";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { useSongSync } from "../hooks/useSongSync";
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
              "Masuk dengan akun gereja agar lagu di Musik sama di semua laptop.",
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
      {sync.configured && status.message && (
        <p
          className={`sync-status sync-${status.phase}`}
          role={status.phase === "error" ? "alert" : "status"}
        >
          {status.message
            .split(" · ")
            .map((part) => t(part))
            .join(" · ")}
        </p>
      )}
    </section>
  );
}
