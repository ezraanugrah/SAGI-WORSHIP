import { validRef, type AssetRef } from "../media/models";
import {
  FONT_VALUES,
  LYRIC_MAX_PX,
  OUTLINE_MAX_PX,
  type FontName,
} from "../presentation/fonts";
export type Background =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; angle: number; stops: { color: string; at: number }[] }
  | {
      kind: "image" | "video";
      asset: AssetRef;
      poster: AssetRef;
      libraryId: string;
      fit: "contain" | "cover";
      x: number;
      y: number;
      dim: number;
      fallback: string;
    };
export type Typography = {
  /** Lyrics use the global text font; kept for stored data. */
  font: FontName;
  size: number;
  weight: 400 | 700 | 800;
  italic: boolean;
  underline: boolean;
  color: string;
  align: "left" | "center" | "right";
  vertical: "top" | "middle" | "bottom";
  lineHeight: number;
  outline: { width: number; color: string };
  shadow: { x: number; y: number; blur: number; color: string };
  margins: { top: number; right: number; bottom: number; left: number };
  lines: number;
  fit: "paginate" | "shrink";
  minSize: number;
};
export type ThemeSpec = { background: Background; type: Typography };
export type ThemeRecord = {
  id: string;
  format: 1;
  revision: number;
  name: string;
  spec: ThemeSpec;
  signature: string;
  createdAt: string;
  updatedAt: string;
};
export type ThemeSnapshot = {
  id: string;
  revision: number;
  name: string;
  spec: ThemeSpec;
  signature: string;
};
export type RenderSpec = {
  version: 2;
  canvas: {
    width: 1280 | 1920;
    height: 720 | 1080;
    scaling: "fit" | "no-upscale";
  };
  themes: Record<string, ThemeSnapshot>;
  frames: Record<string, string>;
  sizes: Record<string, number>;
};
export type AdvancedSettings = {
  id: "phase6:settings";
  format: 1;
  revision: number;
  defaultThemeId: string | null;
  reference: 720 | 1080;
  scaling: "fit" | "no-upscale";
  reducedMotion: boolean;
  contrastWarnings: boolean;
};
export const advancedDefaults: AdvancedSettings = {
  id: "phase6:settings",
  format: 1,
  revision: 0,
  defaultThemeId: null,
  reference: 1080,
  scaling: "fit",
  reducedMotion: true,
  contrastWarnings: true,
};
export const color = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
export const number = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
/**
 * The Scriptures background (tab Scriptures › Latar ayat): stored like a
 * custom theme so it syncs between laptops, but never listed under Themes
 * and never used for songs.
 */
export const SCRIPTURE_THEME_ID = "theme:scripture";
export const themeId = (v: unknown): v is string =>
  typeof v === "string" &&
  /^(theme:[a-zA-Z0-9_-]+|builtin:(black|sunset|ocean|purple))$/.test(v);
const hash = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
export function validBackground(v: unknown): v is Background {
  if (!object(v)) return false;
  if (v.kind === "solid") return Object.keys(v).length === 2 && color(v.color);
  if (v.kind === "gradient")
    return (
      Object.keys(v).length === 3 &&
      number(v.angle, 0, 360) &&
      Array.isArray(v.stops) &&
      v.stops.length >= 2 &&
      v.stops.length <= 4 &&
      v.stops.every(
        (s, i, a) =>
          object(s) &&
          Object.keys(s).length === 2 &&
          color(s.color) &&
          number(s.at, 0, 100) &&
          (i === 0 || s.at > a[i - 1].at),
      )
    );
  if (v.kind !== "image" && v.kind !== "video") return false;
  return (
    Object.keys(v).length === 9 &&
    validRef(v.asset) &&
    v.asset.kind === v.kind &&
    v.asset.mime.startsWith(v.kind === "video" ? "video/" : "image/") &&
    validRef(v.poster) &&
    v.poster.kind === "image" &&
    v.poster.mime.startsWith("image/") &&
    typeof v.libraryId === "string" &&
    /^meta:[a-zA-Z0-9_-]+$/.test(v.libraryId) &&
    ["contain", "cover"].includes(v.fit as string) &&
    number(v.x, 0, 100) &&
    number(v.y, 0, 100) &&
    number(v.dim, 0, 0.85) &&
    color(v.fallback)
  );
}
export function validTypography(v: unknown): v is Typography {
  if (
    !object(v) ||
    Object.keys(v).length !== 15 ||
    !object(v.outline) ||
    !object(v.shadow) ||
    !object(v.margins)
  )
    return false;
  return (
    FONT_VALUES.includes(v.font as string) &&
    number(v.size, 1, LYRIC_MAX_PX) &&
    [400, 700, 800].includes(v.weight as number) &&
    typeof v.italic === "boolean" &&
    typeof v.underline === "boolean" &&
    color(v.color) &&
    ["left", "center", "right"].includes(v.align as string) &&
    ["top", "middle", "bottom"].includes(v.vertical as string) &&
    number(v.lineHeight, 1, 2) &&
    Object.keys(v.outline).length === 2 &&
    number(v.outline.width, 0, OUTLINE_MAX_PX) &&
    color(v.outline.color) &&
    Object.keys(v.shadow).length === 4 &&
    number(v.shadow.x, -12, 12) &&
    number(v.shadow.y, -12, 12) &&
    number(v.shadow.blur, 0, 12) &&
    color(v.shadow.color) &&
    Object.keys(v.margins).length === 4 &&
    ["top", "right", "bottom", "left"].every((k) =>
      Object.hasOwn(v.margins as object, k),
    ) &&
    Object.values(v.margins).every((n) => number(n, 0, 20)) &&
    Number.isInteger(v.lines) &&
    // Up to 12 for songs; Scripture slides use more (SCRIPTURE_LINES).
    number(v.lines, 1, 40) &&
    ["paginate", "shrink"].includes(v.fit as string) &&
    Number.isInteger(v.minSize) &&
    number(v.minSize, 1, v.size as number)
  );
}
export function validSpec(v: unknown): v is ThemeSpec {
  return (
    object(v) &&
    Object.keys(v).length === 2 &&
    validBackground(v.background) &&
    validTypography(v.type)
  );
}
export function validTheme(v: unknown): v is ThemeRecord {
  const r = v as ThemeRecord;
  return (
    !!r &&
    Object.keys(r).every((k) =>
      [
        "id",
        "format",
        "revision",
        "name",
        "spec",
        "signature",
        "createdAt",
        "updatedAt",
      ].includes(k),
    ) &&
    themeId(r.id) &&
    r.id.startsWith("theme:") &&
    r.format === 1 &&
    Number.isSafeInteger(r.revision) &&
    r.revision > 0 &&
    typeof r.name === "string" &&
    r.name.trim().length > 0 &&
    r.name.length <= 100 &&
    validSpec(r.spec) &&
    hash(r.signature) &&
    Number.isFinite(Date.parse(r.createdAt)) &&
    Number.isFinite(Date.parse(r.updatedAt))
  );
}
export function validSnapshot(v: unknown): v is ThemeSnapshot {
  const r = v as ThemeSnapshot;
  return (
    !!r &&
    Object.keys(r).length === 5 &&
    themeId(r.id) &&
    Number.isSafeInteger(r.revision) &&
    r.revision > 0 &&
    typeof r.name === "string" &&
    !!r.name.trim() &&
    r.name.length <= 100 &&
    hash(r.signature) &&
    validSpec(r.spec)
  );
}
export function validAdvanced(v: unknown): v is AdvancedSettings {
  const r = v as AdvancedSettings;
  return (
    !!r &&
    Object.keys(r).length === 8 &&
    r.id === "phase6:settings" &&
    r.format === 1 &&
    Number.isSafeInteger(r.revision) &&
    r.revision >= 0 &&
    (r.defaultThemeId === null || themeId(r.defaultThemeId)) &&
    [720, 1080].includes(r.reference) &&
    ["fit", "no-upscale"].includes(r.scaling) &&
    typeof r.reducedMotion === "boolean" &&
    typeof r.contrastWarnings === "boolean"
  );
}
export function validRender(v: unknown, frameIds: string[]): v is RenderSpec {
  const r = v as RenderSpec;
  if (
    !r ||
    Object.keys(r).length !== 5 ||
    r.version !== 2 ||
    !r.canvas ||
    Object.keys(r.canvas).length !== 3 ||
    ![1280, 1920].includes(r.canvas.width) ||
    r.canvas.height !== (r.canvas.width * 9) / 16 ||
    !["fit", "no-upscale"].includes(r.canvas.scaling) ||
    !object(r.themes) ||
    !object(r.frames) ||
    !object(r.sizes) ||
    Object.keys(r.themes).length > 5000 ||
    Object.keys(r.frames).length > 10000
  )
    return false;
  if (Object.keys(r.sizes).length !== Object.keys(r.frames).length)
    return false;
  return (
    Object.entries(r.themes).every(
      ([k, t]) => validSnapshot(t) && k === `${t.id}@${t.signature}`,
    ) &&
    Object.entries(r.frames).every(
      ([id, key]) =>
        frameIds.includes(id) &&
        typeof key === "string" &&
        !!r.themes[key] &&
        number(
          r.sizes[id],
          r.themes[key].spec.type.minSize,
          r.themes[key].spec.type.size,
        ),
    )
  );
}
export function backgroundRefs(spec: ThemeSpec): AssetRef[] {
  return spec.background.kind === "image" || spec.background.kind === "video"
    ? [spec.background.asset, spec.background.poster]
    : [];
}
export const defaultType: Typography = {
  font: "Montserrat",
  size: 64,
  weight: 400,
  italic: false,
  underline: false,
  color: "#ffffff",
  align: "center",
  vertical: "middle",
  lineHeight: 1.3,
  outline: { width: 0, color: "#000000" },
  shadow: { x: 0, y: 2, blur: 8, color: "#000000" },
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
  lines: 6,
  fit: "paginate",
  minSize: 32,
};

export const backgroundIdentity = (
  b: Extract<Background, { kind: "image" | "video" }>,
) => JSON.stringify([b.asset.id, b.asset.digest, b.fit, b.x, b.y, b.dim]);
