import { validMessage, matches, type Message, type Pairing } from "./protocol";
export class Transport {
  private channel: BroadcastChannel | null = null;
  private listener = (event: MessageEvent) => {
    if (event.origin !== location.origin || event.source !== this.peer())
      return;
    this.receive(event.data);
  };
  constructor(
    private pairing: Pairing,
    private peer: () => Window | null,
    private onMessage: (message: Message) => void,
  ) {
    try {
      this.channel = new BroadcastChannel(`sagi-projector:${pairing.pair}`);
      this.channel.onmessage = (e) => this.receive(e.data);
    } catch {
      /* same-origin postMessage fallback */
    }
    window.addEventListener("message", this.listener);
  }
  private receive(data: unknown) {
    if (validMessage(data) && matches(data, this.pairing)) this.onMessage(data);
  }
  send(message: Message) {
    try {
      this.channel?.postMessage(message);
    } catch {
      /* fallback */
    }
    try {
      this.peer()?.postMessage(message, location.origin);
    } catch {
      /* connection health reports failures */
    }
  }
  close() {
    this.channel?.close();
    window.removeEventListener("message", this.listener);
  }
}
