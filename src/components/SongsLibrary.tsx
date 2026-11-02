import { Copy, Pencil, Plus, Trash2, Music2 } from "lucide-react";
import { searchSongs, type Workspace, type Song } from "../domain/models";
export function SongsLibrary({
  data,
  query,
  editable,
  busy,
  onNew,
  onEdit,
  onInspect,
  onDuplicate,
  onDelete,
  onAdd,
  onRecover,
  onDiscard,
}: {
  data: Workspace;
  query: string;
  editable: boolean;
  busy: boolean;
  onNew: () => void;
  onEdit: (song: Song) => void;
  onInspect: (song: Song) => void;
  onDuplicate: (song: Song) => void;
  onDelete: (song: Song) => void;
  onAdd: (song: Song) => void;
  onRecover: (songId: string) => void;
  onDiscard: (songId: string, sequence: number) => void;
}) {
  const songs = searchSongs(data.songs, query);
  return (
    <div className="songs-content">
      <div className="songs-toolbar">
        <span>
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
        <div className="library-empty">
          <div className="library-art">
            <Music2 size={30} />
          </div>
          <div>
            <h3>
              {query
                ? `Tidak ada hasil untuk “${query}”`
                : "Perpustakaan lagu Anda dimulai di sini"}
            </h3>
            <p>
              Tambahkan lirik milik Anda atau materi yang Anda berhak gunakan.
            </p>
          </div>
        </div>
      ) : (
        <ul className="song-list" aria-label="Daftar lagu">
          {songs.map((song) => (
            <li key={song.id} data-testid="song-row">
              <button className="song-inspect" onClick={() => onInspect(song)}>
                <span className="song-symbol">
                  <Music2 size={18} />
                </span>
                <span>
                  <strong>{song.title}</strong>
                  <small>
                    {[song.author, song.category, song.language]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · {song.sections.length} bagian · {song.order.length} urutan
                  </small>
                </span>
              </button>
              <div className="song-actions">
                <button
                  className="icon-button"
                  aria-label={`Edit ${song.title}`}
                  disabled={!editable || busy}
                  onClick={() => onEdit(song)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Duplikasi ${song.title}`}
                  disabled={!editable || busy}
                  onClick={() => onDuplicate(song)}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label={`Hapus lagu ${song.title}`}
                  disabled={!editable || busy}
                  onClick={() => onDelete(song)}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  className="button secondary"
                  disabled={!editable || busy || !data.activeId}
                  onClick={() => onAdd(song)}
                >
                  <Plus size={14} />
                  Ke jadwal
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
