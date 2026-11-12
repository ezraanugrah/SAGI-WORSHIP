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
      [400, 700].map((weight) =>
        document.fonts.load(`${weight} 64px "${family}"`).catch(() => []),
      ),
    ),
  );
  return loading;
}
