import { WriterGate } from "./data/writer";
import { emptySong } from "./domain/models";
export function writerFixture() {
  const gate = new WriterGate();
  const locks = {
    request: (
      _name: string,
      _options: unknown,
      callback: (lock: Lock) => Promise<void>,
    ) => callback({ name: "sagi-workspace-writer", mode: "exclusive" } as Lock),
  } as LockManager;
  const stop = gate.start(locks);
  return { gate, stop };
}
export function songFixture(
  songId: string,
  title = "Original test composition",
) {
  const input = emptySong(songId);
  input.title = title;
  input.sections[0].text = "Test line composed only for software verification.";
  return input;
}
