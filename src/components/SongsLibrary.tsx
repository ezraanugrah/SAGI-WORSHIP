import {
  Copy,
  FolderOpen,
  ListMusic,
  Music,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { WEEKS, weekName, weekSchedules } from "../domain/weeks";
import { searchSongs, type Workspace, type Song } from "../domain/models";
/** Drag payload type for a song dragged from Musik into the active Week. */
export const SONG_DRAG_TYPE = "application/x-sagi-song";
/**
 * SONGS tab: "Playlist Jadwal" (Week 1–4) and the "Musik" folder on the left,
 * the music list with search on the right. Songs are dragged into the
 * Jadwal Ibadah.
 */
export function SongsLibrary({
  data,
  query,
  onQuery,
  editable,
  busy,
  onNew,
  onEdit,
  onInspect,
  onDuplicate,
  onDelete,
  onRecover,
  onDiscard,
  onWeek,
}: {
  data: Workspace;
  query: string;
  onQuery: (query: string) => void;
  editable: boolean;
  busy: boolean;
  onNew: () => void;
  onEdit: (song: Song) => void;
  onInspect: (song: Song) => void;
  onDuplicate: (song: Song) => void;
  onDelete: (song: Song) => void;
  onRecover: (songId: string) => void;
  onDiscard: (songId: string, sequence: number) => void;
  /** Open Week 1–4 in the Jadwal Ibadah (created on first use). */
  onWeek: (week: number) => void;
}) {
  const songs = searchSongs(data.songs, query);
  const weeks = weekSchedules(data.schedules);
  return (
    <div className="songs-content">
      <aside className="songs-side">
        <section aria-labelledby="playlists-title">
          <h3 id="playlists-title" className="side-title">
            <FolderOpen size={13} aria-hidden="true" /> Playlist Jadwal
          </h3>
          <ul className="side-list" aria-labelledby="playlists-title">
            {WEEKS.map((n, i) => {
              const week = weeks[i];
              // With no active Week, Week 1 is where drops go.
              const current = week
                ? week.id === data.activeId
                : n === 1 && !data.activeId;
              return (
                <li key={n}>
                  <button
                    className={current ? "active" : ""}
                    aria-current={current ? "true" : undefined}
                    disabled={!editable || busy}
                    onClick={() => onWeek(n)}
                  >
                    <ListMusic size={13} aria-hidden="true" />
                    <span className="side-name">{weekName(n)}</span>
                    <span className="side-count">
                      {week?.itemIds.length ?? 0}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-labelledby="folders-title">
          <h3 id="folders-title" className="side-title">
            <FolderOpen size={13} aria-hidden="true" /> Folder
          </h3>
          <ul className="side-list" aria-labelledby="folders-title">
            <li>
              <span className="folder active">
                <Music size={13} aria-hidden="true" />
                <span className="side-name">Musik</span>
                <span className="side-count">{data.songs.length}</span>
              </span>
            </li>
          </ul>
        </section>
      </aside>
      <div className="songs-main">
        <div className="songs-toolbar">
          <div>
            <h3>Musik</h3>
            <p>Klik judul = Preview · Tarik lagu ke Jadwal Ibadah</p>
          </div>
          <div className="songs-toolbar-actions">
            <span className="songs-count">
              {songs.length} lagu{query ? " ditemukan" : ""}
            </span>
            <button
              className="button primary"
              disabled={!editable || busy}
              onClick={onNew}
            >
              <Plus size={15} />
              Tambah lagu
            </button>
          </div>
        </div>
        <div className="song-search">
          <input
            aria-label="Cari musik"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Cari musik…"
          />
          <button
            className="icon-button"
            aria-label="Hapus pencarian"
            disabled={!query}
            onClick={() => onQuery("")}
          >
            <X size={15} />
          </button>
        </div>
        {data.drafts.length > 0 && (
          <div className="draft-list">
            <h3>Draft yang dapat dipulihkan</h3>
            {data.drafts.map((d) => (
              <div className="draft-row" key={d.id}>
                <span>
                  {d.value.title || "Lagu tanpa judul"}{" "}
                  <small>· belum diterapkan</small>
                </span>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => onRecover(d.songId)}
                >
                  Buka draft
                </button>
                <button
                  className="icon-button danger"
                  disabled={!editable || busy}
                  aria-label={`Buang draft ${d.value.title || "tanpa judul"}`}
                  onClick={() => onDiscard(d.songId, d.sequence)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        {songs.length === 0 ? (
          <div className="songs-empty">
            <strong>
              {query
                ? `Tidak ada hasil untuk “${query}”`
                : "Belum ada lagu di Musik"}
            </strong>
            <p>
              Tambahkan lirik milik Anda atau materi yang Anda berhak gunakan.
            </p>
          </div>
        ) : (
          <ul className="song-list" aria-label="Daftar lagu">
            {songs.map((song) => (
              <li
                key={song.id}
                data-testid="song-row"
                draggable={editable && !busy}
                onDragStart={(e) => {
                  e.dataTransfer.setData(SONG_DRAG_TYPE, song.id);
                  e.dataTransfer.setData("text/plain", song.title);
                  e.dataTransfer.effectAllowed = "copy";
                }}
              >
                <button
                  className="song-inspect"
                  onClick={() => onInspect(song)}
                >
                  <strong>{song.title}</strong>
                  <small>
                    {[
                      song.author || song.category,
                      `${song.sections.length} section`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </button>
                <div className="song-actions">
                  <button
                    className="text-action"
                    aria-label={`Edit ${song.title}`}
                    disabled={!editable || busy}
                    onClick={() => onEdit(song)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-action danger"
                    aria-label={`Hapus lagu ${song.title}`}
                    disabled={!editable || busy}
                    onClick={() => onDelete(song)}
                  >
                    Hapus
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Duplikasi ${song.title}`}
                    disabled={!editable || busy}
                    onClick={() => onDuplicate(song)}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
