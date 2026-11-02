import { defaultType, type ThemeSpec, type ThemeSnapshot } from "./models";
import { sha256, canonicalJSON } from "../scriptures/importFormat";
export const builtinNames = {
  black: "Default Black",
  sunset: "Sunset",
  ocean: "Ocean",
  purple: "Purple",
};
const backgrounds: Record<keyof typeof builtinNames, ThemeSpec["background"]> =
  {
    black: { kind: "solid", color: "#08090b" },
    sunset: {
      kind: "gradient",
      angle: 145,
      stops: [
        { color: "#442c37", at: 0 },
        { color: "#ae664c", at: 65 },
        { color: "#cc9859", at: 100 },
      ],
    },
    ocean: {
      kind: "gradient",
      angle: 145,
      stops: [
        { color: "#102a32", at: 0 },
        { color: "#1b646e", at: 100 },
      ],
    },
    purple: {
      kind: "gradient",
      angle: 145,
      stops: [
        { color: "#20162e", at: 0 },
        { color: "#62416f", at: 100 },
      ],
    },
  };
export async function signature(spec: ThemeSpec) {
  return sha256(canonicalJSON(spec));
}
export async function builtins(): Promise<ThemeSnapshot[]> {
  return Promise.all(
    Object.entries(builtinNames).map(async ([id, name]) => {
      const spec: ThemeSpec = {
        background: backgrounds[id as keyof typeof backgrounds],
        type: structuredClone(defaultType),
      };
      return {
        id: `builtin:${id}`,
        revision: 1,
        name,
        spec,
        signature: await signature(spec),
      };
    }),
  );
}
export function cssBackground(bg: ThemeSpec["background"]) {
  return bg.kind === "solid"
    ? bg.color
    : bg.kind === "gradient"
      ? `linear-gradient(${bg.angle}deg,${bg.stops.map((s) => `${s.color} ${s.at}%`).join(",")})`
      : bg.fallback;
}
export function contrast(a: string, b: string) {
  const lum = (s: string) => {
    const values = [1, 3, 5]
      .map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
