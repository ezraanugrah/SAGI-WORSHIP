import { Cast, Eraser, MonitorPlay, Square } from "lucide-react";
import type { ReactNode } from "react";
import {
  PresentationController,
  type PresentationState,
} from "../presentation/controller";

/**
 * Quick LIVE toolbar in the top bar (visible on every page). Uses the same
 * controller actions and rules as the LIVE panel.
 */
export function LiveToolbar({
  controller,
  state,
  editable,
  dirty,
}: {
  controller: PresentationController;
  state: PresentationState;
  editable: boolean;
  /** Preview has unapplied edits (Go Live waits for Apply, like the panel). */
  dirty: boolean;
}) {
  const live = state.live;
  const run = (action: () => unknown) => {
    try {
      const result = action();
      if (result instanceof Promise)
        void result.catch((e) => controller.report(e));
    } catch (e) {
      controller.report(e);
    }
  };
  const projectorOn = state.connection.status === "Tersinkron";
  return (
    <div className="live-toolbar" role="toolbar" aria-label="Kontrol LIVE cepat">
      <ToolButton
        label="Go Live"
        name="Go Live dari toolbar"
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
      <ToolButton
        label="Black"
        name="Emergency Black"
        icon={<Square size={20} fill="currentColor" />}
        pressed={live?.mode === "black"}
        disabled={!editable || !live}
        onClick={() => run(() => controller.toggle("black"))}
      />
      <ToolButton
        label="Clear"
        name="Clear dari toolbar"
        icon={<Eraser size={20} />}
        pressed={live?.mode === "clearText"}
        disabled={!editable || !live}
        onClick={() => run(() => controller.toggle("clearText"))}
      />
      <span className="toolbar-divider" aria-hidden="true" />
      <ToolButton
        label="Live"
        name="Live: buka jendela proyektor"
        icon={<Cast size={20} />}
        pressed={projectorOn}
        disabled={!editable}
        onClick={() => run(() => controller.windows.open())}
      />
    </div>
  );
}

function ToolButton({
  label,
  name,
  icon,
  onClick,
  disabled,
  pressed,
  tone,
}: {
  label: string;
  name: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  tone?: "go";
}) {
  return (
    <button
      type="button"
      className={`tool-button${tone ? ` ${tone}` : ""}`}
      aria-label={name}
      aria-pressed={pressed === undefined ? undefined : pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="tool-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="tool-label">{label}</span>
    </button>
  );
}
