import { t, useLang } from "./i18n";
import { LanguageToggle } from "./components/LanguageToggle";
import { BackupRecovery } from "./components/BackupRecovery";
import {
  DEFAULT_OUTLINE_PX,
  LYRIC_COLOR,
  LYRIC_FONTS,
  LYRIC_MAX_PX,
  LYRIC_WEIGHT,
  OUTLINE_COLOR,
  OUTLINE_MAX_PX,
  fontPx,
  fontStack,
  lyricFont,
  outlinePx,
  percentOf,
} from "./presentation/fonts";
import { useThemes } from "./hooks/useThemes";
import { AdvancedSettings } from "./components/AdvancedSettings";
import { useMedia } from "./hooks/useMedia";
import { useScriptureServices } from "./hooks/useScriptures";
import { usePresentation } from "./hooks/usePresentation";
import { useWriter } from "./hooks/useWorkspace";
import { useScreenWakeLock } from "./hooks/useScreenWakeLock";
import { ProjectorBar } from "./components/ProjectorBar";
import type { ScreenChoice } from "./presentation/windowManager";
import { LiveToolbar } from "./components/LiveToolbar";
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
  // Re-render every screen when the language changes.
  useLang();
  const [page, setPage] = useState(route),
    [prefs, setPrefs] = useState<Preferences>(defaults),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("Memuat penyimpanan…"),
    [notice, setNotice] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [offline, setOffline] = useState(false),
    [usage, setUsage] = useState("Memeriksa…");
  const { gate, repo, editable, writerMessage, takeOver } = useWriter();
  // Read-only after the lock check (another SAGI tab is editing, or lost).
  const readOnly = !editable && !writerMessage.startsWith("Memeriksa");
  const scriptureServices = useScriptureServices(gate);
  const mediaServices = useMedia(gate);
  const themeServices = useThemes(gate);
  const { controller: presentation, state: presentationState } =
    usePresentation(gate);
  const wakeLock = useScreenWakeLock(!!presentationState.live);
  const [previewDirty, setPreviewDirty] = useState(false);
  // A newer SAGI version is downloaded and waiting (service worker).
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null),
    [updating, setUpdating] = useState(false),
    // Seconds until the new version installs itself; "Nanti" stops it.
    [autoIn, setAutoIn] = useState<number | null>(null),
    [later, setLater] = useState(false);
  // Screen picked in the top bar; the toolbar's Live button opens there.
  const [screen, setScreen] = useState<ScreenChoice | undefined>();
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
    const update = (event: Event) => {
      const apply = (event as CustomEvent<() => Promise<void>>).detail;
      if (typeof apply === "function") setUpdate(() => apply);
    };
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
    changePrefs({ [key]: value } as Partial<Preferences>);
  }
  // Latest preferences, so quick successive changes never drop one another.
  const latestPrefs = useRef(prefs);
  latestPrefs.current = prefs;
  function changePrefs(patch: Partial<Preferences>) {
    const next = { ...latestPrefs.current, ...patch };
    latestPrefs.current = next;
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
  function applyUpdate() {
    if (!update) return;
    setUpdating(true);
    void update().catch(() => {
      setUpdating(false);
      setNotice(
        "Versi baru belum bisa dipasang. Tutup semua jendela SAGI lalu buka kembali.",
      );
    });
  }
  // A new version installs itself after a short notice, but only while
  // nothing is LIVE, no recovery waits and the projector window is closed;
  // otherwise the banner waits for the operator.
  const quiet =
    !presentationState.live &&
    !presentationState.recovery &&
    ["Belum dibuka", "Ditutup"].includes(presentationState.connection.status);
  const autoUpdate = !!update && quiet && !later && !updating;
  useEffect(() => {
    if (!autoUpdate) {
      setAutoIn(null);
      return;
    }
    let left = 15;
    setAutoIn(left);
    const timer = setInterval(() => {
      left--;
      if (left > 0) setAutoIn(left);
      else {
        clearInterval(timer);
        setAutoIn(0);
        applyUpdate();
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoUpdate]);
  const live = presentationState.live;
  const appStatus = readOnly
    ? { state: "readonly", label: "HANYA BACA" }
    : !live
      ? {
          state: "ready",
          label: presentationState.preparing ? t("MENYIAPKAN") : "READY",
        }
      : live.mode === "black"
        ? { state: "black", label: "BLACK" }
        : live.mode === "clearText"
          ? { state: "clear", label: "CLEAR TEXT" }
          : { state: "live", label: "LIVE" };
  return (
    <div className="app-shell sagi-ui" data-page={page}>
      <header className="topbar">
        <a href="#/" className="brand" aria-label="SAGI Worship Dashboard">
          <span className="brand-word">
            Sagi<b>Worship</b>
          </span>
          <span className="version">v0.7.1</span>
        </a>
        <nav className="menu" aria-label="Navigasi utama">
          <a className={page === "dashboard" ? "nav active" : "nav"} href="#/">
            Dashboard
          </a>
          <a
            className={page === "settings" ? "nav active" : "nav"}
            href="#/settings"
          >
            {t("Pengaturan")}
          </a>
        </nav>
        <ProjectorBar
          controller={presentation}
          editable={editable && loaded}
          onScreen={setScreen}
        />
        <div className="top-status">
          {!online && (
            <span className="status-pill">
              <i className="dot amber" />
              {t("Tanpa internet")}
            </span>
          )}
          <LiveToolbar
            controller={presentation}
            state={presentationState}
            editable={editable && loaded}
            dirty={previewDirty}
            screen={screen}
          />
          <span
            className="ready-box"
            role="status"
            data-testid="app-status"
            data-state={appStatus.state}
          >
            <i aria-hidden="true">*</i> {appStatus.label}
          </span>
          <LanguageToggle />
        </div>
      </header>
      <div className="main-shell">
        <main>
          {page === "settings" && (
            <div className="heading">
              <h1>{t("Pengaturan")}</h1>
            </div>
          )}
          {readOnly && writerMessage && (
            <div
              className="notice readonly-banner"
              role="status"
              data-testid="readonly-banner"
            >
              <span>
                <strong>{t("Tab ini hanya baca")}</strong> —{" "}
                {t("tombol LIVE dan edit dinonaktifkan.")} {t(writerMessage)}
              </span>
              <button
                className="button secondary"
                onClick={() => location.reload()}
              >
                {t("Muat ulang")}
              </button>
              <button
                className="button primary"
                onClick={() => {
                  if (
                    window.confirm(
                      t(
                        "Pakai tab ini untuk mengedit? Tab/jendela SAGI lain menjadi hanya baca, termasuk kontrol LIVE di sana. Layar proyektor tetap menampilkan slide terakhir.",
                      ),
                    )
                  )
                    void takeOver().catch((e) => setNotice(e.message));
                }}
              >
                {t("Edit di tab ini")}
              </button>
            </div>
          )}
          {presentationState.error && (
            <div className="alert" role="alert">
              {t(presentationState.error)}
              <button onClick={() => presentation.clearError()}>
                {t("Tutup")}
              </button>
            </div>
          )}
          {presentationState.recovery && (
            <div
              className="recovery-banner"
              role="region"
              aria-label="Pemulihan presentasi"
            >
              <strong>
                {t(
                  "Checkpoint presentasi tersedia. Tidak dilanjutkan otomatis.",
                )}
              </strong>
              <span>
                {t(
                  "Resume mengembalikan snapshot tersimpan, termasuk mode Black/Clear Text.",
                )}
              </span>
              <p role="status">{t(presentationState.checkpoint)}</p>
              <button
                className="button primary"
                disabled={!editable || presentationState.recovering}
                onClick={() =>
                  void presentation
                    .resume()
                    .catch((e) => presentation.report(e))
                }
              >
                {t("Resume presentasi")}
              </button>
              <button
                className="button secondary"
                disabled={!editable || presentationState.recovering}
                onClick={() => {
                  if (
                    window.confirm(
                      t(
                        "Buang checkpoint presentasi? Materi sumber tidak dihapus.",
                      ),
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
              {t(error)}{" "}
              <button onClick={() => location.reload()}>
                {t("Muat ulang")}
              </button>
            </div>
          )}
          {update && (
            <div className="notice update-banner" role="status">
              <span>
                {t("Versi baru SAGI tersedia.")}
                {presentationState.live
                  ? ` ${t("LIVE sedang berjalan: muat versi baru setelah ibadah selesai.")}`
                  : autoIn !== null
                    ? ` ${t("Dipasang otomatis dalam {n} detik.", { n: autoIn })}`
                    : ""}
              </span>
              {autoIn !== null && (
                <button className="text-button" onClick={() => setLater(true)}>
                  {t("Nanti")}
                </button>
              )}
              <button
                className="button primary"
                disabled={updating}
                onClick={() => {
                  if (
                    presentationState.live &&
                    !window.confirm(
                      t(
                        "LIVE sedang berjalan. Halaman ini akan dimuat ulang; layar proyektor tetap menampilkan slide terakhir dan Anda perlu Resume. Lanjutkan?",
                      ),
                    )
                  )
                    return;
                  applyUpdate();
                }}
              >
                {updating ? t("Memuat…") : t("Muat versi baru")}
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {t(notice)}
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
              onPrefsChange={changePrefs}
              onPreviewDirty={setPreviewDirty}
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
                  {t("Tipografi lirik")}
                </PanelTitle>
                <fieldset disabled={!loaded || !editable}>
                  <label>
                    Font
                    <select
                      aria-label="Font"
                      value={lyricFont(prefs.font)}
                      onChange={(e) => change("font", e.target.value)}
                    >
                      {LYRIC_FONTS.map((f) => (
                        <option key={f} style={{ fontFamily: fontStack(f) }}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Ukuran teks")}{" "}
                    <output>{percentOf(prefs.fontSize, LYRIC_MAX_PX)}%</output>
                    <input
                      type="range"
                      aria-label="Ukuran teks"
                      min="1"
                      max="100"
                      value={percentOf(prefs.fontSize, LYRIC_MAX_PX)}
                      onChange={(e) =>
                        change("fontSize", fontPx(Number(e.target.value)))
                      }
                    />
                  </label>
                  <label>
                    Outline{" "}
                    <output>
                      {percentOf(
                        prefs.outline ?? DEFAULT_OUTLINE_PX,
                        OUTLINE_MAX_PX,
                      )}
                      %
                    </output>
                    <input
                      type="range"
                      aria-label="Outline"
                      min="1"
                      max="100"
                      value={percentOf(
                        prefs.outline ?? DEFAULT_OUTLINE_PX,
                        OUTLINE_MAX_PX,
                      )}
                      onChange={(e) =>
                        change("outline", outlinePx(Number(e.target.value)))
                      }
                    />
                  </label>
                  <label>
                    Safe margin <output>{prefs.safeMargin}%</output>
                    <input
                      type="range"
                      aria-label="Safe margin"
                      min="0"
                      max="20"
                      value={prefs.safeMargin}
                      onChange={(e) =>
                        change("safeMargin", Number(e.target.value))
                      }
                    />
                  </label>
                  <p className="field-help">
                    {t(
                      "Lirik selalu Extra Bold, putih, dengan outline hitam. Font, ukuran, dan outline berlaku untuk semua slide, dengan atau tanpa tema; tema hanya mengatur latar. Ukuran dan outline juga bisa diubah langsung di bawah Live Output.",
                    )}
                  </p>
                </fieldset>
              </section>
              <section className="panel settings-panel">
                <PanelTitle icon={<Palette size={18} />}>
                  {t("Tema tampilan")}
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
                      fontFamily: fontStack(prefs.font),
                      padding: `${prefs.safeMargin}%`,
                      fontSize: `${prefs.fontSize / 3}px`,
                      fontWeight: LYRIC_WEIGHT,
                      color: LYRIC_COLOR,
                      WebkitTextStroke: `${(prefs.outline ?? DEFAULT_OUTLINE_PX) / 3}px ${OUTLINE_COLOR}`,
                      paintOrder: "stroke fill",
                    }}
                  >
                    {t("Persiapkan hati untuk menyembah.")}
                  </div>
                </fieldset>
              </section>
              <section className="panel settings-panel">
                <PanelTitle icon={<Volume2 size={18} />}>
                  {t("Preferensi video & audio")}
                </PanelTitle>
                <fieldset disabled={!loaded || !editable}>
                  {(
                    [
                      { key: "loopLive", title: "Loop video LIVE" },
                      { key: "loopPreview", title: "Loop video Preview" },
                    ] as const
                  ).map((x) => (
                    <label className="toggle-row" key={x.key}>
                      {t(x.title)}
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
                      aria-label="Volume default"
                      min="0"
                      max="200"
                      step="5"
                      value={prefs.volume}
                      onChange={(e) => change("volume", Number(e.target.value))}
                    />
                  </label>
                  <p className="field-help">
                    {t(
                      "Video dari tab Media selalu mulai bersuara (Mute LIVE bisa mematikannya); latar video tema selalu tanpa suara. Default untuk persiapan video berikutnya. LIVE yang sedang berjalan tetap menggunakan snapshot. Di atas 100% = penguat volume di proyektor (maks. 200%); suara bisa pecah jika video sudah keras.",
                    )}
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
                  {t("Data & penyimpanan")}
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
                  <p>{t(usage)}</p>
                  <p className="field-help">
                    {t(
                      "IndexedDB · Skema v1 · Data disimpan pada browser dan origin ini.",
                    )}
                  </p>
                  <button className="button secondary" onClick={persistent}>
                    <ShieldCheck size={16} />
                    {t("Minta penyimpanan persisten")}
                  </button>
                  <div className="settings-rule" />
                  <p className="field-help">
                    {t(
                      "Gunakan panel Backup & Recovery untuk salinan eksternal dan pemulihan.",
                    )}
                  </p>
                  <button
                    className="text-button reset"
                    disabled={!loaded || !editable}
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            "Kembalikan semua preferensi ke nilai default? Materi tidak dihapus.",
                          ),
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
                    {t("Reset preferensi")}
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
                    <strong>{t(presentationState.connection.status)}</strong>
                  </div>
                  <p className="field-help">
                    {t(
                      "Pemilihan monitor dan fullscreen akan mengikuti dukungan serta izin browser.",
                    )}
                  </p>
                </div>
              </section>
              <section className="panel settings-panel">
                <PanelTitle icon={<Keyboard size={18} />}>
                  {t("Shortcut presentasi")}
                </PanelTitle>
                <div className="settings-content shortcuts">
                  {[
                    ["← / →", "Slide sebelumnya / berikutnya"],
                    [
                      "PageUp / PageDown",
                      "Slide sebelumnya / berikutnya (clicker)",
                    ],
                    ["Space", "Slide berikutnya"],
                    ["B atau .", "Black / Restore"],
                    ["C", "Clear text / Restore"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <kbd>{t(key)}</kbd>
                      <span>{t(label)}</span>
                    </div>
                  ))}
                  <p className="field-help">
                    {t(
                      "Aktif selama LIVE di seluruh jendela operator dan jendela proyektor, kecuali saat mengetik atau di dalam editor. Escape mengikuti perilaku fullscreen browser.",
                    )}
                  </p>
                </div>
              </section>
            </div>
          )}
        </main>
        <footer>
          <span>
            <i className={loaded ? "dot" : "dot amber"} />
            {t(saved)}
          </span>
          {presentationState.checkpoint !== "Belum ada checkpoint" && (
            <span
              className={
                presentationState.checkpoint.startsWith("Checkpoint gagal")
                  ? "checkpoint-status failed"
                  : "checkpoint-status"
              }
              role="status"
            >
              {t(presentationState.checkpoint)}
              {presentationState.checkpoint.startsWith("Checkpoint gagal") && (
                <button
                  className="text-button"
                  disabled={!editable || !presentationState.live}
                  onClick={() => presentation.retryCheckpoint()}
                >
                  {t("Coba checkpoint lagi")}
                </button>
              )}
            </span>
          )}
          <span>
            {offline ? (
              <>
                <Check size={13} />
                {t("Shell offline siap")}
              </>
            ) : (
              <>
                <WifiOff size={13} />
                Offline shell:{" "}
                {import.meta.env.DEV
                  ? t("uji pada production build")
                  : t("menyiapkan cache")}
              </>
            )}
          </span>
          {presentationState.live && (
            <span data-testid="wake-lock-status" role="status">
              {wakeLock === "active"
                ? t("Layar dijaga tetap menyala")
                : wakeLock === "idle"
                  ? t("Menyiapkan penjaga layar…")
                  : t(
                      "Layar bisa tidur: matikan sleep/screen saver di pengaturan OS",
                    )}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
