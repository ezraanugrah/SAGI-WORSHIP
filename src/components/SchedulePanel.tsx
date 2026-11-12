import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { revealInPane } from "./revealInPane";
import {
  BookOpen,
  Eraser,
  Image as ImageIcon,
  ListMusic,
  Music,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { move, type Schedule, type Workspace } from "../domain/models";
import { SONG_DRAG_TYPE } from "./SongsLibrary";
import { weekName } from "../domain/weeks";
import { AssetThumbnail, MEDIA_DRAG_TYPE } from "./MediaLibrary";

/** A slide of the schedule item that is open in Preview. */
export type ScheduleSlide = {
  index: number;
  label: string;
  text: string;
  current: boolean;
};

/**
 * Schedule (left column): the active Week with a thumbnail per item. The item
 * open in Preview expands to its slides. Songs and media are added by
 * dragging them here from the library below.
 */
export function SchedulePanel({
  data,
  editable,
  busy,
  onClear,
  onRemove,
  onReorder,
  onInspect,
  slideCounts,
  onAddSong,
  onAddMedia,
  openItemId,
  slides,
  onSlide,
  footer,
}: {
  data: Workspace;
  slideCounts?: Record<string, number>;
  editable: boolean;
  busy: boolean;
  /** Remove every item from the Week (songs stay in Musik). */
  onClear: (s: Schedule) => void;
  onRemove: (s: Schedule, itemId: string) => void;
  onReorder: (s: Schedule, ids: string[]) => void;
  onInspect: (itemId: string) => void;
  /** A song dragged from the SONGS tab was dropped (null: no Week yet). */
  onAddSong: (s: Schedule | null, songId: string) => void;
  /** A media card (JSON MediaSelection) was dropped (null: no Week yet). */
  onAddMedia: (s: Schedule | null, payload: string) => void;
  /** Schedule item currently shown in Preview (expanded). */
  openItemId?: string | null;
  slides?: ScheduleSlide[];
  onSlide?: (index: number) => void;
  /** Shown at the bottom of the panel: what Go Live will show next. */
  footer?: ReactNode;
}) {
  const schedule = data.schedules.find((s) => s.id === data.activeId),
    [announcement, setAnnouncement] = useState(""),
    [dropping, setDropping] = useState(false);
  const dragKind = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types);
    return types.includes(SONG_DRAG_TYPE)
      ? "song"
      : types.includes(MEDIA_DRAG_TYPE)
        ? "media"
        : null;
  };
  // Drops always work: without an active Week the dashboard creates one.
  const accepts = (e: React.DragEvent) =>
    editable && !busy && dragKind(e) !== null;
  const drag = useRef<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null),
    pendingFocus = useRef<{ itemId: string; direction: number } | null>(null);
  useLayoutEffect(() => {
    if (!busy && pendingFocus.current && schedule) {
      const { itemId, direction } = pendingFocus.current;
      const row = listRef.current?.querySelector(
        `[data-item-id="${CSS.escape(itemId)}"]`,
      );
      const up = row?.querySelector<HTMLButtonElement>(".move-up"),
        down = row?.querySelector<HTMLButtonElement>(".move-down");
      const preferred = direction < 0 ? up : down,
        other = direction < 0 ? down : up;
      (preferred && !preferred.disabled ? preferred : other)?.focus();
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
  const openSlide = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    revealInPane(openSlide.current);
  }, [slides]);
  return (
    <section
      className="panel schedule"
      aria-label="Jadwal ibadah"
      aria-busy={busy || undefined}
      data-dropping={dropping ? "true" : undefined}
      onDragOver={(e) => {
        if (!accepts(e)) return;
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
        if (!editable || busy) return;
        const song = e.dataTransfer.getData(SONG_DRAG_TYPE),
          media = e.dataTransfer.getData(MEDIA_DRAG_TYPE);
        if (!song && !media) return;
        e.preventDefault();
        if (song) {
          onAddSong(schedule ?? null, song);
          setAnnouncement("Lagu ditambahkan ke Week.");
        } else {
          onAddMedia(schedule ?? null, media);
          setAnnouncement("Media ditambahkan ke Week.");
        }
      }}
    >
      <div className="pane-head">
        <h2 className="pane-title">
          Jadwal Ibadah
          <span className="pane-subject">
            {` - ${schedule?.name ?? weekName(1)}`}
          </span>
        </h2>
        <div className="pane-actions">
          <button
            className="pane-icon danger"
            aria-label="Kosongkan jadwal"
            title="Kosongkan jadwal (lagu di Musik tidak dihapus)"
            disabled={
              !editable || busy || !schedule || schedule.itemIds.length === 0
            }
            onClick={() => schedule && onClear(schedule)}
          >
            <Eraser size={13} />
          </button>
        </div>
      </div>
      <div className="pane-body schedule-list" data-testid="week-drop-zone">
        <div className="drop-hint" aria-hidden="true">
          Lepas di sini → {schedule?.name ?? weekName(1)}
        </div>
        {!schedule || schedule.itemIds.length === 0 ? (
          <div className="empty-schedule">
            <span className="empty-icon">
              <ListMusic size={24} />
            </span>
            <h3>Tarik lagu dari Musik ke sini</h3>
            <p>Pilih Week 1–4 di tab Songs · media dari tab Media juga bisa</p>
          </div>
        ) : (
          <ol
            ref={listRef}
            className="schedule-items"
            aria-label="Urutan jadwal"
          >
            {schedule.itemIds.map((itemId, index) => {
              const item = data.items.find((i) => i.id === itemId),
                song = data.songs.find((s) => s.id === item?.songId);
              const asset =
                item?.type === "media"
                  ? data.mediaAssets?.find((a) => a.id === item.media.assetId)
                  : undefined;
              const available =
                !!song ||
                !!asset ||
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
              const open = itemId === openItemId;
              const detail =
                item?.type === "media"
                  ? `Media · ${item.media.pages.length} halaman/frame`
                  : item?.type === "scripture"
                    ? `Scripture · ${item.selection.verseIds.length} ayat`
                    : song
                      ? slideCounts?.[itemId] !== undefined
                        ? `Lagu · ${slideCounts[itemId]} slide`
                        : `Lagu · ${song.order.length} bagian`
                      : "Sumber tidak tersedia";
              return (
                <li
                  key={itemId}
                  data-testid="schedule-item"
                  data-item-id={itemId}
                  data-open={open ? "true" : undefined}
                  draggable={editable && !busy}
                  onDragStart={(e) => {
                    drag.current = itemId;
                    e.dataTransfer.setData("text/plain", itemId);
                  }}
                  onDragOver={(e) => {
                    if (editable && !busy && drag.current) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (!drag.current) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (editable && !busy)
                      reorder(schedule.itemIds.indexOf(drag.current), index);
                    drag.current = null;
                  }}
                  onDragEnd={() => {
                    drag.current = null;
                  }}
                >
                  <div className="schedule-item-top">
                    <button
                      className="item-inspect"
                      disabled={!available}
                      aria-current={open ? "true" : undefined}
                      onClick={() => available && onInspect(itemId)}
                    >
                      <span className="sched-thumb" data-kind={item?.type}>
                        {asset ? (
                          <AssetThumbnail refValue={asset.thumbnail} />
                        ) : item?.type === "scripture" ? (
                          <BookOpen size={16} />
                        ) : item?.type === "media" ? (
                          <ImageIcon size={16} />
                        ) : (
                          <Music size={16} />
                        )}
                      </span>
                      <span className="sched-text">
                        <strong>
                          {index + 1}. {title ?? "Sumber tidak tersedia"}
                        </strong>
                        <small>{detail}</small>
                      </span>
                    </button>
                    <div className="item-controls">
                      <button
                        className="pane-icon move-up"
                        aria-label={`Naikkan item ${index + 1}`}
                        disabled={!editable || busy || index === 0}
                        onClick={() => reorder(index, index - 1, true)}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        className="pane-icon move-down"
                        aria-label={`Turunkan item ${index + 1}`}
                        disabled={
                          !editable ||
                          busy ||
                          index === schedule.itemIds.length - 1
                        }
                        onClick={() => reorder(index, index + 1, true)}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        className="pane-icon danger"
                        aria-label={`Hapus item ${index + 1} dari jadwal`}
                        disabled={!editable || busy}
                        onClick={() => onRemove(schedule, itemId)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                  {open && slides && slides.length > 0 && (
                    <ul
                      className="sched-slides"
                      aria-label={`Slide ${title ?? "item"}`}
                    >
                      {slides.map((slide) => (
                        <li key={slide.index}>
                          <button
                            ref={slide.current ? openSlide : undefined}
                            aria-current={slide.current ? "true" : undefined}
                            onClick={() => onSlide?.(slide.index)}
                          >
                            <span
                              className="sched-thumb mini"
                              aria-hidden="true"
                            >
                              {slide.index + 1}
                            </span>
                            <span className="sched-text">
                              <strong>{slide.label}</strong>
                              <small>{slide.text.split("\n")[0]}</small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
      </div>
      <div className="pane-foot">
        {schedule
          ? `${schedule.itemIds.length} item · tarik dari Musik/Media · seret untuk urutkan`
          : "0 item · tarik lagu dari Musik ke sini"}
      </div>
      {footer}
    </section>
  );
}
