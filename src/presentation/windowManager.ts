import type { PlaybackFeedback } from "../media/models";
import { uid, type Live } from "./models";
import { type Pairing, type Message } from "./protocol";
import { Transport } from "./transport";
import { RecentCommands, type LiveCommand } from "./shortcuts";
export type Connection = {
  status:
    | "Belum dibuka"
    | "Membuka"
    | "Tersinkron"
    | "Menunggu render"
    | "Tidak merespons"
    | "Ditutup"
    | "Error";
  ack: number;
  fullscreen: boolean;
  error: string;
};
export type ScreenChoice = {
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
};
/** Name of the audience window, shared across reloads of the operator page. */
export const PROJECTOR_WINDOW = "SAGI_Projector";
export class WindowManager {
  private output: Window | null = null;
  private transport: Transport | null = null;
  private nonce = "";
  private retired = new Set<string>();
  private commands = new RecentCommands();
  private lastSeen = 0;
  private lastSend = 0;
  private timer?: ReturnType<typeof setInterval>;
  private seq = 0;
  private live: Live | null = null;
  state: Connection = {
    status: "Belum dibuka",
    ack: -1,
    fullscreen: false,
    error: "",
  };
  readonly pairing: Pairing = { session: uid(), epoch: uid(), pair: uid() };
  constructor(
    private authorized: () => void,
    private changed: (state: Connection) => void,
    private feedback?: (value: PlaybackFeedback) => void,
    private command?: (command: LiveCommand) => void,
  ) {}
  private update(patch: Partial<Connection>) {
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  start() {
    this.transport = new Transport(
      this.pairing,
      () => this.output,
      (m) => this.receive(m),
    );
    this.timer = setInterval(() => this.tick(), 1000);
    return () => {
      clearInterval(this.timer);
      this.transport?.close();
      this.transport = null;
    };
  }
  documentNonce() {
    return this.nonce;
  }
  private message(type: Message["type"]): Message {
    return { ...this.pairing, v: 4, nonce: this.nonce, seq: this.seq, type };
  }
  private sendState() {
    try {
      this.authorized();
    } catch {
      return;
    }
    if (!this.nonce) return;
    this.lastSend = Date.now();
    this.transport?.send({ ...this.message("STATE"), live: this.live });
  }
  private receive(m: Message) {
    try {
      this.authorized();
    } catch {
      return;
    }
    if (!this.output || this.output.closed) return;
    if (m.v !== 4) {
      this.update({
        status: "Error",
        error:
          "Versi proyektor tidak kompatibel. Tutup dan muat ulang kedua jendela.",
      });
      return;
    }
    if (m.type === "HELLO") {
      if (this.retired.has(m.nonce)) return;
      if (this.nonce !== m.nonce) {
        if (this.nonce) this.retired.add(this.nonce);
        this.nonce = m.nonce;
        this.update({ ack: -1, status: "Menunggu render", fullscreen: false });
      }
      this.lastSeen = Date.now();
      this.sendState();
      return;
    }
    if (m.nonce !== this.nonce) return;
    if (m.type === "PLAYBACK") {
      if (m.seq === this.seq && m.feedback) this.feedback?.(m.feedback);
      return;
    }
    // Keys pressed while the paired projector window has focus (for example
    // right after the operator clicked Fullscreen there).
    if (m.type === "COMMAND") {
      if (m.command && m.commandId && this.commands.accept(m.commandId))
        this.command?.(m.command);
      return;
    }
    if (m.type === "ACK" || m.type === "PONG") {
      if (m.seq > this.seq) return;
      this.lastSeen = Date.now();
      const ack = Math.max(this.state.ack, Math.min(m.seq, this.seq));
      this.update({
        ack,
        fullscreen: m.fullscreen ?? this.state.fullscreen,
        status:
          ack === this.seq
            ? "Tersinkron"
            : this.state.status === "Error"
              ? "Error"
              : "Menunggu render",
        error: ack === this.seq ? "" : this.state.error,
      });
    } else if (m.type === "RESYNC_REQUEST") this.sendState();
    else if (m.type === "ERROR")
      this.update({ error: m.error ?? "Render gagal.", status: "Error" });
  }
  private tick() {
    if (!this.output) return;
    if (this.output.closed) {
      if (this.state.status !== "Ditutup")
        this.update({ status: "Ditutup", fullscreen: false });
      return;
    }
    try {
      this.authorized();
    } catch {
      return;
    }
    if (!this.nonce && Date.now() - this.lastSeen > 5000)
      this.update({
        status: "Tidak merespons",
        error:
          "Handshake belum berhasil. Coba Reconnect atau buka ulang jendela.",
      });
    if (this.nonce) {
      this.transport?.send(this.message("PING"));
      if (this.state.ack < this.seq && Date.now() - this.lastSend > 2000)
        this.sendState();
      if (Date.now() - this.lastSeen > 5000)
        this.update({ status: "Tidak merespons" });
    }
  }
  publish(live: Live, seq: number) {
    this.authorized();
    this.live = structuredClone(live);
    this.seq = seq;
    if (this.output && !this.output.closed) {
      this.update({ status: "Menunggu render" });
      this.sendState();
    }
  }
  open(screen?: ScreenChoice) {
    this.authorized();
    const url = new URL(location.href);
    url.hash = `/projector?${new URLSearchParams(this.pairing)}`;
    if (this.output && !this.output.closed) {
      this.output.focus();
      this.sendState();
      return;
    }
    const features = screen
      ? `popup,width=${screen.width},height=${screen.height},left=${screen.left},top=${screen.top}`
      : "popup,width=1280,height=720";
    // One fixed window name: after this page reloads, opening again finds
    // the projector window that is still open (on the projector screen) and
    // re-pairs it in place through its address, instead of a new window.
    const output = window.open(url.href, PROJECTOR_WINDOW, features);
    if (!output) {
      this.update({
        status: "Error",
        error: "Popup diblokir. Izinkan popup untuk SAGI lalu coba lagi.",
      });
      return;
    }
    this.output = output;
    this.lastSeen = Date.now();
    this.update({ status: "Membuka", error: "", ack: -1 });
  }
  hasOpenOutput() {
    return !!this.output && !this.output.closed;
  }
  retire() {
    this.authorized();
    this.output?.close();
    if (this.hasOpenOutput())
      throw new Error("Tutup projector window sebelum melanjutkan.");
    clearInterval(this.timer);
    this.transport?.close();
    this.transport = null;
    this.output = null;
    this.live = null;
    this.seq = 0;
    this.nonce = "";
    this.retired.clear();
    Object.assign(this.pairing, { session: uid(), epoch: uid(), pair: uid() });
    this.update({
      status: "Belum dibuka",
      ack: -1,
      fullscreen: false,
      error: "",
    });
    this.start();
  }
  /** Re-sync the projector window, or open it (on `screen`) when closed. */
  reconnect(screen?: ScreenChoice) {
    this.authorized();
    if (!this.output || this.output.closed) {
      this.open(screen);
      return;
    }
    this.update({ status: "Menunggu render", error: "" });
    this.sendState();
  }
  fullscreen() {
    this.authorized();
    if (!this.output || this.output.closed)
      throw new Error("Buka projector window terlebih dahulu.");
    this.output.focus();
    if (this.nonce) this.transport?.send(this.message("FULLSCREEN_REQUEST"));
    this.update({
      error: "Jika browser menolak, klik Fullscreen di jendela proyektor.",
    });
  }
}
export async function listScreens(
  onChange?: (choices: ScreenChoice[]) => void,
  signal?: AbortSignal,
): Promise<ScreenChoice[]> {
  const candidate = window as Window & {
    getScreenDetails?: () => Promise<
      EventTarget & {
        screens: {
          label: string;
          availLeft: number;
          availTop: number;
          availWidth: number;
          availHeight: number;
        }[];
      }
    >;
  };
  if (!candidate.getScreenDetails)
    throw new Error(
      "Pemilihan layar tidak didukung. Pindahkan jendela secara manual.",
    );
  const details = await candidate.getScreenDetails();
  const choices = () =>
    details.screens.map((s, i) => ({
      label: s.label || `Layar ${i + 1}`,
      left: s.availLeft,
      top: s.availTop,
      width: s.availWidth,
      height: s.availHeight,
    }));
  if (onChange && !signal?.aborted)
    details.addEventListener("screenschange", () => onChange(choices()), {
      signal,
    });
  return choices();
}
