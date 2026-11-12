import { t } from "../i18n";
import {
  BellRing,
  Cast,
  ChevronDown,
  Eraser,
  MonitorPlay,
  Square,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  PresentationController,
  type PresentationState,
} from "../presentation/controller";
import { ALERT_MAX } from "../presentation/models";
import type { ScreenChoice } from "../presentation/windowManager";

/**
 * LIVE toolbar in the top bar (visible on every page). This is the only place
 * for Go Live, Black, Clear, Alerts and opening the projector window.
 */
export function LiveToolbar({
  controller,
  state,
  editable,
  dirty,
  screen,
}: {
  controller: PresentationController;
  state: PresentationState;
  editable: boolean;
  /** Preview has unapplied edits (Go Live waits for Apply). */
  dirty: boolean;
  /** Screen picked in the top bar (optional). */
  screen?: ScreenChoice;
}) {
  const live = state.live;
  const [alertOpen, setAlertOpen] = useState(false),
    [message, setMessage] = useState("");
  const popover = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!alertOpen) return;
    setMessage(live?.alert?.text ?? "");
    const close = (e: MouseEvent) => {
      if (!popover.current?.parentElement?.contains(e.target as Node))
        setAlertOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
    // Prefill only when the popover opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertOpen]);
  useEffect(() => {
    if (!live) setAlertOpen(false);
  }, [live]);
  const run = (action: () => unknown) => {
    try {
      const result = action();
      if (result instanceof Promise)
        void result.catch((e) => controller.report(e));
      return true;
    } catch (e) {
      controller.report(e);
      return false;
    }
  };
  const projectorOn = state.connection.status === "Tersinkron";
  // Hover text: what the button does, or why it is not available yet.
  const readOnlyHint = t("Tab ini hanya baca");
  const goLiveHint = !editable
    ? readOnlyHint
    : state.recovery
      ? t("Pilih Resume atau Discard checkpoint dulu")
      : state.preparing
        ? t("Menyiapkan slide…")
        : !state.preview
          ? t("Klik lagu atau item jadwal untuk Preview dulu")
          : dirty
            ? t("Apply Preview atau buang perubahan dulu")
            : t("Tampilkan slide Preview ke jemaat");
  const liveHint = (action: string) =>
    !editable ? readOnlyHint : !live ? t("Go Live dulu") : t(action);
  return (
    <div className="live-toolbar" role="toolbar" aria-label="Kontrol LIVE">
      <ToolButton
        label="Go Live"
        title={goLiveHint}
        icon={<MonitorPlay size={20} />}
        tone="go"
        disabled={
          !editable ||
          !state.preview ||
          dirty ||
          state.preparing ||
          !!state.recovery
        }
        onClick={() => run(() => controller.goLive())}
      />
      <span className="toolbar-divider" aria-hidden="true" />
      <div className="tool-menu">
        <ToolButton
          label="Alerts"
          title={liveHint("Teks berjalan untuk jemaat")}
          icon={<BellRing size={20} />}
          menu
          pressed={!!live?.alert}
          expanded={alertOpen}
          disabled={!editable || !live}
          onClick={() => setAlertOpen((open) => !open)}
        />
        {alertOpen && (
          <div
            className="tool-popover"
            ref={popover}
            role="dialog"
            aria-label="Alert untuk jemaat"
            onKeyDown={(e) => {
              if (e.key === "Escape") setAlertOpen(false);
            }}
          >
            <label>
              {t("Pesan alert")}
              <textarea
                aria-label="Pesan alert"
                rows={2}
                maxLength={ALERT_MAX}
                autoFocus
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t(
                  "Contoh: Orang tua dari Budi harap ke ruang anak",
                )}
              />
            </label>
            <div className="tool-popover-actions">
              {live?.alert && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    if (run(() => controller.alert(null))) setAlertOpen(false);
                  }}
                >
                  {t("Hentikan alert")}
                </button>
              )}
              <button
                type="button"
                className="button primary"
                disabled={!message.trim()}
                onClick={() => {
                  if (run(() => controller.alert(message))) setAlertOpen(false);
                }}
              >
                {t("Tampilkan alert")}
              </button>
            </div>
          </div>
        )}
      </div>
      <ToolButton
        label="Black"
        title={liveHint("Layar hitam (klik lagi untuk kembali)")}
        icon={<Square size={20} fill="currentColor" />}
        pressed={live?.mode === "black"}
        disabled={!editable || !live}
        onClick={() => run(() => controller.toggle("black"))}
      />
      <ToolButton
        label="Clear"
        name="Clear Text"
        title={liveHint("Sembunyikan teks (klik lagi untuk kembali)")}
        icon={<Eraser size={20} />}
        pressed={live?.mode === "clearText"}
        disabled={!editable || !live}
        onClick={() => run(() => controller.toggle("clearText"))}
      />
      <span className="toolbar-divider" aria-hidden="true" />
      <ToolButton
        label="Live"
        title={editable ? t("Buka jendela proyektor") : readOnlyHint}
        icon={<Cast size={20} />}
        pressed={projectorOn}
        disabled={!editable}
        onClick={() => run(() => controller.windows.open(screen))}
      />
    </div>
  );
}

function ToolButton({
  label,
  name,
  title,
  icon,
  onClick,
  disabled,
  pressed,
  expanded,
  menu,
  tone,
}: {
  label: string;
  /** Accessible name when it should differ from the visible label. */
  name?: string;
  title?: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  expanded?: boolean;
  menu?: boolean;
  tone?: "go";
}) {
  return (
    <button
      type="button"
      className={`tool-button${tone ? ` ${tone}` : ""}`}
      aria-label={name}
      title={title}
      aria-pressed={pressed === undefined ? undefined : pressed}
      aria-expanded={menu ? expanded : undefined}
      aria-haspopup={menu ? "dialog" : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="tool-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="tool-label">
        {label}
        {menu && <ChevronDown size={11} aria-hidden="true" />}
      </span>
    </button>
  );
}
