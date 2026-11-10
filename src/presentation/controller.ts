import { canonicalJSON } from "../scriptures/importFormat";
import {
  advancedDefaults,
  defaultType,
  type AdvancedSettings,
} from "../themes/models";
import { signature } from "../themes/builtins";
import { themeFor, fitsAppearance, type AppearanceContext } from "./appearance";
import { mediaRefs, type PlaybackFeedback } from "../media/models";
import { fitsFrame } from "./scriptureAdapter";
import type { Workspace } from "../domain/models";
import { WriterGate } from "../data/writer";
import { PresentationRepository } from "../data/presentationRepository";
import { generateSlides, type Selection } from "./generateSlides";
import { fits, type Measure } from "./layout";
import {
  clone,
  frameText,
  validLive,
  ALERT_MAX,
  validStyle,
  overrideSignature,
  type Style,
  type Preview,
  type Live,
  type Checkpoint,
  type Deck,
} from "./models";
import { WindowManager, type Connection } from "./windowManager";
import type { LiveCommand } from "./shortcuts";
export type PresentationState = {
  preview: Preview | null;
  live: Live | null;
  sequence: number;
  preparing: boolean;
  error: string;
  recovery: Checkpoint | null;
  recoveryLoaded: boolean;
  recovering: boolean;
  checkpoint: string;
  connection: Connection;
  sourceChanged: boolean;
  playbackFeedback?: PlaybackFeedback;
  backgroundFeedback?: PlaybackFeedback;
};
export class PresentationController {
  private state: PresentationState = {
    preview: null,
    live: null,
    sequence: 0,
    preparing: false,
    error: "",
    recovery: null,
    recoveryLoaded: false,
    recovering: false,
    checkpoint: "Belum ada checkpoint",
    connection: {
      status: "Belum dibuka",
      ack: -1,
      fullscreen: false,
      error: "",
    },
    sourceChanged: false,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private intent = 0;
  private playbackRevision = 0;
  private lastVideoCheckpoint = 0;
  private releasedForDeck = "";
  private expectedRevision = 0;
  private recoveryBroken = false;
  private recoveryGeneration = 0;
  private overrideRevisions = new Map<string, number>();
  private writes: Promise<void> = Promise.resolve();
  private ticket: number | null = null;
  private sessionEnded = false;
  assertMaintenanceReady() {
    if (
      !this.sessionEnded ||
      this.state.live ||
      this.windows.hasOpenOutput() ||
      this.state.preparing
    )
      throw new Error(
        "End Session dan tutup projector sebelum restore/repair.",
      );
  }
  async endSession() {
    this.authorize();
    if (this.state.live) this.mode("black");
    const endingIntent = ++this.intent;
    this.generation++;
    await this.writes;
    this.authorize();
    if (endingIntent !== this.intent)
      throw new Error("Perintah lebih baru membatalkan End Session.");
    this.windows.retire();
    this.sessionEnded = true;
    this.update({ live: null, preview: null, preparing: false });
  }
  readonly windows: WindowManager;
  constructor(
    private gate: WriterGate,
    private repo: PresentationRepository,
    private measure: Measure,
  ) {
    this.windows = new WindowManager(
      () => this.authorize(),
      (connection) => {
        this.update({ connection });
        const live = this.state.live;
        if (
          live &&
          this.gate.active &&
          connection.status === "Tersinkron" &&
          connection.ack === this.state.sequence &&
          this.releasedForDeck !== live.deck.id
        ) {
          this.releasedForDeck = live.deck.id;
          void this.repo
            .mediaRepository()
            .releaseRetired(this.windows.pairing.session, live.deck.id)
            .catch(() => {
              this.releasedForDeck = "";
            });
        }
      },
      (value) => this.onPlayback(value),
      (command) => this.command(command),
    );
  }
  /** Applies a LIVE shortcut from the operator keyboard or the projector window. */
  command(command: LiveCommand) {
    if (!this.state.live) return;
    try {
      if (command === "next") this.navigate(1);
      else if (command === "previous") this.navigate(-1);
      else this.toggle(command);
    } catch (e) {
      this.report(e);
    }
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.state;
  private update(patch: Partial<PresentationState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private authorize() {
    if (this.ticket === null) this.ticket = this.gate.ticket();
    this.gate.assert(this.ticket);
  }
  start() {
    const stop = this.windows.start();
    const unsubscribe = this.gate.subscribe(() => {
      if (this.gate.active && !this.gate.busy) this.ticket = null;
      if (!this.gate.active && this.ticket !== null) {
        this.generation++;
        this.update({
          preparing: false,
          error:
            "Hak tulis hilang. LIVE terakhir dipertahankan; kontrol dinonaktifkan.",
        });
      }
    });
    void this.loadRecovery();
    return () => {
      this.generation++;
      this.recoveryGeneration++;
      unsubscribe();
      stop();
    };
  }
  async loadRecovery() {
    const generation = ++this.recoveryGeneration;
    try {
      const row = await this.repo.loadCheckpoint();
      if (generation !== this.recoveryGeneration) return;
      this.expectedRevision = row?.revision ?? 0;
      this.recoveryBroken = false;
      this.update({
        recovery: row?.live ? row : null,
        recoveryLoaded: true,
        checkpoint: row?.live
          ? "Checkpoint tersedia untuk Resume/Discard"
          : "Belum ada checkpoint",
      });
    } catch (e) {
      if (generation !== this.recoveryGeneration) return;
      this.recoveryBroken = true;
      this.update({
        error: String((e as Error).message),
        recoveryLoaded: true,
        checkpoint: "Checkpoint rusak dipertahankan",
      });
    }
  }
  clearError() {
    this.update({ error: "" });
  }
  report(error: unknown) {
    this.update({
      error: error instanceof Error ? error.message : String(error),
    });
  }
  async prepare(
    data: Workspace,
    selection: Selection,
    style: Style,
    videoDefaults?: Deck["videoDefaults"],
    appearance?: AppearanceContext,
  ) {
    const generation = ++this.generation;
    this.update({ preparing: true, error: "" });
    try {
      const preview = await generateSlides(
        data,
        selection,
        style,
        this.measure,
        () => generation !== this.generation,
        appearance,
      );
      if (videoDefaults) preview.deck.videoDefaults = clone(videoDefaults);
      const saved = await this.repo.loadOverrides();
      if (generation !== this.generation) return;
      this.overrideRevisions = new Map(
        saved.values.map((value) => [value.id, value.revision]),
      );
      for (const override of saved.values)
        if (
          preview.deck.frames.some(
            (frame) =>
              frame.kind !== "scripture" &&
              frame.kind !== "media" &&
              frame.id === override.frameId &&
              override.sourceSignature ===
                overrideSignature(preview.deck, frame),
          ) &&
          canonicalJSON(override.style) === canonicalJSON(style) &&
          preview.deck.frames.some((f) => f.id === override.frameId) &&
          (preview.deck.render
            ? fitsAppearance(
                {
                  ...preview.deck,
                  overrides: [
                    { frameId: override.frameId, text: override.text },
                  ],
                },
                preview.deck.frames.findIndex((f) => f.id === override.frameId),
                this.measure,
              )
            : fits(override.text, style, this.measure))
        )
          preview.deck.overrides.push({
            frameId: override.frameId,
            text: override.text,
          });
      if (
        (mediaRefs(preview.deck).length ||
          (this.state.preview && mediaRefs(this.state.preview.deck).length)) &&
        this.gate.active
      )
        await this.repo
          .mediaRepository()
          .pin(preview.deck, `preview:${this.windows.pairing.session}`);
      if (generation !== this.generation) return;
      this.update({
        preview,
        preparing: false,
        sourceChanged: false,
        error: saved.issues.join(" "),
      });
    } catch (e) {
      if (generation === this.generation)
        this.update({ preparing: false, error: (e as Error).message });
    }
  }
  async calibration(settings: AdvancedSettings = advancedDefaults) {
    const generation = ++this.generation;
    const spec = {
        background: { kind: "solid" as const, color: "#08090b" },
        type: { ...structuredClone(defaultType), size: 64, minSize: 32 },
      },
      sig = await signature(spec);
    if (generation !== this.generation) return;
    const snapshot = {
        id: "builtin:black",
        revision: 1,
        name: "Calibration",
        signature: sig,
        spec,
      },
      key = `${snapshot.id}@${sig}`,
      deck: Deck = {
        id: crypto.randomUUID(),
        label: "Kalibrasi Preview · 16:9",
        createdAt: new Date().toISOString(),
        style: {
          font: "Arial",
          fontSize: 64,
          safeMargin: 8,
          theme: "black",
          lines: 6,
        },
        pages: [
          {
            text: "SAGI WORSHIP · 16:9\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nSafe margins · hitam / putih / amber",
            themed: true,
          },
        ],
        frames: [
          {
            id: "calibration",
            songId: "calibration",
            page: 0,
            itemId: null,
            title: "Kalibrasi",
            label: "Test pattern",
            occurrence: 0,
          },
        ],
        sources: [],
        schedule: null,
        overrides: [],
        render: {
          version: 2,
          canvas: {
            width: settings.reference === 720 ? 1280 : 1920,
            height: settings.reference,
            scaling: settings.scaling,
          },
          themes: { [key]: snapshot },
          frames: { calibration: key },
          sizes: { calibration: 64 },
        },
      };
    this.update({
      preview: { deck, index: 0 },
      sourceChanged: false,
      error: "",
    });
  }
  observeThemes(themes: { id: string; revision: number; signature: string }[]) {
    const deck = this.state.preview?.deck;
    if (
      deck?.render &&
      Object.values(deck.render.themes).some(
        (t) =>
          t.id.startsWith("theme:") &&
          !themes.some(
            (value) =>
              value.id === t.id &&
              value.revision === t.revision &&
              value.signature === t.signature,
          ),
      )
    )
      this.update({ sourceChanged: true });
  }
  observeSources(data: Workspace) {
    const deck = this.state.preview?.deck;
    if (!deck) return;
    const sourceChanged =
      deck.sources.some((source) =>
        source.kind === "media"
          ? !data.mediaAssets?.some(
              (a) =>
                a.id === source.id && a.original.digest === source.checksum,
            )
          : source.kind === "scripture"
            ? !data.translations?.some(
                (t) => t.id === source.id && t.contentHash === source.checksum,
              )
            : !data.songs.some(
                (s) => s.id === source.id && s.revision === source.revision,
              ),
      ) ||
      !!(
        deck.schedule &&
        !data.schedules.some(
          (s) =>
            s.id === deck.schedule!.id &&
            s.revision === deck.schedule!.revision,
        )
      );
    if (sourceChanged !== this.state.sourceChanged)
      this.update({ sourceChanged });
  }
  select(index: number) {
    const preview = this.state.preview;
    if (
      preview &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < preview.deck.frames.length
    )
      this.update({ preview: { ...preview, index } });
  }
  async apply(text: string, style: Style, reset = false) {
    this.authorize();
    const preview = this.state.preview;
    if (!preview) throw new Error("Pilih materi Preview.");
    const captured = clone(preview);
    const selectedFrame = captured.deck.frames[captured.index];
    if (captured.deck.render) return this.applyAdvanced(captured, text, reset);
    if (selectedFrame.kind === "media")
      throw new Error("Media baca-saja; siapkan ulang untuk perubahan.");
    if (selectedFrame.kind === "scripture") {
      if (text !== frameText(captured.deck, captured.index))
        throw new Error(
          "Teks Scripture bersifat baca-saja; referensi dan atribusi tidak boleh diubah.",
        );
      if (!validStyle(style)) throw new Error("Gaya tidak valid.");
      captured.deck.style = clone(style);
      if (
        captured.deck.frames.some(
          (_, index) => !fitsFrame(captured.deck, index, this.measure),
        )
      )
        throw new Error(
          "Ayat tidak muat. Siapkan ulang dengan ukuran lebih kecil.",
        );
      this.authorize();
      this.update({ preview: captured });
      return;
    }

    if (
      !validStyle(style) ||
      !fits(text, style, this.measure) ||
      captured.deck.frames.some(
        (_, index) =>
          !fitsFrame({ ...captured.deck, style }, index, this.measure),
      ) ||
      captured.deck.overrides.some((o) => !fits(o.text, style, this.measure))
    )
      throw new Error(
        "Teks tidak muat. Kurangi teks/ukuran font atau siapkan ulang dari sumber.",
      );
    const frame = captured.deck.frames[captured.index];
    const overrideId = `phase3:${frame.id}`;
    const stored = await this.repo.saveOverride(
      {
        id: overrideId,
        format: 1,
        frameId: frame.id,
        text,
        style: clone(style),
        sourceSignature: overrideSignature(captured.deck, frame),
      },
      this.overrideRevisions.get(overrideId) ?? 0,
    );
    this.overrideRevisions.set(overrideId, stored.revision);
    this.authorize();
    if (
      this.state.preview?.deck.id !== captured.deck.id ||
      this.state.preview.index !== captured.index
    )
      throw new Error("Preview berubah saat Apply; pilih ulang materi.");
    captured.deck.overrides = captured.deck.overrides.filter(
      (o) => o.frameId !== frame.id,
    );
    if (!reset || text !== captured.deck.pages[frame.page].text)
      captured.deck.overrides.push({ frameId: frame.id, text });
    captured.deck.style = clone(style);
    this.update({ preview: captured });
  }
  private async applyAdvanced(captured: Preview, text: string, reset: boolean) {
    const frame = captured.deck.frames[captured.index];
    if (frame.kind === "media") throw new Error("Media baca-saja");
    if (frame.kind === "scripture") {
      if (text !== frameText(captured.deck, captured.index))
        throw new Error("Teks Scripture baca-saja");
      return;
    }
    if (!text.trim() || text.length > 30000)
      throw new Error("Teks tidak valid");
    const id = `phase6:${frame.id}`;
    captured.deck.overrides = captured.deck.overrides.filter(
      (o) => o.frameId !== frame.id,
    );
    if (!reset || text !== captured.deck.pages[frame.page].text)
      captured.deck.overrides.push({ frameId: frame.id, text });
    if (!fitsAppearance(captured.deck, captured.index, this.measure))
      throw new Error("Teks tidak muat; siapkan ulang dari sumber.");
    const stored = await this.repo.saveOverride(
      {
        id,
        format: 2,
        frameId: frame.id,
        text,
        style: clone(captured.deck.style),
        sourceSignature: overrideSignature(captured.deck, frame),
      },
      this.overrideRevisions.get(id) ?? 0,
    );
    this.authorize();
    this.overrideRevisions.set(id, stored.revision);
    if (
      this.state.preview?.deck.id !== captured.deck.id ||
      this.state.preview.index !== captured.index
    )
      throw new Error("Preview berubah saat Apply");
    this.update({ preview: captured });
  }
  /**
   * Send the Preview slide to LIVE. `keepMode` keeps Black/Clear Text as it
   * is (used when LIVE follows Preview automatically).
   */
  goLive(options: { keepMode?: boolean } = {}) {
    this.authorize();
    if (this.state.recovery)
      throw new Error("Pilih Resume atau Discard checkpoint terlebih dahulu.");
    if (!this.state.recoveryLoaded)
      throw new Error("Pemeriksaan pemulihan belum selesai.");
    if (!this.state.preview || this.state.preparing)
      throw new Error("Preview belum siap.");
    const preview = clone(this.state.preview);
    const mode = options.keepMode
      ? (this.state.live?.mode ?? "normal")
      : "normal";
    if (mediaRefs(preview.deck).length) return this.mediaGoLive(preview, mode);
    this.intent++;
    this.transition(
      this.withPausedVideo({
        deck: preview.deck,
        index: preview.index,
        mode,
        ...this.keptAlert(),
      }),
    );
  }
  /** A running alert stays on screen when the operator goes live with new material. */
  private keptAlert() {
    const alert = this.state.live?.alert;
    return alert ? { alert: { text: alert.text } } : {};
  }
  private async mediaGoLive(preview: Preview, mode: Live["mode"] = "normal") {
    const intent = ++this.intent;
    this.authorize();
    await this.repo
      .mediaRepository()
      .pin(
        preview.deck,
        `live:${this.windows.pairing.session}:${preview.deck.id}`,
      );
    this.authorize();
    if (intent !== this.intent) return;
    this.transition(
      this.withPausedVideo({
        deck: preview.deck,
        index: preview.index,
        mode,
        ...this.keptAlert(),
      }),
    );
  }
  private withPausedVideo(live: Live): Live {
    const theme = themeFor(live.deck, live.index),
      background = theme?.spec.background;
    if (background?.kind === "video") {
      const frameId = JSON.stringify([
        background.asset.id,
        background.asset.digest,
        background.fit,
        background.x,
        background.y,
        background.dim,
      ]);
      const previous = this.state.live?.backgroundPlayback;
      live = {
        ...live,
        backgroundPlayback:
          previous?.frameId === frameId
            ? clone(previous)
            : {
                frameId,
                revision: ++this.playbackRevision,
                paused: true,
                position: 0,
                loop: true,
                muted: true,
                volume: 0,
                target: this.windows.documentNonce() || undefined,
              },
      };
    } else {
      const { backgroundPlayback: _, ...rest } = live;
      live = rest;
    }
    const frame = live.deck.frames[live.index];
    if (frame.kind !== "media" || frame.media.kind !== "video") {
      const { playback: _, ...rest } = live;
      return rest;
    }
    return {
      ...live,
      playback: {
        frameId: frame.id,
        revision: ++this.playbackRevision,
        paused: true,
        position: 0,
        loop: live.deck.videoDefaults?.loop ?? false,
        muted: live.deck.videoDefaults?.muted ?? true,
        volume: live.deck.videoDefaults?.volume ?? 0.8,
        target: this.windows.documentNonce() || undefined,
      },
    };
  }
  video(
    patch: Partial<{
      paused: boolean;
      loop: boolean;
      muted: boolean;
      volume: number;
    }>,
  ) {
    this.authorize();
    this.intent++;
    const live = this.state.live;
    if (!live?.playback) throw new Error("LIVE bukan video");
    if (live.mode === "black" && patch.paused === false)
      throw new Error("Restore sebelum Play");
    const observed = this.state.playbackFeedback;
    const position =
      observed?.frameId === live.playback.frameId
        ? observed.position
        : live.playback.position;
    this.transition({
      ...live,
      playback: {
        ...live.playback,
        ...patch,
        position,
        revision: ++this.playbackRevision,
        target: this.windows.documentNonce() || undefined,
      },
    });
  }
  background(paused: boolean) {
    this.authorize();
    this.intent++;
    const live = this.state.live;
    if (!live?.backgroundPlayback)
      throw new Error("Tidak ada video background LIVE");
    if (!paused && live.mode === "black")
      throw new Error("Restore sebelum memulai background");
    this.transition({
      ...live,
      backgroundPlayback: {
        ...live.backgroundPlayback,
        paused,
        revision: ++this.playbackRevision,
        target: this.windows.documentNonce() || undefined,
        muted: true,
        volume: 0,
      },
    });
  }
  private onPlayback(value: PlaybackFeedback) {
    const live = this.state.live;
    if (
      live?.backgroundPlayback &&
      value.frameId === live.backgroundPlayback.frameId &&
      value.revision === live.backgroundPlayback.revision
    ) {
      try {
        this.authorize();
      } catch {
        return;
      }
      this.update({ backgroundFeedback: value });
      if (Date.now() - this.lastVideoCheckpoint > 5000) {
        this.lastVideoCheckpoint = Date.now();
        this.queueCheckpoint(
          {
            ...live,
            backgroundPlayback: {
              ...live.backgroundPlayback,
              position: value.position,
              paused: true,
              muted: true,
              volume: 0,
            },
          },
          this.state.sequence,
        );
      }
      return;
    }

    if (
      !live?.playback ||
      value.frameId !== live.playback.frameId ||
      value.revision !== live.playback.revision
    )
      return;
    try {
      this.authorize();
    } catch {
      return;
    }
    this.update({ playbackFeedback: value });
    if (Date.now() - this.lastVideoCheckpoint > 5000) {
      this.lastVideoCheckpoint = Date.now();
      this.queueCheckpoint(
        {
          ...live,
          playback: {
            ...live.playback,
            position: value.position,
            paused: true,
          },
        },
        this.state.sequence,
      );
    }
  }
  private transition(live: Live) {
    this.sessionEnded = false;
    this.authorize();
    if (!validLive(live)) throw new Error("LIVE snapshot tidak valid.");
    const sequence = this.state.sequence + 1;
    this.update({ live: clone(live), sequence });
    this.windows.publish(live, sequence);
    this.queueCheckpoint(live, sequence);
  }
  navigate(delta: number) {
    this.authorize();
    this.intent++;
    const live = this.state.live;
    if (!live) return;
    const index = Math.max(
      0,
      Math.min(live.deck.frames.length - 1, live.index + delta),
    );
    if (index !== live.index)
      this.transition(this.withPausedVideo({ ...live, index }));
  }
  mode(mode: Live["mode"]) {
    this.authorize();
    const live = this.state.live;
    this.intent++;
    const hides = mode === "black";
    if (live) {
      this.transition({
        ...live,
        mode,
        ...(live.backgroundPlayback && hides
          ? {
              backgroundPlayback: {
                ...live.backgroundPlayback,
                paused: true,
                revision: ++this.playbackRevision,
              },
            }
          : {}),
        ...(live.playback && hides
          ? {
              playback: {
                ...live.playback,
                paused: true,
                position:
                  this.state.playbackFeedback?.frameId === live.playback.frameId
                    ? this.state.playbackFeedback.position
                    : live.playback.position,
                revision: ++this.playbackRevision,
              },
            }
          : {}),
      });
    }
  }
  /** Shows (or with null/empty text, stops) the scrolling alert. */
  alert(text: string | null) {
    this.authorize();
    const live = this.state.live;
    if (!live)
      throw new Error("Go Live terlebih dahulu untuk menampilkan alert.");
    const value = text?.trim() ?? "";
    if (value.length > ALERT_MAX)
      throw new Error(`Alert maksimal ${ALERT_MAX} karakter.`);
    const { alert: _previousAlert, ...rest } = live;
    this.transition(value ? { ...rest, alert: { text: value } } : rest);
  }
  toggle(mode: "black" | "clearText") {
    this.authorize();
    this.mode(this.state.live?.mode === mode ? "normal" : mode);
  }
  private queueCheckpoint(live: Live | null, sequence: number) {
    const captured = clone(live),
      ticket = this.gate.ticket();
    this.update({ checkpoint: `Checkpoint tertunda · LIVE ${sequence}` });
    this.writes = this.writes.then(async () => {
      try {
        this.gate.assert(ticket);
        if (!this.state.recoveryLoaded || this.recoveryBroken)
          throw new Error("Checkpoint belum tersedia/valid.");
        const saved = await this.repo.checkpoint(
          captured,
          this.windows.pairing.session,
          sequence,
          this.expectedRevision,
        );
        this.expectedRevision = saved.revision;
        if (sequence === this.state.sequence)
          this.update({
            checkpoint: captured
              ? `Checkpoint tersimpan · LIVE ${sequence}`
              : "Checkpoint dibuang",
          });
      } catch (e) {
        this.update({
          checkpoint: `Checkpoint gagal: ${(e as Error).message}. LIVE tetap aktif.`,
        });
      }
    });
    return this.writes;
  }
  async resume() {
    this.authorize();
    if (this.state.recovering) throw new Error("Pemulihan sedang diproses.");
    const recovery = this.state.recovery;
    if (!recovery?.live) throw new Error("Tidak ada checkpoint valid.");
    const intent = ++this.intent;
    const recovered = clone(recovery.live);
    if (recovered.backgroundPlayback) {
      recovered.backgroundPlayback = {
        ...recovered.backgroundPlayback,
        paused: true,
        muted: true,
        volume: 0,
        revision: ++this.playbackRevision,
        target: this.windows.documentNonce() || undefined,
      };
    }
    if (recovered.playback) {
      recovered.playback.paused = true;
      recovered.playback.revision = ++this.playbackRevision;
      recovered.playback.target = this.windows.documentNonce() || undefined;
    }
    if (mediaRefs(recovered.deck).length)
      await this.repo
        .mediaRepository()
        .pin(
          recovered.deck,
          `live:${this.windows.pairing.session}:${recovered.deck.id}`,
        );
    this.authorize();
    if (intent !== this.intent) return;
    this.transition(recovered);
    this.update({ recovery: null });
  }
  async discard() {
    this.authorize();
    if (this.state.recovering) throw new Error("Pemulihan sedang diproses.");
    if (!this.state.recovery)
      throw new Error("Tidak ada checkpoint untuk dibuang.");
    this.update({ recovering: true });
    try {
      await this.queueCheckpoint(null, this.state.sequence);
      const stored = await this.repo.loadCheckpoint();
      if (stored?.live === null) this.update({ recovery: null });
    } finally {
      this.update({ recovering: false });
    }
  }
  retryCheckpoint() {
    this.authorize();
    if (this.state.live)
      this.queueCheckpoint(this.state.live, this.state.sequence);
  }
  text() {
    return this.state.preview
      ? frameText(this.state.preview.deck, this.state.preview.index)
      : "";
  }
  settled() {
    return this.writes;
  }
}
