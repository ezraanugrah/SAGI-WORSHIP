import { preflight } from "./preflight";
import { loadLyricFonts } from "../presentation/fonts";
import { fitsFrame } from "../presentation/scriptureAdapter";
import { useCallback, useEffect, useRef, useState } from "react";
import { SlideCanvas } from "../components/SlideCanvas";
import { Receiver, type Pairing, type Message } from "../presentation/protocol";
import { Transport } from "../presentation/transport";
import { clone, uid, type Live } from "../presentation/models";
import { browserMeasure } from "../presentation/layout";
import { useScreenWakeLock } from "../hooks/useScreenWakeLock";
import { commandForKey, presentationKey } from "../presentation/shortcuts";
export default function ProjectorApp() {
  const [pairing] = useState<Pairing>(() => {
    const query = new URLSearchParams(location.hash.split("?")[1]);
    return {
      session: query.get("session") ?? "",
      epoch: query.get("epoch") ?? "",
      pair: query.get("pair") ?? "",
    };
  });
  const [controlsVisible, setControlsVisible] = useState(false),
    hideControls = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(hideControls.current), []);
  const [receiver] = useState(() => new Receiver(pairing, uid())),
    [current, setCurrent] = useState<{ live: Live | null; sequence: number }>({
      live: null,
      sequence: -1,
    }),
    [hint, setHint] = useState(""),
    pendingSequence = useRef(-1),
    loadGeneration = useRef(0),
    transport = useRef<Transport | null>(null),
    rendered = useRef<{ live: Live | null; sequence: number }>({
      live: null,
      sequence: -1,
    });
  const send = useCallback(
    (type: Message["type"], error?: string) =>
      transport.current?.send({
        ...pairing,
        v: 4,
        nonce: receiver.nonce,
        seq: Math.max(0, rendered.current.sequence),
        type,
        fullscreen: !!document.fullscreenElement,
        ...(error ? { error } : {}),
      }),
    [pairing, receiver],
  );
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else throw new Error("Fullscreen tidak didukung.");
      setHint("");
      // Release focus so the button fades out instead of staying on screen.
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      setHint(
        "Fullscreen ditolak browser. Klik tombol ini langsung atau gunakan fullscreen browser.",
      );
    }
    send(rendered.current.sequence < 0 ? "HELLO" : "PONG");
  }
  useEffect(() => {
    let active = true,
      ready = false;
    // The bundled lyric fonts must be loaded before slides are measured.
    void loadLyricFonts()
      .then(() => document.fonts.ready)
      .then(() => {
        ready = true;
        if (active) send("HELLO");
      });
    const endpoint = new Transport(
      pairing,
      () => window.opener as Window | null,
      (m) => {
        if (m.v !== 4) {
          send(
            "ERROR",
            "Versi protokol tidak kompatibel. Muat ulang kedua jendela.",
          );
          return;
        }
        if (m.nonce !== receiver.nonce) return;
        if (m.type === "STATE") {
          if (!ready) {
            send("RESYNC_REQUEST");
            return;
          }
          if (m.seq < Math.max(receiver.sequence, pendingSequence.current))
            return;
          if (m.seq === receiver.sequence) {
            if (rendered.current.sequence === m.seq) send("ACK");
            return;
          }
          if (m.seq === pendingSequence.current) return;
          const generation = ++loadGeneration.current;
          pendingSequence.current = m.seq;
          void (async () => {
            try {
              if (
                m.live &&
                m.live.mode === "normal" &&
                !fitsFrame(m.live.deck, m.live.index, browserMeasure)
              )
                throw new Error("Teks tidak muat pada renderer.");
              await preflight(m.live ?? null);
              if (!active || generation !== loadGeneration.current) return;
              const result = receiver.accept(m);
              if (result === "applied") {
                if (!receiver.live) {
                  rendered.current = {
                    live: null,
                    sequence: receiver.sequence,
                  };
                  setCurrent(clone(rendered.current));
                  send("ACK");
                } else
                  setCurrent({
                    live: clone(receiver.live),
                    sequence: receiver.sequence,
                  });
              }
            } catch (e) {
              if (active && generation === loadGeneration.current) {
                pendingSequence.current = receiver.sequence;
                send("ERROR", (e as Error).message);
              }
            }
          })();
        } else if (m.type === "PING")
          send(rendered.current.sequence < 0 ? "HELLO" : "PONG");
        else if (m.type === "FULLSCREEN_REQUEST") {
          void fullscreen();
        }
      },
    );
    transport.current = endpoint;
    const timer = setInterval(() => {
        if (ready && receiver.sequence < 0) send("HELLO");
      }, 1000),
      changed = () => send(rendered.current.sequence < 0 ? "HELLO" : "PONG");
    window.addEventListener("pageshow", changed);
    document.addEventListener("fullscreenchange", changed);
    return () => {
      active = false;
      loadGeneration.current++;
      clearInterval(timer);
      endpoint.close();
      transport.current = null;
      window.removeEventListener("pageshow", changed);
      document.removeEventListener("fullscreenchange", changed);
    };
  }, [pairing, receiver, send]);
  // Keep the audience display awake for the whole LIVE session, including Black.
  useScreenWakeLock(current.sequence >= 0 && current.live !== null);
  // When this window has focus (e.g. after clicking Fullscreen here), forward
  // LIVE shortcuts to the operator. The operator validates and applies them;
  // this window still never changes the presentation itself.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = presentationKey(event);
      const command = key ? commandForKey(key) : null;
      if (!command) return;
      event.preventDefault();
      transport.current?.send({
        ...pairing,
        v: 4,
        nonce: receiver.nonce,
        seq: Math.max(0, rendered.current.sequence),
        type: "COMMAND",
        command,
        commandId: uid(),
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pairing, receiver]);
  const onRendered = useCallback(
    (error?: string) => {
      if (error) {
        pendingSequence.current = rendered.current.sequence;
        loadGeneration.current++;
        receiver.live = clone(rendered.current.live);
        receiver.sequence = rendered.current.sequence;
        setCurrent(clone(rendered.current));
        send("ERROR", error);
        return;
      }
      rendered.current = clone(current);
      send("ACK");
    },
    [current, receiver, send],
  );
  return (
    <main
      className={`projector-shell ${controlsVisible ? "controls-visible" : ""} ${current.sequence < 0 ? "waiting" : ""}`}
      onPointerMove={() => {
        setControlsVisible(true);
        clearTimeout(hideControls.current);
        hideControls.current = setTimeout(
          () => setControlsVisible(false),
          1500,
        );
      }}
      data-testid="projector"
      data-sequence={current.sequence}
    >
      <SlideCanvas
        deck={current.live?.deck ?? null}
        index={current.live?.index ?? 0}
        mode={current.live?.mode ?? "black"}
        onRendered={onRendered}
        role="audience"
        playback={current.live?.playback}
        nonce={receiver.nonce}
        backgroundPlayback={current.live?.backgroundPlayback}
        alert={current.live?.alert?.text}
        onFeedback={(feedback) =>
          transport.current?.send({
            ...pairing,
            v: 4,
            nonce: receiver.nonce,
            seq: Math.max(0, rendered.current.sequence),
            type: "PLAYBACK",
            feedback,
          })
        }
      />
      <div
        className={`projector-actions ${current.sequence < 0 ? "waiting" : ""}`}
      >
        <button
          onClick={() => void fullscreen()}
          aria-label="Fullscreen proyektor"
        >
          Fullscreen
        </button>
        {hint && <span role="status">{hint}</span>}
      </div>
    </main>
  );
}
