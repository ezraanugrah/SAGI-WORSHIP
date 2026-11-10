import { validFeedback, type PlaybackFeedback } from "../media/models";
import {
  object,
  string,
  integer,
  validLive,
  legacyOnly,
  hasMedia,
  type Live,
} from "./models";
import { liveCommands, type LiveCommand } from "./shortcuts";
export type Pairing = { session: string; epoch: string; pair: string };
export type Message = Pairing & {
  v: 1 | 2 | 3 | 4;
  nonce: string;
  seq: number;
  type:
    | "HELLO"
    | "STATE"
    | "ACK"
    | "PING"
    | "PONG"
    | "RESYNC_REQUEST"
    | "FULLSCREEN_REQUEST"
    | "ERROR"
    | "PLAYBACK"
    | "COMMAND";
  live?: Live | null;
  feedback?: PlaybackFeedback;
  fullscreen?: boolean;
  error?: string;
  /** Additive v4 message: a LIVE shortcut pressed in the projector window. */
  command?: LiveCommand;
  /** Unique per key press, so a command delivered twice is applied once. */
  commandId?: string;
};
export function validMessage(value: unknown): value is Message {
  if (
    !object(value) ||
    (value.v !== 1 && value.v !== 2 && value.v !== 3 && value.v !== 4) ||
    !string(value.session, 160) ||
    !string(value.epoch, 160) ||
    !string(value.pair, 160) ||
    !string(value.nonce, 160) ||
    !integer(value.seq, 0, Number.MAX_SAFE_INTEGER) ||
    ![
      "HELLO",
      "STATE",
      "ACK",
      "PING",
      "PONG",
      "RESYNC_REQUEST",
      "FULLSCREEN_REQUEST",
      "ERROR",
      "PLAYBACK",
      "COMMAND",
    ].includes(value.type as string)
  )
    return false;
  if (
    value.type === "COMMAND"
      ? value.v !== 4 ||
        !liveCommands.includes(value.command as LiveCommand) ||
        !string(value.commandId, 160)
      : value.command !== undefined || value.commandId !== undefined
  )
    return false;
  if (value.fullscreen !== undefined && typeof value.fullscreen !== "boolean")
    return false;
  if (value.error !== undefined && !string(value.error, 1000)) return false;
  if (
    value.type === "PLAYBACK" &&
    (![3, 4].includes(value.v as number) || !validFeedback(value.feedback))
  )
    return false;
  return (
    value.type !== "STATE" ||
    value.live === null ||
    (validLive(value.live) &&
      (value.v === 4 ||
        (value.v === 3 && !value.live.deck.render) ||
        (value.v === 2 && !hasMedia(value.live) && !value.live.deck.render) ||
        (value.v === 1 && legacyOnly(value.live) && !value.live.deck.render)))
  );
}
export function matches(message: Message, pairing: Pairing) {
  return (
    message.session === pairing.session &&
    message.epoch === pairing.epoch &&
    message.pair === pairing.pair
  );
}
export class Receiver {
  sequence = -1;
  live: Live | null = null;
  constructor(
    readonly pairing: Pairing,
    readonly nonce: string,
  ) {}
  accept(value: unknown) {
    if (
      !validMessage(value) ||
      !matches(value, this.pairing) ||
      value.nonce !== this.nonce ||
      value.type !== "STATE"
    )
      return "rejected" as const;
    if (value.seq < this.sequence) return "stale" as const;
    if (value.seq === this.sequence) return "duplicate" as const;
    this.sequence = value.seq;
    this.live = structuredClone(value.live!);
    return "applied" as const;
  }
}
