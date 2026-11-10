import { useLayoutEffect, useRef, useState } from "react";
import {
  ListMusic,
  Plus,
  Pencil,
  Copy,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { move, type Schedule, type Workspace } from "../domain/models";
import { SONG_DRAG_TYPE } from "./SongsLibrary";
export function SchedulePanel({
  data,
  editable,
  busy,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onActive,
  onRemove,
  onReorder,
  onInspect,
  slideCounts,
  form,
  onForm: setForm,
  onAddSong,
}: {
  data: Workspace;
  slideCounts?: Record<string, number>;
  editable: boolean;
  busy: boolean;
  /** Playlist form state, shared with "+ New playlist" in the SONGS tab. */
  form: "new" | "rename" | null;
  onForm: (form: "new" | "rename" | null) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (s: Schedule, name: string) => Promise<void>;
  onDuplicate: (s: Schedule) => void;
  onDelete: (s: Schedule) => void;
  onActive: (scheduleId: string) => void;
  onRemove: (s: Schedule, itemId: string) => void;
  onReorder: (s: Schedule, ids: string[]) => void;
  onInspect: (songId: string) => void;
  /** A song dragged from the SONGS tab was dropped on this Week. */
  onAddSong: (s: Schedule, songId: string) => void;
}) {
  const schedule = data.schedules.find((s) => s.id === data.activeId),
    [name, setName] = useState(""),
    [announcement, setAnnouncement] = useState(""),
    [dropping, setDropping] = useState(false);
  const acceptsSong = (e: React.DragEvent) =>
    !!schedule &&
    editable &&
    !busy &&
    Array.from(e.dataTransfer.types).includes(SONG_DRAG_TYPE);
  const drag = useRef<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null),
    pendingFocus = useRef<{ itemId: string; direction: number } | null>(null);
  useLayoutEffect(() => {
    if (!busy && pendingFocus.current && schedule) {
      const { itemId, direction } = pendingFocus.current;
      const index = schedule.itemIds.indexOf(itemId),
        row = listRef.current?.children[index];
      const buttons = row?.querySelectorAll<HTMLButtonElement>("button");
      const preferred = buttons?.[direction < 0 ? 1 : 2];
      (preferred && !preferred.disabled
        ? preferred
        : buttons?.[index > 0 ? 1 : 2]
      )?.focus();
      pendingFocus.current = null;
    }
  }, [busy, schedule]);
  function reorder(from: number, to: number, keepFocus = false) {
    if (!schedule) return;
    const ids = move(schedule.itemIds, from, to);
    if (ids === schedule.itemIds) return;
    if (keepFocus)
      pendingFocus.current = {
        itemId: schedule.itemIds[from],
        direction: to - from,
      };
    onReorder(schedule, ids);
    setAnnouncement(`Item dipindahkan ke posisi ${to + 1}.`);
  }
  useLayoutEffect(() => {
    // "+ New playlist" in the SONGS tab opens this form with an empty name.
    if (form === "new") setName("");
  }, [form]);
  return (
    <section
      className="panel schedule"
      aria-label="Jadwal ibadah"
      data-dropping={dropping ? "true" : undefined}
      onDragOver={(e) => {
        if (!acceptsSong(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setDropping(false);
      }}
      onDrop={(e) => {
        setDropping(false);
        const songId = e.dataTransfer.getData(SONG_DRAG_TYPE);
        if (!songId || !schedule || !editable || busy) return;
        e.preventDefault();
        onAddSong(schedule, songId);
        setAnnouncement("Lagu ditambahkan ke Week.");
      }}
    >
      <div className="schedule-body">
        <div className="panel-kicker">Jadwal ibadah</div>
        <label className="sr-only" htmlFor="active-schedule">
          Jadwal aktif
        </label>
        <select
          id="active-schedule"
          className="schedule-select"
          value={data.activeId ?? ""}
          disabled={!editable || busy}
          onChange={(e) => onActive(e.target.value)}
        >
          <option value="" disabled>
            Pilih jadwal…
          </option>
          {data.schedules.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <p className="schedule-meta">
          {schedule
            ? `${schedule.itemIds.length} item · Drag dari SONGS · X = hapus dari Week`
            : "Pilih atau buat playlist di tab SONGS"}
        </p>
        <div className="schedule-actions">
          <button
            className="icon-button"
            aria-label="Buat jadwal"
            disabled={!editable || busy}
            onClick={() => {
              setForm("new");
              setName("");
            }}
          >
            <Plus size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Ganti nama jadwal"
            disabled={!editable || busy || !schedule}
            onClick={() => {
              setForm("rename");
              setName(schedule!.name);
            }}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-button"
            aria-label="Duplikasi jadwal"
            disabled={!editable || busy || !schedule}
            onClick={() => schedule && onDuplicate(schedule)}
          >
            <Copy size={15} />
          </button>
          <button
            className="icon-button danger"
            aria-label="Hapus jadwal"
            disabled={!editable || busy || !schedule}
            onClick={() => schedule && onDelete(schedule)}
          >
            <Trash2 size={15} />
          </button>
        </div>
        {form && (
          <form
            className="schedule-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (form === "new") await onCreate(name);
                else if (schedule) await onRename(schedule, name);
                setForm(null);
              } catch {
                /* Keep the form on storage errors. */
              }
            }}
          >
            <label>
              Nama jadwal
              <input
                autoFocus
                required
                maxLength={200}
                value={name}
                disabled={!editable || busy}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div>
              <button
                className="button primary"
                disabled={!editable || busy || !name.trim()}
              >
                Simpan jadwal
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setForm(null)}
              >
                Batal
              </button>
            </div>
          </form>
        )}
        {!schedule ? (
          <div className="empty-schedule">
            <span className="empty-icon">
              <ListMusic size={28} />
            </span>
            <h3>
              {data.schedules.length
                ? "Pilih jadwal ibadah"
                : "Mulai dari sebuah jadwal"}
            </h3>
            <p>
              Buat playlist lalu tambahkan lagu
              <br />
              dari tab SONGS.
            </p>
          </div>
        ) : (
          <>
            <div className="drop-zone" data-testid="week-drop-zone">
              Tarik lagu dari Music ke sini
            </div>
            {schedule.itemIds.length === 0 ? (
              <p className="schedule-empty">
                Belum ada lagu.
                <br />
                Cari di tab SONGS lalu drag ke sini, atau pilih “Ke jadwal”.
              </p>
            ) : (
              <ol
                ref={listRef}
                className="schedule-items"
                aria-label="Urutan jadwal"
              >
                {schedule.itemIds.map((itemId, index) => {
                  const item = data.items.find((i) => i.id === itemId),
                    song = data.songs.find((s) => s.id === item?.songId);
                  const available =
                    !!song ||
                    (item?.type === "media" &&
                      data.mediaAssets?.some(
                        (a) => a.id === item.media.assetId,
                      )) ||
                    (item?.type === "scripture" &&
                      data.translations?.some(
                        (t) => t.id === item.selection.datasetId,
                      ));
                  const title =
                    item?.type === "media"
                      ? item.label
                      : item?.type === "scripture"
                        ? item.selection.label
                        : song?.title;
                  return (
                    <li
                      key={itemId}
                      data-testid="schedule-item"
                      draggable={editable && !busy}
                      onDragStart={(e) => {
                        drag.current = itemId;
                        e.dataTransfer.setData("text/plain", itemId);
                      }}
                      onDragOver={(e) => {
                        if (editable && !busy) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (editable && !busy && drag.current)
                          reorder(
                            schedule.itemIds.indexOf(drag.current),
                            index,
                          );
                        drag.current = null;
                      }}
                      onDragEnd={() => {
                        drag.current = null;
                      }}
                    >
                      <div className="schedule-item-top">
                        <GripVertical size={14} />
                        <button
                          className="item-inspect"
                          disabled={!available}
                          onClick={() => available && onInspect(itemId)}
                        >
                          <strong>
                            {index + 1}. {title ?? "Sumber tidak tersedia"}
                          </strong>
                          <small>
                            {item?.type === "media"
                              ? "Media"
                              : item?.type === "scripture"
                                ? "Scripture"
                                : "Lagu"}{" "}
                            ·{" "}
                            {item?.type === "media"
                              ? `${item.media.pages.length} halaman/frame`
                              : item?.type === "scripture"
                                ? `${item.selection.verseIds.length} ayat`
                                : song
                                  ? slideCounts?.[itemId] !== undefined
                                    ? `${slideCounts[itemId]} slide (Preview)`
                                    : `${song.order.length} bagian urutan`
                                  : "referensi dipertahankan"}
                          </small>
                        </button>
                      </div>
                      <div className="item-controls">
                        <button
                          className="icon-button"
                          aria-label={`Naikkan item ${index + 1}`}
                          disabled={!editable || busy || index === 0}
                          onClick={() => reorder(index, index - 1, true)}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Turunkan item ${index + 1}`}
                          disabled={
                            !editable ||
                            busy ||
                            index === schedule.itemIds.length - 1
                          }
                          onClick={() => reorder(index, index + 1, true)}
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`Hapus item ${index + 1} dari jadwal`}
                          disabled={!editable || busy}
                          onClick={() => onRemove(schedule, itemId)}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
      </div>
      <div className="panel-note">
        Urutan disimpan otomatis · seret atau gunakan ↑ ↓
      </div>
    </section>
  );
}
