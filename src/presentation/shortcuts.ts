/** LIVE commands that keyboard shortcuts (operator or projector window) may trigger. */
export type LiveCommand = "next" | "previous" | "black" | "clearText";
export const liveCommands: readonly LiveCommand[] = [
  "next",
  "previous",
  "black",
  "clearText",
];

/**
 * Remembers recent command ids. The projector transport delivers each message
 * over two channels (BroadcastChannel and postMessage) for resilience, so a
 * non-idempotent command such as a Black toggle must be applied only once.
 */
export class RecentCommands {
  private ids: string[] = [];
  constructor(private limit = 64) {}
  accept(id: string) {
    if (this.ids.includes(id)) return false;
    this.ids.push(id);
    if (this.ids.length > this.limit) this.ids.shift();
    return true;
  }
}

/** Text entry and composite widgets that use these keys themselves. */
const TYPING =
  'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="listbox"],[role="slider"],[role="spinbutton"]';
/** Editors and dialogs where LIVE shortcuts must stay off even without a text field focused. */
const NO_LIVE_KEYS =
  'dialog,[role="dialog"],[role="alertdialog"],[aria-modal="true"],[data-live-shortcuts="off"]';

/**
 * Maps a key to a LIVE command:
 * → / Space / PageDown = next, ← / PageUp = previous (presentation clickers),
 * B or . = Black, C = Clear Text.
 */
export function commandForKey(key: string): LiveCommand | null {
  switch (key) {
    case "arrowright":
    case "pagedown":
    case " ":
      return "next";
    case "arrowleft":
    case "pageup":
      return "previous";
    case "b":
    case ".":
      return "black";
    case "c":
      return "clearText";
    default:
      return null;
  }
}

export function presentationKey(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  )
    return null;
  const path = event.composedPath();
  const within = (selector: string) =>
    path.some(
      (element) =>
        typeof HTMLElement !== "undefined" &&
        element instanceof HTMLElement &&
        element.matches(selector),
    );
  if (within(TYPING) || within(NO_LIVE_KEYS)) return null;
  const key = event.key.toLowerCase();
  if (["b", "c", "."].includes(key) && event.repeat) return null;
  // Space on a focused button/link activates that control instead.
  if (key === " " && within('button,a,[role="button"]')) return null;
  return commandForKey(key) ? key : null;
}
