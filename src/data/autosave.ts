import {
  missingForSave,
  now,
  validSongInput,
  withSectionLabels,
  type SongInput,
  type SongDraft,
} from "../domain/models";
import { Repository } from "./repository";
export type SaveState = { message: string; error: boolean; pending: boolean };
/** Serializes each editor's jobs. Revision is advanced only after a committed transaction. */
export class SongAutosave {
  private timer?: ReturnType<typeof setTimeout>;
  private queue: Promise<void> = Promise.resolve();
  private sequence: number;
  private handled: number;
  private stopped = false;
  private value: SongInput;
  revision: number;
  /** The last save stored a full song (not only a draft). */
  savedSong = false;
  state: SaveState = {
    message: "Tersimpan lokal",
    error: false,
    pending: false,
  };
  constructor(
    private repo: Repository,
    private songId: string,
    value: SongInput,
    revision: number,
    sequence: number,
    private notify: (state: SaveState) => void,
    private committed: () => void,
  ) {
    this.value = structuredClone(value);
    this.revision = revision;
    this.sequence = sequence;
    this.handled = sequence;
    // An existing song opened without a pending draft is already saved.
    this.savedSong = revision > 0 && sequence === 0;
  }
  private status(message: string, error = false, pending = false) {
    this.state = { message, error, pending };
    this.notify(this.state);
  }
  edit(value: SongInput) {
    if (this.stopped) return;
    this.value = structuredClone(value);
    this.sequence++;
    this.status("Belum tersimpan…", false, true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, 450);
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    this.queue = this.queue
      .then(async () => {
        if (this.stopped || this.handled === this.sequence) return;
        const sequence = this.sequence,
          input = structuredClone(this.value);
        this.status("Menyimpan…", false, true);
        const draft: SongDraft = {
          id: `phase2:draft:song:${this.songId}`,
          kind: "song-draft",
          songId: this.songId,
          baseRevision: this.revision,
          sequence,
          value: input,
          updatedAt: now(),
        };
        await this.repo.saveDraft(draft);
        if (this.stopped) return;
        const song = withSectionLabels(input);
        if (validSongInput(song, this.songId)) {
          const saved =
            this.revision === 0
              ? await this.repo.createSong(this.songId, song, sequence)
              : await this.repo.updateSong(
                  this.songId,
                  song,
                  this.revision,
                  sequence,
                );
          this.revision = saved.revision;
          this.savedSong = true;
          this.committed();
          if (sequence === this.sequence) this.status("Tersimpan lokal");
        } else if (sequence === this.sequence) {
          this.savedSong = false;
          const missing = missingForSave(input);
          this.status(
            missing
              ? `Draft tersimpan. Isi ${missing} untuk menyimpan lagu.`
              : "Draft tersimpan. Isi judul dan lirik semua bagian untuk menyimpan lagu.",
          );
        }
        this.handled = sequence;
        if (sequence !== this.sequence)
          this.status("Belum tersimpan…", false, true);
      })
      .catch((e) => {
        this.status(
          `Gagal menyimpan: ${e instanceof Error ? e.message : String(e)}`,
          true,
        );
      });
    return this.queue;
  }
  /** Call before deletion/discard. Existing transaction cannot recreate a deleted row. */
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
  get unsaved() {
    return this.sequence !== this.handled;
  }
}
