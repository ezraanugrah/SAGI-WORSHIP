import { Copy, Plus, Trash2, X } from "lucide-react";
import { searchSongs, type Workspace, type Song } from "../domain/models";
/** Drag payload type for a song dragged from Music into the active Week. */
export const SONG_DRAG_TYPE = "application/x-sagi-song";
/**
 * SONGS tab: Playlists (worship schedules, one is the active "Week") and
 * Folders on the left, the Music library on the right.
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
  onActive,
  onNewPlaylist,
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
  onActive: (scheduleId: string) => void;
  onNewPlaylist: () => void;
}) {
  const songs = searchSongs(data.songs, query);
  return (
    <div className="songs-content">
      <aside className="songs-side">
        <section aria-labelledby="playlists-title">
          <h3 id="playlists-title" className="side-title">
            Playlists
          </h3>
          {data.schedules.length === 0 ? (
            <p className="side-empty">Belum ada playlist.</p>
          ) : (
            <ul className="side-list" aria-labelledby="playlists-title">
              {data.schedules.map((s) => (
                <li key={s.id}>
                  <button
                    className={s.id === data.activeId ? "active" : ""}
                    aria-current={s.id === data.activeId ? "true" : undefined}
                    disabled={!editable || busy}
                    onClick={() => onActive(s.id)}
                  >
                    <span className="side-mark" aria-hidden="true">
                      =
                    </span>
                    <span className="side-name">{s.name}</span>
                    <span className="side-count">{s.itemIds.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="button new-playlist"
            disabled={!editable || busy}
            onClick={onNewPlaylist}
          >
            <Plus size={15} />
            New playlist
          </button>
        </section>
        <section aria-labelledby="folders-title">
          <h3 id="folders-title" className="side-title">
            Folders
          </h3>
          <ul className="side-list" aria-labelledby="folders-title">
            <li>
              <span className="folder active">
                <span className="side-mark" aria-hidden="true">
                  [ ]
                </span>
                <span className="side-name">Music</span>
                <span className="side-count">{data.songs.length}</span>
              </span>
            </li>
          </ul>
        </section>
      </aside>
      <div className="songs-main">
        <div className="songs-toolbar">
          <div>
            <h3>Music</h3>
            <p>Klik judul = Preview · Tarik ke Schedule = tambah ke Week</p>
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
            aria-label="Cari Lagu"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Cari lagu di Music…"
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
                : "Belum ada lagu di Music"}
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
                draggable={editable && !busy && !!data.activeId}
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
