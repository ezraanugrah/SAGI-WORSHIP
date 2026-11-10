import {
  validRender,
  backgroundIdentity,
  type RenderSpec,
} from "../themes/models";
import {
  validRef,
  validPlayback,
  type AssetRef,
  type Playback,
} from "../media/models";
import { validLicense } from "../scriptures/importFormat";
import type { License } from "../scriptures/models";
export const MAX_FRAMES = 10000,
  MAX_BYTES = 16 * 1024 * 1024;
export type Style = {
  font: "Arial" | "Georgia" | "Verdana";
  fontSize: number;
  safeMargin: number;
  theme: "black" | "sunset" | "ocean" | "purple";
  lines: number;
};
export type Page = {
  text: string;
  scripture?: true;
  media?: true;
  themed?: true;
};
export type FrameBase = {
  id: string;
  page: number;
  itemId: string | null;
  title: string;
  label: string;
  occurrence: number;
};
export type ScriptureCaption = {
  datasetId: string;
  verseId: string;
  reference: string;
  translation: string;
  attribution: string;
  originalText: string;
  part: number;
  total: number;
};
export type Frame = FrameBase &
  (
    | { kind?: "song"; songId: string; scripture?: never }
    | { kind: "scripture"; songId?: never; scripture: ScriptureCaption }
    | {
        kind: "media";
        songId?: never;
        scripture?: never;
        media: AssetRef;
        sourceId: string;
        sourceDigest: string;
        pageNumber: number;
      }
  );
export type Source = {
  id: string;
  revision: number;
  kind?: "song" | "scripture" | "media";
  checksum?: string;
};
export type Deck = {
  id: string;
  label: string;
  createdAt: string;
  style: Style;
  pages: Page[];
  frames: Frame[];
  sources: Source[];
  schedule: { id: string; revision: number } | null;
  overrides: { frameId: string; text: string }[];
  render?: RenderSpec;
  videoDefaults?: { loop: boolean; muted: boolean; volume: number };
  scriptureLicenses?: {
    datasetId: string;
    license: License;
    translation: string;
    checksum: string;
  }[];
};
export type Live = {
  deck: Deck;
  index: number;
  playback?: Playback;
  backgroundPlayback?: Playback;
  mode: "normal" | "black" | "clearText";
  /** Scrolling alert shown over the slide (hidden while Black). */
  alert?: { text: string };
};
export const ALERT_MAX = 300;
const textOverlay = (v: unknown, max: number) =>
  object(v) &&
  Object.keys(v).length === 1 &&
  string(v.text, max) &&
  v.text.trim().length > 0;
export type Checkpoint = {
  id: "phase3:checkpoint";
  format: 1 | 2 | 3 | 4;
  revision: number;
  sessionId: string;
  sequence: number;
  live: Live | null;
  updatedAt: string;
};
export type Preview = { deck: Deck; index: number };
export const uid = () => crypto.randomUUID();
export const clone = <T>(value: T): T => structuredClone(value);
export function object(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
export function string(v: unknown, max = 500): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}
export function integer(v: unknown, min: number, max: number): v is number {
  return (
    Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max
  );
}
export function validStyle(v: unknown): v is Style {
  return (
    object(v) &&
    ["Arial", "Georgia", "Verdana"].includes(v.font as string) &&
    integer(v.fontSize, 24, 120) &&
    integer(v.safeMargin, 0, 20) &&
    ["black", "sunset", "ocean", "purple"].includes(v.theme as string) &&
    integer(v.lines, 1, 12)
  );
}
export function validDeck(v: unknown): v is Deck {
  if (
    !object(v) ||
    !string(v.id, 160) ||
    !string(v.label, 250) ||
    !string(v.createdAt) ||
    !Number.isFinite(Date.parse(v.createdAt)) ||
    !validStyle(v.style) ||
    !Array.isArray(v.pages) ||
    !v.pages.length ||
    v.pages.length > MAX_FRAMES ||
    !Array.isArray(v.overrides) ||
    !Array.isArray(v.sources) ||
    !Array.isArray(v.frames) ||
    !v.frames.length ||
    v.frames.length > MAX_FRAMES
  )
    return false;
  if (
    !v.pages.every(
      (p) =>
        object(p) &&
        typeof p.text === "string" &&
        (p.text.trim().length > 0 ||
          p.scripture === true ||
          p.media === true ||
          (p.themed === true && v.render !== undefined)) &&
        p.text.length <= 30000,
    )
  )
    return false;
  if (
    !v.frames.every(
      (f) =>
        object(f) &&
        string(f.id, 1000) &&
        integer(f.page, 0, (v.pages as unknown[]).length - 1) &&
        (f.kind === undefined || f.kind === "song"
          ? string(f.songId, 160)
          : f.kind === "scripture"
            ? validCaption(f.scripture)
            : f.kind === "media" &&
              validRef(f.media) &&
              string(f.sourceId, 160) &&
              typeof f.sourceDigest === "string" &&
              /^[a-f0-9]{64}$/.test(f.sourceDigest) &&
              integer(f.pageNumber, 1, 300)) &&
        (f.itemId === null || string(f.itemId, 160)) &&
        string(f.title, 200) &&
        string(f.label, 100) &&
        integer(f.occurrence, 0, 1000),
    )
  )
    return false;
  if (
    v.frames.some(
      (f) =>
        f.kind === "media" &&
        (v.overrides as unknown[]).some(
          (o: unknown) => object(o) && o.frameId === f.id,
        ),
    )
  )
    return false;
  if (
    v.videoDefaults !== undefined &&
    (!object(v.videoDefaults) ||
      typeof v.videoDefaults.loop !== "boolean" ||
      typeof v.videoDefaults.muted !== "boolean" ||
      typeof v.videoDefaults.volume !== "number" ||
      !Number.isFinite(v.videoDefaults.volume) ||
      v.videoDefaults.volume < 0 ||
      v.videoDefaults.volume > 2)
  )
    return false;
  const scriptureFrames = v.frames.filter((f) => f.kind === "scripture");
  if (scriptureFrames.length) {
    if (
      !Array.isArray(v.scriptureLicenses) ||
      v.scriptureLicenses.length > 5000 ||
      !v.scriptureLicenses.every(
        (l) =>
          object(l) &&
          string(l.datasetId, 160) &&
          validLicense(l.license) &&
          string(l.translation, 240) &&
          typeof l.checksum === "string" &&
          /^[0-9a-f]{64}$/.test(l.checksum),
      )
    )
      return false;
    const groups = new Map<string, typeof scriptureFrames>();
    for (const frame of scriptureFrames) {
      const c = frame.scripture as ScriptureCaption;
      const license = v.scriptureLicenses.find(
        (l) => l.datasetId === c.datasetId,
      );
      if (
        !license ||
        license.translation !== c.translation ||
        license.license.displayAttribution !== c.attribution ||
        (v.overrides as unknown[] | undefined)?.some(
          (o) => object(o) && o.frameId === frame.id,
        )
      )
        return false;
      const key = JSON.stringify([frame.itemId, c.verseId]);
      const group = groups.get(key) ?? [];
      group.push(frame);
      groups.set(key, group);
    }
    for (const frames of groups.values()) {
      const first = frames[0].scripture as ScriptureCaption;
      if (
        frames.length !== first.total ||
        frames.some((f, i) => {
          const c = f.scripture as ScriptureCaption;
          return (
            c.part !== i + 1 ||
            c.total !== first.total ||
            c.originalText !== first.originalText ||
            c.reference !== first.reference ||
            c.translation !== first.translation ||
            c.attribution !== first.attribution
          );
        })
      )
        return false;
      const text = frames.map((f) => (v.pages as Page[])[f.page].text).join("");
      if (text !== first.originalText) return false;
    }
  }
  const ids = new Set(v.frames.map((f) => f.id));
  if (ids.size !== v.frames.length) return false;
  if (
    !Array.isArray(v.overrides) ||
    v.overrides.length > v.frames.length ||
    !v.overrides.every(
      (o) =>
        object(o) &&
        typeof o.frameId === "string" &&
        ids.has(o.frameId) &&
        typeof o.text === "string" &&
        o.text.trim().length > 0 &&
        o.text.length <= 30000,
    ) ||
    new Set(v.overrides.map((o) => o.frameId)).size !== v.overrides.length
  )
    return false;
  if (
    !Array.isArray(v.sources) ||
    v.sources.length > 5000 ||
    !v.sources.every(
      (s) =>
        object(s) &&
        string(s.id, 160) &&
        integer(s.revision, 1, Number.MAX_SAFE_INTEGER) &&
        (s.kind === undefined ||
          s.kind === "song" ||
          (["scripture", "media"].includes(s.kind as string) &&
            typeof s.checksum === "string" &&
            /^[0-9a-f]{64}$/.test(s.checksum))),
    )
  )
    return false;
  if (
    v.frames.some(
      (f) =>
        f.kind === "media" &&
        (!(f.media as AssetRef).mime.startsWith(
          (f.media as AssetRef).kind === "video" ? "video/" : "image/",
        ) ||
          !(v.sources as Source[]).some(
            (source) =>
              source.kind === "media" &&
              source.id === f.sourceId &&
              source.checksum === f.sourceDigest,
          )),
    )
  )
    return false;
  if (
    v.render !== undefined &&
    !validRender(
      v.render,
      (v.frames as Frame[]).map((f) => f.id),
    )
  )
    return false;
  if (
    v.render &&
    (v.frames as Frame[]).some(
      (frame) =>
        frame.kind === "media" && (v.render as RenderSpec).frames[frame.id],
    )
  )
    return false;
  if (
    v.schedule !== null &&
    (!object(v.schedule) ||
      !string(v.schedule.id, 160) ||
      !integer(v.schedule.revision, 1, Number.MAX_SAFE_INTEGER))
  )
    return false;
  try {
    return new TextEncoder().encode(JSON.stringify(v)).byteLength <= MAX_BYTES;
  } catch {
    return false;
  }
}
export function validLive(v: unknown): v is Live {
  return (
    object(v) &&
    validDeck(v.deck) &&
    integer(v.index, 0, v.deck.frames.length - 1) &&
    (v.backgroundPlayback === undefined ||
      (() => {
        const p = v.backgroundPlayback,
          render = v.deck.render,
          key = render?.frames[v.deck.frames[v.index].id],
          bg = key ? render?.themes[key]?.spec.background : undefined;
        return (
          validPlayback(p) &&
          p.muted &&
          p.volume === 0 &&
          p.loop &&
          bg?.kind === "video" &&
          p.frameId === backgroundIdentity(bg)
        );
      })()) &&
    (v.playback === undefined ||
      (validPlayback(v.playback) &&
        v.deck.frames[v.index].kind === "media" &&
        v.deck.frames[v.index].id === v.playback.frameId)) &&
    ["normal", "black", "clearText"].includes(v.mode as string) &&
    (v.alert === undefined || textOverlay(v.alert, ALERT_MAX))
  );
}
export function validCheckpoint(v: unknown): v is Checkpoint {
  return (
    object(v) &&
    v.id === "phase3:checkpoint" &&
    (v.format === 1 || v.format === 2 || v.format === 3 || v.format === 4) &&
    integer(v.revision, 1, Number.MAX_SAFE_INTEGER) &&
    string(v.sessionId, 160) &&
    integer(v.sequence, 0, Number.MAX_SAFE_INTEGER) &&
    (v.live === null ||
      (validLive(v.live) &&
        (v.format === 4 ||
          (v.format === 3 && !v.live.deck.render) ||
          (v.format === 2 && !hasMedia(v.live) && !v.live.deck.render) ||
          (v.format === 1 && legacyOnly(v.live) && !v.live.deck.render)))) &&
    string(v.updatedAt) &&
    Number.isFinite(Date.parse(v.updatedAt))
  );
}
export function frameText(deck: Deck, index: number) {
  const frame = deck.frames[index];
  return (
    deck.overrides.find((o) => o.frameId === frame.id)?.text ??
    deck.pages[frame.page].text
  );
}

export function overrideSignature(deck: Deck, frame: Frame) {
  const legacy = [
    frame.songId,
    deck.sources.find((source) => source.id === frame.songId)?.revision,
    deck.schedule?.id ?? null,
    deck.schedule?.revision ?? null,
  ];
  return JSON.stringify(
    deck.render
      ? [
          ...legacy,
          2,
          deck.render.frames[frame.id] ?? null,
          deck.render.sizes[frame.id] ?? null,
        ]
      : legacy,
  );
}

export function validCaption(v: unknown): v is ScriptureCaption {
  return (
    object(v) &&
    string(v.datasetId, 160) &&
    string(v.verseId, 160) &&
    string(v.reference, 160) &&
    string(v.translation, 240) &&
    string(v.attribution, 300) &&
    typeof v.originalText === "string" &&
    !!v.originalText.trim() &&
    v.originalText.length <= 30000 &&
    integer(v.part, 1, 10000) &&
    integer(v.total, 1, 10000) &&
    v.part <= v.total
  );
}
export function legacyOnly(live: Live | null) {
  return (
    live === null ||
    (live.deck.frames.every(
      (frame) => frame.kind !== "scripture" && frame.kind !== "media",
    ) &&
      live.deck.sources.every(
        (source) => source.kind !== "scripture" && source.kind !== "media",
      ) &&
      live.deck.pages.every(
        (page) => page.scripture !== true && page.media !== true,
      ))
  );
}

export const hasMedia = (live: Live | null) =>
  !!live?.deck.frames.some((f) => f.kind === "media");
