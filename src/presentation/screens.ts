import type { ScreenChoice } from "./windowManager";

/**
 * Which screen the projector window opens on. With "Extend desktop" the
 * projector is a second screen; SAGI picks it (or the one the operator chose
 * last time, remembered by name) as soon as Chrome may list the screens.
 */
const KEY = "sagi:projector-screen";

/** The non-laptop screen to use: the remembered one, else the first
 * external (non-primary) screen; -1 when there is only one screen. */
export function preferredScreen(choices: ScreenChoice[]): number {
  if (choices.length < 2) return -1;
  const remembered = recall();
  if (remembered) {
    const i = choices.findIndex((c) => c.label === remembered);
    if (i >= 0) return i;
  }
  const external = choices.findIndex((c) => !c.isPrimary && !c.isInternal);
  if (external >= 0) return external;
  return choices.findIndex((c) => !c.isPrimary);
}

export function rememberScreen(choice: ScreenChoice | undefined) {
  try {
    if (choice) localStorage.setItem(KEY, choice.label);
    else localStorage.removeItem(KEY);
  } catch {
    /* only not remembered */
  }
}

function recall() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** True when Chrome may already list the screens (no permission prompt). */
export async function screensAllowed() {
  if (
    typeof (window as { getScreenDetails?: unknown }).getScreenDetails !==
    "function"
  )
    return false;
  for (const name of ["window-management", "window-placement"])
    try {
      const status = await navigator.permissions.query({
        name: name as PermissionName,
      });
      return status.state === "granted";
    } catch {
      /* older/newer name: try the next one */
    }
  return false;
}

/** More than one screen is connected (works without any permission). */
export function hasSecondScreen() {
  return !!(window.screen as Screen & { isExtended?: boolean }).isExtended;
}
