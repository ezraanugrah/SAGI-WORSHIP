import { BackupRecovery } from "./components/BackupRecovery";
import { useThemes } from "./hooks/useThemes";
import { AdvancedSettings } from "./components/AdvancedSettings";
import { useMedia } from "./hooks/useMedia";
import { useScriptureServices } from "./hooks/useScriptures";
import { usePresentation } from "./hooks/usePresentation";
import { useWriter } from "./hooks/useWorkspace";
import { useScreenWakeLock } from "./hooks/useScreenWakeLock";
import { ProjectorBar } from "./components/ProjectorBar";
import { Phase2Dashboard } from "./components/Phase2Dashboard";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Palette,
  Monitor,
  Keyboard,
  HardDrive,
  Volume2,
  Type,
  WifiOff,
  Check,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { defaults, loadPreferences, type Preferences } from "./db";
const themes = [
  { id: "black", name: "Default Black" },
  { id: "sunset", name: "Sunset" },
  { id: "ocean", name: "Ocean" },
  { id: "purple", name: "Purple" },
];
function route() {
  return location.hash === "#/settings" ? "settings" : "dashboard";
}
function PanelTitle({
  icon,
  children,
  extra,
}: {
  icon: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="panel-title">
      <span>
        {icon}
        {children}
      </span>
      {extra}
    </div>
  );
}
export default function App() {
  const [page, setPage] = useState(route),
    [prefs, setPrefs] = useState<Preferences>(defaults),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("Memuat penyimpanan…"),
    [notice, setNotice] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [offline, setOffline] = useState(false),
    [usage, setUsage] = useState("Memeriksa…");
  const { gate, repo, editable, writerMessage } = useWriter();
  const scriptureServices = useScriptureServices(gate);
  const mediaServices = useMedia(gate);
  const themeServices = useThemes(gate);
  const { controller: presentation, state: presentationState } =
    usePresentation(gate);
  const wakeLock = useScreenWakeLock(!!presentationState.live);
  const pending = useRef(Promise.resolve());
  useEffect(() => {
    const refresh = () => {
      void navigator.storage
        ?.estimate()
        .then((e) =>
          setUsage(
            `${((e.usage ?? 0) / 1048576).toFixed(1)} MB digunakan · kuota origin ${((e.quota ?? 0) / 1073741824).toFixed(1)} GB`,
          ),
        )
        .catch(() => {});
    };
    window.addEventListener("sagi-library-changed", refresh);
    return () => window.removeEventListener("sagi-library-changed", refresh);
  }, []);
  useEffect(() => {
    const hash = () => setPage(route());
    const connection = () => setOnline(navigator.onLine);
    const ready = () => setOffline(true);
    const update = () =>
      setNotice(
        "Pembaruan tersedia. Tutup semua jendela SAGI dan buka kembali saat ibadah selesai.",
      );
    const fail = () =>
      setNotice(
        "Cache offline belum berhasil disiapkan. Coba muat ulang saat terhubung.",
      );
    const blocked = () => {
      gate.revoke();
      setError("Versi database berubah. Tutup tab SAGI lain dan muat ulang.");
    };
    window.addEventListener("hashchange", hash);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("sagi-offline-ready", ready);
    window.addEventListener("sagi-update-ready", update);
    window.addEventListener("sagi-offline-error", fail);
    window.addEventListener("sagi-db-blocked", blocked);
    loadPreferences()
      .then((v) => {
        setPrefs(v);
        setLoaded(true);
        setSaved("Tersimpan lokal");
      })
      .catch((e) => {
        setError(String(e.message));
        setSaved("Penyimpanan bermasalah");
      });
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.ready.then(() => {
        if (navigator.serviceWorker.controller) setOffline(true);
      });
    navigator.storage
      ?.estimate()
      .then((e) =>
        setUsage(
          `${((e.usage ?? 0) / 1048576).toFixed(1)} MB digunakan · ${((e.quota ?? 0) / 1073741824).toFixed(1)} GB tersedia untuk origin`,
        ),
      )
      .catch(() => setUsage("Estimasi tidak tersedia"));
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("sagi-offline-ready", ready);
      window.removeEventListener("sagi-update-ready", update);
      window.removeEventListener("sagi-offline-error", fail);
      window.removeEventListener("sagi-db-blocked", blocked);
    };
  }, []);
  function change<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaved("Menyimpan…");
    pending.current = pending.current
      .then(() => repo.savePreferences(next))
      .then(() => setSaved("Tersimpan lokal"))
      .catch((e) => {
        setError(e.message);
        setSaved("Gagal menyimpan");
      });
  }
  async function persistent() {
    try {
      const granted = await navigator.storage?.persist?.();
      setNotice(
        granted
          ? "Penyimpanan persisten diberikan browser."
          : "Browser belum memberikan penyimpanan persisten. Hindari menghapus data situs SAGI.",
      );
    } catch {
      setNotice("Permintaan penyimpanan tidak tersedia pada browser ini.");
    }
  }
  const live = presentationState.live;
  const appStatus = !live
    ? { state: "ready", label: presentationState.preparing ? "MENYIAPKAN" : "READY" }
    : live.mode === "black"
      ? { state: "black", label: "BLACK" }
      : live.mode === "clearText"
        ? { state: "clear", label: "CLEAR TEXT" }
        : { state: "live", label: "LIVE" };
  return (
    <div className="app-shell sagi-ui">
      <aside className="sidebar">
        <a href="#/" className="brand" aria-label="SAGI Worship Dashboard">
          <span className="brand-word">
            Sagi <br />
            Worship
          </span>
        </a>
        <nav aria-label="Navigasi utama">
          <a className={page === "dashboard" ? "nav active" : "nav"} href="#/">
            Dashboard
          </a>
          <a
            className={page === "settings" ? "nav active" : "nav"}
            href="#/settings"
          >
            Pengaturan
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="version">
            SAGI WORSHIP <span>v0.7.1</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="top-left">
            {page === "dashboard" && (
              <ProjectorBar
                controller={presentation}
                editable={editable && loaded}
              />
            )}
            {!online && (
              <span className="status-pill">
                <i className="dot amber" />
                Tanpa internet
              </span>
            )}
          </div>
          <div className="top-status">
            {live && (
              <button
                className="button secondary"
                disabled={!editable}
                aria-label="Emergency Black"
                onClick={() => {
                  try {
                    presentation.mode("black");
                  } catch (e) {
                    presentation.report(e);
                  }
                }}
              >
                Black
              </button>
            )}
            <span
              className="ready-box"
              role="status"
              data-testid="app-status"
              data-state={appStatus.state}
            >
              <i aria-hidden="true">*</i> {appStatus.label}
            </span>
          </div>
        </header>
        <main>
          {page === "settings" && (
            <div className="heading">
              <h1>Pengaturan</h1>
            </div>
          )}
          {!editable && writerMessage && (
            <div className="notice" role="status">
              {writerMessage}
            </div>
          )}
          {presentationState.error && (
            <div className="alert" role="alert">
              {presentationState.error}
              <button onClick={() => presentation.clearError()}>Tutup</button>
            </div>
          )}
          {presentationState.recovery && (
            <div
              className="recovery-banner"
              role="region"
              aria-label="Pemulihan presentasi"
            >
              <strong>
                Checkpoint presentasi tersedia. Tidak dilanjutkan otomatis.
              </strong>
              <span>
                Resume mengembalikan snapshot tersimpan, termasuk mode
                Black/Clear Text.
              </span>
              <p role="status">{presentationState.checkpoint}</p>
              <button
                className="button primary"
                disabled={!editable || presentationState.recovering}
                onClick={() =>
                  void presentation
                    .resume()
                    .catch((e) => presentation.report(e))
                }
              >
                Resume presentasi
              </button>
              <button
                className="button secondary"
                disabled={!editable || presentationState.recovering}
                onClick={() => {
                  if (
                    window.confirm(
                      "Buang checkpoint presentasi? Materi sumber tidak dihapus.",
                    )
                  )
                    void presentation
                      .discard()
                      .catch((e) => presentation.report(e));
                }}
              >
                Discard checkpoint
              </button>
            </div>
          )}
          {error && (
            <div className="alert" role="alert">
              {error}{" "}
              <button onClick={() => location.reload()}>Muat ulang</button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Tutup pemberitahuan"
              >
                ×
              </button>
            </div>
          )}
          {page === "dashboard" ? (
            <Phase2Dashboard
              scriptureServices={scriptureServices}
              mediaServices={mediaServices}
              themeServices={themeServices}
              presentation={presentation}
              presentationState={presentationState}
              repo={repo}
              editable={editable && loaded}
              prefs={prefs}
            />
          ) : (
            <div className="settings-grid">
              <AdvancedSettings
                services={themeServices}
                controller={presentation}
                editable={editable && loaded}
                onCalibration={() => {
                  presentation.calibration(themeServices.settings);
                  setPage("dashboard");
                  location.hash = "#/";
                }}
              />
              <section className="panel settings-panel">
                <PanelTitle icon={<Type size={18} />}>
                  Tipografi default
                </PanelTitle>
                <fieldset disabled={!loaded || !editable}>
                  <label>
                    Font
                    <select
                      aria-label="Font"
                      value={prefs.font}
                      onChange={(e) => change("font", e.target.value)}
                    >
                      {["Arial", "Georgia", "Verdana"].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Ukuran teks <output>{prefs.fontSize} px</output>
                    <input
                      type="range"
                      min="24"
                      max="120"
                      value={prefs.fontSize}
                      onChange={(e) =>
                        change("fontSize", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Safe margin <output>{prefs.safeMargin}%</output>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={prefs.safeMargin}
                      onChange={(e) =>
                        change("safeMargin", Number(e.target.value))
                      }
                    />
                  </label>
                  <p className="field-help">
                    Preferensi legacy dipakai jika tema default lanjutan belum
                    dipilih. Tema memiliki tipografi sendiri.
                  </p>
                </fieldset>
              </section>
              <section className="panel settings-panel">
                <PanelTitle icon={<Palette size={18} />}>
                  Tema tampilan
                </PanelTitle>
                <fieldset disabled={!loaded || !editable}>
                  <div className="theme-grid">
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        className={`theme-choice ${prefs.theme === t.id ? "chosen" : ""}`}
                        aria-pressed={prefs.theme === t.id}
                        onClick={() => change("theme", t.id)}
                      >
                        <span className={`swatch theme-${t.id}`}>
                          {prefs.theme === t.id && <Check size={20} />}
                        </span>
                        {t.name}
                      </button>
                    ))}
                  </div>
                  <div
                    className={`type-sample theme-${prefs.theme}`}
                    style={{
                      fontFamily: prefs.font,
                      padding: `${prefs.safeMargin}%`,
                      fontSize: `${prefs.fontSize / 3}px`,
                    }}
                  >
                    Persiapkan hati untuk menyembah.
                  </div>
                </fieldset>
              </section>
              <section className="panel settings-panel">
                <PanelTitle icon={<Volume2 size={18} />}>
                  Preferensi video & audio
                </PanelTitle>
                <fieldset disabled={!loaded || !editable}>
                  {(
                    [
                      { key: "loopLive", title: "Loop video LIVE" },
                      { key: "loopPreview", title: "Loop video Preview" },
                      { key: "muted", title: "Mulai video tanpa suara" },
                    ] as const
                  ).map((x) => (
                    <label className="toggle-row" key={x.key}>
                      {x.title}
                      <input
                        type="checkbox"
                        checked={prefs[x.key]}
                        onChange={(e) => change(x.key, e.target.checked)}
                      />
                    </label>
                  ))}
                  <label>
                    Volume default <output>{prefs.volume}%</output>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={prefs.volume}
                      onChange={(e) => change("volume", Number(e.target.value))}
                    />
                  </label>
                  <p className="field-help">
                    Default untuk persiapan video berikutnya. LIVE yang sedang
                    berjalan tetap menggunakan snapshot.
                  </p>
                </fieldset>
              </section>
              <BackupRecovery
                gate={gate}
                presentation={presentation}
                editable={editable}
              />
              <section className="panel settings-panel">
                <PanelTitle icon={<HardDrive size={18} />}>
                  Data & penyimpanan
                </PanelTitle>
                <div className="settings-content">
                  <div className="storage-meter">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>{usage}</p>
                  <p className="field-help">
                    IndexedDB · Skema v1 · Data disimpan pada browser dan origin
                    ini.
                  </p>
                  <button className="button secondary" onClick={persistent}>
                    <ShieldCheck size={16} />
                    Minta penyimpanan persisten
                  </button>
                  <div className="settings-rule" />
                  <p className="field-help">
                    Gunakan panel Backup & Recovery untuk salinan eksternal dan pemulihan.
                  </p>
                  <button
                    className="text-button reset"
                    disabled={!loaded || !editable}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Kembalikan semua preferensi ke nilai default? Materi tidak dihapus.",
                        )
                      ) {
                        setPrefs({ ...defaults });
                        pending.current = pending.current
                          .then(() => repo.savePreferences({ ...defaults }))
                          .then(() => setSaved("Tersimpan lokal"))
                          .catch((e) => setError(e.message));
                      }
                    }}
                  >
                    <RotateCcw size={14} />
                    Reset preferensi
                  </button>
                </div>
              </section>
              <section className="panel settings-panel">
                <PanelTitle icon={<Monitor size={18} />}>
                  Display output
                </PanelTitle>
                <div className="settings-content">
                  <div className="spec-row">
                    <span>Active LIVE reference</span>
                    <strong>
                      {presentationState.live?.deck.render
                        ? `${presentationState.live.deck.render.canvas.width} × ${presentationState.live.deck.render.canvas.height} · 16:9`
                        : "1920 × 1080 · legacy"}
                    </strong>
                  </div>
                  <div className="spec-row">
                    <span>Projector window</span>
                    <strong>{presentationState.connection.status}</strong>
                  </div>
                  <p className="field-help">
                    Pemilihan monitor dan fullscreen akan mengikuti dukungan
                    serta izin browser.
                  </p>
                </div>
              </section>
              <section className="panel settings-panel">
                <PanelTitle icon={<Keyboard size={18} />}>
                  Shortcut presentasi
                </PanelTitle>
                <div className="settings-content shortcuts">
                  {[
                    ["← / →", "Slide sebelumnya / berikutnya"],
                    ["PageUp / PageDown", "Slide sebelumnya / berikutnya (clicker)"],
                    ["Space", "Slide berikutnya"],
                    ["B atau .", "Black / Restore"],
                    ["C", "Clear text / Restore"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <kbd>{key}</kbd>
                      <span>{label}</span>
                    </div>
                  ))}
                  <p className="field-help">
                    Aktif selama LIVE di seluruh jendela operator dan jendela
                    proyektor, kecuali saat mengetik atau di dalam editor.
                    Escape mengikuti perilaku fullscreen browser.
                  </p>
                </div>
              </section>
            </div>
          )}
        </main>
        <footer>
          <span>
            <i className={loaded ? "dot" : "dot amber"} />
            {saved}
          </span>
          <span>
            {offline ? (
              <>
                <Check size={13} />
                Shell offline siap
              </>
            ) : (
              <>
                <WifiOff size={13} />
                Offline shell:{" "}
                {import.meta.env.DEV
                  ? "uji pada production build"
                  : "menyiapkan cache"}
              </>
            )}
          </span>
          {presentationState.live && (
            <span data-testid="wake-lock-status" role="status">
              {wakeLock === "active"
                ? "Layar dijaga tetap menyala"
                : wakeLock === "idle"
                  ? "Menyiapkan penjaga layar…"
                  : "Layar bisa tidur: matikan sleep/screen saver di pengaturan OS"}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
