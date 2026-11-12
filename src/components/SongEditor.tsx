import { t } from "../i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, X, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { SongAutosave, type SaveState } from "../data/autosave";
import { Repository } from "../data/repository";
import {
  emptySong,
  id,
  move,
  nextSectionChoice,
  sectionChoices,
  type Song,
  type SongDraft,
  type SongInput,
  type SongSection,
} from "../domain/models";
/** Name shown for a part: its label, or its type when the label is blank. */
const sectionName = (s: SongSection) => s.label.trim() || s.type;
export function SongEditor({
  songId,
  song,
  draft,
  repo,
  editable,
  onClose,
  onSaved,
}: {
  songId: string;
  song?: Song;
  draft?: SongDraft;
  repo: Repository;
  editable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<SongInput>(() =>
    structuredClone(draft?.value ?? song ?? emptySong(songId)),
  );
  const [status, setStatus] = useState<SaveState>({
    message: draft
      ? "Draft dipulihkan. Lengkapi lalu pilih Simpan sekarang."
      : song
        ? "Tersimpan lokal"
        : "Lagu baru · isi judul dan lirik untuk autosave.",
    error: false,
    pending: false,
  });
  const [announcement, setAnnouncement] = useState("");
  const mounted = useRef(true),
    drag = useRef<number | null>(null);
  const orderList = useRef<HTMLOListElement>(null),
    movedFocus = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (movedFocus.current !== null) {
      const index = movedFocus.current;
      const row = orderList.current?.children[index];
      row
        ?.querySelectorAll<HTMLButtonElement>("button")
        [index > 0 ? 0 : 1]?.focus();
      movedFocus.current = null;
    }
  }, [value.order]);
  const [saver] = useState(
    () =>
      new SongAutosave(
        repo,
        songId,
        value,
        draft?.baseRevision ?? song?.revision ?? 0,
        draft?.sequence ?? 0,
        (s) => {
          if (mounted.current) setStatus(s);
        },
        onSaved,
      ),
  );
  useEffect(() => {
    mounted.current = true;
    const unload = (event: BeforeUnloadEvent) => {
      if (saver.unsaved) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      mounted.current = false;
      void saver.flush();
      window.removeEventListener("beforeunload", unload);
    };
  }, [saver]);
  function update(next: SongInput) {
    setValue(next);
    saver.edit(next);
  }
  function reorder(from: number, to: number, keepFocus = false) {
    const order = move(value.order, from, to);
    if (order === value.order) return;
    if (keepFocus) movedFocus.current = to;
    update({ ...value, order });
    setAnnouncement(t("Bagian dipindahkan ke posisi {n}.", { n: to + 1 }));
  }
  async function close() {
    await saver.flush();
    if (saver.unsaved) return;
    saver.stop();
    onClose();
  }
  /** "Simpan sekarang": save at once; a complete song closes the editor. */
  async function saveNow() {
    // Nothing new to save: an already saved song just closes (no empty
    // revision); a restored draft or failed save is tried again.
    if (!saver.unsaved && (!saver.savedSong || saver.state.error))
      saver.edit(value);
    await saver.flush();
    if (!saver.unsaved && saver.savedSong && !saver.state.error) {
      saver.stop();
      onClose();
    }
  }
  return (
    <section
      className="song-editor panel"
      aria-label="Editor lagu"
      data-live-shortcuts="off"
    >
      <div className="editor-title">
        <div>
          <span className="tiny-label">SONG EDITOR · AUTOSAVE</span>
          <h2>{value.title || t("Lagu baru")}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Tutup editor"
          onClick={() => void close()}
        >
          <X size={18} />
        </button>
      </div>
      <div className="editor-body">
        <fieldset disabled={!editable}>
          <div className="song-fields">
            <label>
              {t("Judul lagu")}
              <input
                autoFocus
                maxLength={200}
                value={value.title}
                onChange={(e) => update({ ...value, title: e.target.value })}
              />
            </label>
            <label>
              {t("Penyanyi / pencipta")}
              <input
                maxLength={200}
                value={value.author}
                onChange={(e) => update({ ...value, author: e.target.value })}
              />
            </label>
            {/* Only title and author are edited here. Category and language
                stay in the data (backups, sync) unchanged. */}
          </div>
          <div className="section-heading">
            <h3>{t("Bagian lagu")}</h3>
            <button
              className="button secondary"
              disabled={value.sections.length >= 200}
              onClick={() => {
                const sectionId = id(),
                  choice = nextSectionChoice(value.sections);
                update({
                  ...value,
                  sections: [
                    ...value.sections,
                    {
                      id: sectionId,
                      songId,
                      type: choice.type,
                      label: choice.label,
                      text: "",
                    },
                  ],
                  order: [...value.order, sectionId],
                });
              }}
            >
              <Plus size={14} />
              {t("Tambah bagian")}
            </button>
          </div>
          {value.sections.map((section, index) => (
            <div className="song-section" key={section.id}>
              <div className="section-fields">
                <label>
                  {t("Jenis bagian {n}", { n: index + 1 })}
                  <select
                    aria-label={`Jenis bagian ${index + 1}`}
                    value={sectionName(section)}
                    onChange={(e) => {
                      const choice = sectionChoices.find(
                        (c) => c.label === e.target.value,
                      );
                      if (!choice) return;
                      update({
                        ...value,
                        sections: value.sections.map((s) =>
                          s.id === section.id
                            ? { ...s, type: choice.type, label: choice.label }
                            : s,
                        ),
                      });
                    }}
                  >
                    {/* A part saved earlier under another name (e.g.
                        "Ending", "Verse 3") stays as it is until changed. */}
                    {!sectionChoices.some(
                      (c) => c.label === sectionName(section),
                    ) && <option>{sectionName(section)}</option>}
                    {sectionChoices.map((c) => (
                      <option key={c.label}>{c.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="icon-button danger"
                  aria-label={`Hapus bagian ${index + 1}`}
                  disabled={
                    value.sections.length === 1 ||
                    value.order.every((key) => key === section.id)
                  }
                  onClick={() =>
                    update({
                      ...value,
                      sections: value.sections.filter(
                        (s) => s.id !== section.id,
                      ),
                      order: value.order.filter((key) => key !== section.id),
                    })
                  }
                >
                  <X size={16} />
                </button>
              </div>
              <label>
                {t("Lirik bagian {n}", { n: index + 1 })}
                <textarea
                  aria-label={`Lirik bagian ${index + 1}`}
                  rows={4}
                  maxLength={30000}
                  value={section.text}
                  onChange={(e) =>
                    update({
                      ...value,
                      sections: value.sections.map((s) =>
                        s.id === section.id
                          ? { ...s, text: e.target.value }
                          : s,
                      ),
                    })
                  }
                />
              </label>
            </div>
          ))}
          <div className="section-heading">
            <div>
              <h3>{t("Urutan presentasi")}</h3>
              <p>
                {t("Seret atau gunakan tombol naik/turun untuk mengurutkan.")}
              </p>
            </div>
          </div>
          <ol
            ref={orderList}
            className="section-order"
            aria-label="Urutan bagian"
          >
            {value.order.map((sectionId, index) => (
              <li
                key={`${sectionId}-${index}`}
                draggable={editable}
                onDragStart={(e) => {
                  drag.current = index;
                  e.dataTransfer.setData("text/plain", String(index));
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag.current !== null) reorder(drag.current, index);
                  drag.current = null;
                }}
                onDragEnd={() => {
                  drag.current = null;
                }}
                data-testid="section-order-item"
              >
                <GripVertical size={15} />
                <span>
                  {index + 1}.{" "}
                  {(() => {
                    const s = value.sections.find((x) => x.id === sectionId);
                    return s ? sectionName(s) : "";
                  })()}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Naikkan bagian urutan ${index + 1}`}
                  disabled={index === 0}
                  onClick={() => reorder(index, index - 1, true)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Turunkan bagian urutan ${index + 1}`}
                  disabled={index === value.order.length - 1}
                  onClick={() => reorder(index, index + 1, true)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Hapus urutan ${index + 1}`}
                  disabled={value.order.length === 1}
                  onClick={() =>
                    update({
                      ...value,
                      order: value.order.filter((_, i) => i !== index),
                    })
                  }
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ol>
        </fieldset>
        <p
          className={status.error ? "save-message error-text" : "save-message"}
          role="status"
        >
          {t(status.message)}
        </p>
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
        <div className="editor-actions">
          <button
            className="button secondary"
            disabled={!editable || status.pending}
            onClick={() => void saveNow()}
          >
            {status.error ? t("Coba simpan lagi") : t("Simpan sekarang")}
          </button>
          {status.error && (
            <button
              className="button secondary"
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      "Tutup tanpa menyimpan perubahan terakhir? Draft yang sudah tersimpan tetap dipertahankan.",
                    ),
                  )
                ) {
                  saver.stop();
                  onClose();
                }
              }}
            >
              {t("Tutup tanpa menyimpan")}
            </button>
          )}
        </div>
        <p className="field-help">
          {t(
            "Draft yang belum lengkap dipisahkan dari lagu tersimpan. Perubahan ini tidak mengirim materi ke LIVE.",
          )}
        </p>
      </div>
    </section>
  );
}
