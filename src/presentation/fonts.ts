/**
 * Lyric fonts. Montserrat, Poppins and Bebas Neue are bundled with the app
 * (OFL, @fontsource; imported in main.tsx and precached), so the projector
 * shows them offline. Georgia and Times New Roman come with macOS/Windows.
 */
export const LYRIC_FONTS = [
  "Montserrat",
  "Poppins",
  "Bebas Neue",
  "Georgia",
  "Times New Roman",
] as const;
/** Saved by earlier versions: still valid in stored data, drawn as Montserrat. */
export const LEGACY_FONTS = ["Arial", "Verdana"] as const;
export type LyricFont = (typeof LYRIC_FONTS)[number];
export type FontName = LyricFont | (typeof LEGACY_FONTS)[number];
export const FONT_VALUES: readonly string[] = [...LYRIC_FONTS, ...LEGACY_FONTS];
export const DEFAULT_FONT: LyricFont = "Montserrat";

/** The font a slide is drawn with: legacy fonts become Montserrat. */
export function lyricFont(font: string): LyricFont {
  return (LYRIC_FONTS as readonly string[]).includes(font)
    ? (font as LyricFont)
    : DEFAULT_FONT;
}
const SERIF = new Set(["Georgia", "Times New Roman"]);
/** CSS / canvas font-family list for a lyric font. */
export function fontStack(font: string) {
  const f = lyricFont(font);
  return `"${f}", ${SERIF.has(f) ? "serif" : "sans-serif"}`;
}
/**
 * Load the bundled faces before measuring text: a web font is only fetched
 * once something uses it, and measuring with a fallback font would break
 * pagination. Safe to call often.
 */
let loading: Promise<unknown> | null = null;
export function loadLyricFonts() {
  if (typeof document === "undefined" || !document.fonts?.load)
    return Promise.resolve();
  loading ??= Promise.all(
    ["Montserrat", "Poppins", "Bebas Neue"].flatMap((family) =>
      [800].map((weight) =>
        document.fonts.load(`${weight} 64px "${family}"`).catch(() => []),
      ),
    ),
  );
  return loading;
}

/**
 * The fixed lyric look: extra bold, white, with a black outline, whatever
 * the font or theme. Size and outline width are set in percent (1–100 %).
 */
export const LYRIC_WEIGHT = 800;
export const LYRIC_COLOR = "#ffffff";
export const OUTLINE_COLOR = "#000000";
/** 100 % font size, in px on the 1080p reference canvas. */
export const LYRIC_MAX_PX = 160;
/**
 * Smallest font for Scripture (px on the 1080p canvas): a picked range is
 * shrunk down to this to stay on one slide before it is split.
 */
export const SCRIPTURE_MIN_PX = 24;
/** Line limit for Scripture slides: the screen height decides, not this. */
export const SCRIPTURE_LINES = 40;
/** 100 % outline width, in px on the 1080p reference canvas. */
export const OUTLINE_MAX_PX = 12;
export const DEFAULT_OUTLINE_PX = 3;
export const percentOf = (px: number, max: number) =>
  Math.max(1, Math.min(100, Math.round((px / max) * 100)));
export const fontPx = (percent: number) =>
  Math.max(1, Math.round((percent / 100) * LYRIC_MAX_PX));
export const outlinePx = (percent: number) =>
  Math.round((percent / 100) * OUTLINE_MAX_PX * 100) / 100;
