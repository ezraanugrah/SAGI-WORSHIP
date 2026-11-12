/**
 * Two languages for the operator screens: Indonesian (default, the source
 * text) and English. `t("Teks Indonesia")` returns the English text from
 * `en.ts` when English is chosen; anything not in the dictionary stays as
 * it is. The choice is kept per laptop (localStorage) and shared with the
 * projector window. Slides (lyrics, verses) are never translated.
 */
import { useSyncExternalStore } from "react";
import { EN, EN_PATTERNS } from "./en";

export type Lang = "id" | "en";
const KEY = "sagi-language";
function load(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "id";
  } catch {
    return "id";
  }
}
let current: Lang = typeof window === "undefined" ? "id" : load();
const listeners = new Set<() => void>();
function notify() {
  if (typeof document !== "undefined") document.documentElement.lang = current;
  listeners.forEach((fn) => fn());
}
if (typeof window !== "undefined") {
  document.documentElement.lang = current;
  // Another SAGI window (e.g. the projector) changed the language.
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) {
      current = load();
      notify();
    }
  });
}
export function getLang() {
  return current;
}
export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private window: the choice lasts for this page only */
  }
  notify();
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
/** Re-render (from the root) when the language changes. */
export function useLang() {
  return useSyncExternalStore(subscribe, getLang, () => "id" as Lang);
}
const normal = (s: string) => s.replace(/\s+/g, " ").trim();
/**
 * Translate an Indonesian UI text. `{name}` placeholders are filled from
 * `vars` (after translation, so the English text keeps them too).
 */
export function t(text: string, vars?: Record<string, string | number>) {
  let out = text;
  if (current === "en") {
    const key = normal(text);
    const hit = EN[key];
    if (hit !== undefined) out = hit;
    else
      for (const [pattern, replace] of EN_PATTERNS) {
        const m = key.match(pattern);
        if (m) {
          out = replace(...(m.slice(1) as string[]));
          break;
        }
      }
  }
  // "{n} song|{n} songs": singular when n is 1 (English plurals).
  if (current === "en" && vars && "n" in vars && out.includes("|")) {
    const [one, many] = out.split("|");
    out = Number(vars.n) === 1 ? one : many;
  }
  if (vars)
    out = out.replace(/\{(\w+)\}/g, (all, name) =>
      name in vars ? String(vars[name]) : all,
    );
  return out;
}
