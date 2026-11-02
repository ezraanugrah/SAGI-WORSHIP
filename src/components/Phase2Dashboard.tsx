import { ThemesLibrary } from "./ThemesLibrary";
import { resolveAppearance } from "../presentation/appearance";
import type { useThemes } from "../hooks/useThemes";
import { MediaLibrary } from "./MediaLibrary";
import type { useMedia } from "../hooks/useMedia";
import { ScripturesLibrary } from "./ScripturesLibrary";
import type { useScriptureServices } from "../hooks/useScriptures";
import { useEffect, useCallback, useRef } from "react";
import { PreviewWorkspace } from "./PreviewWorkspace";
import { LiveControls } from "./LiveControls";
import {
  PresentationController,
  type PresentationState,
} from "../presentation/controller";
import type { Selection } from "../presentation/generateSlides";
import type { Style } from "../presentation/models";
import { useState } from "react";
import { BookOpen, Images, Palette, Music2, Search } from "lucide-react";
import { Repository } from "../data/repository";
import { useWorkspace } from "../hooks/useWorkspace";
import { id, type Song } from "../domain/models";
import type { Preferences } from "../db";
import { SongsLibrary } from "./SongsLibrary";
import { SongEditor } from "./SongEditor";
import { SchedulePanel } from "./SchedulePanel";

const tabs = [
  { name: "Lagu", icon: Music2, phase: 2 },
  { name: "Alkitab", icon: BookOpen, phase: 4 },
  { name: "Media", icon: Images, phase: 5 },
  { name: "Tema", icon: Palette, phase: 6 },
];
export function Phase2Dashboard({
  repo,
  editable,
  prefs,
  presentation,
  presentationState,
  scriptureServices,
  mediaServices,
  themeServices,
}: {
  repo: Repository;
  editable: boolean;
  prefs: Preferences;
  presentation: PresentationController;
  presentationState: PresentationState;
  scriptureServices: ReturnType<typeof useScriptureServices>;
  mediaServices: ReturnType<typeof useMedia>;
  themeServices: ReturnType<typeof useThemes>;
}) {
  const { data, error, loading, reload } = useWorkspace(repo);
  const [query, setQuery] = useState(""),
    [tab, setTab] = useState(0),
    [editor, setEditor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [mutationError, setMutationError] = useState("");
  const [previewDirty, setPreviewDirty] = useState(false);
  const markDirty = useCallback((dirty: boolean) => setPreviewDirty(dirty), []);
  useEffect(() => {
    if (!loading) presentation.observeSources(data);
  }, [data, loading, presentation, presentationState.preview?.deck.id]);
  useEffect(
    () => presentation.observeThemes(themeServices.themes),
    [themeServices.themes, presentation, presentationState.preview?.deck.id],
  );
  const preparationRequest = useRef(0);
  const preparationAbort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      preparationRequest.current++;
      preparationAbort.current?.abort();
    },
    [],
  );
  const lastSelection = useRef<Selection | null>(null);
  async function prepare(
    selection: Selection,
    override?: { id: string; scope: "item" | "all" },
  ) {
    const request = ++preparationRequest.current;
    preparationAbort.current?.abort();
    const abort = new AbortController();
    preparationAbort.current = abort;
    if (
      (previewDirty ||
        (override && presentationState.preview?.deck.overrides.length)) &&
      !window.confirm("Buang perubahan Preview yang belum diterapkan?")
    )
      return;
    await document.fonts.ready;
    let resolved = data;
    try {
      resolved = await scriptureServices.scriptureRepo.resolveWorkspace(
        data,
        selection as Parameters<
          typeof scriptureServices.scriptureRepo.resolveWorkspace
        >[1],
      );
      resolved = await mediaServices.repo.resolveWorkspace(
        resolved,
        selection as Parameters<typeof mediaServices.repo.resolveWorkspace>[1],
        abort.signal,
      );
    } catch (e) {
      if (request !== preparationRequest.current || abort.signal.aborted)
        return;
      presentation.report(e);
      return;
    }
    if (request !== preparationRequest.current || abort.signal.aborted) return;
    let appearance;
    try {
      appearance = await resolveAppearance(
        themeServices.repo,
        resolved,
        selection,
        override,
      );
    } catch (e) {
      presentation.report(e);
      return;
    }
    if (request !== preparationRequest.current || abort.signal.aborted) return;
    lastSelection.current = selection;
    void presentation.prepare(
      resolved,
      selection,
      {
        font: prefs.font as Style["font"],
        fontSize: prefs.fontSize,
        safeMargin: prefs.safeMargin,
        theme: prefs.theme as Style["theme"],
        lines: 6,
      },
      { loop: prefs.loopLive, muted: prefs.muted, volume: prefs.volume / 100 },
      appearance,
    );
  }
  async function run(
    operation: () => Promise<unknown>,
    success = "Tersimpan lokal",
  ) {
    if (!editable) {
      setMutationError("Workspace hanya baca.");
      return;
    }
    setBusy(true);
    setMutationError("");
    try {
      await operation();
      await reload();
      setMessage(success);
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const act = (operation: () => Promise<unknown>, message?: string) => {
    void run(operation, message).catch(() => {});
  };
  const locked = busy || editor !== null || loading;
  function open(songId: string) {
    setEditor(songId);
  }
  function deleteSong(song: Song) {
    const count = data.items.filter(
      (i) => i.type === "song" && i.songId === song.id,
    ).length;
    if (
      window.confirm(
        `Hapus lagu “${song.title}” secara permanen? ${count} item yang memakai lagu ini juga akan dihapus dari jadwal. Tindakan ini tidak dapat dibatalkan.`,
      )
    )
      act(
        () => repo.deleteSong(song.id, song.revision),
        "Lagu dan referensi jadwal dihapus.",
      );
  }
  const TabIcon = tabs[tab].icon;
  return (
    <>
      {(error || mutationError) && (
        <div className="alert" role="alert">
          {error || mutationError}
          <button
            onClick={() => {
              setMutationError("");
              void reload();
            }}
          >
            Muat ulang data
          </button>
        </div>
      )}
      {data.issues.length > 0 && (
        <div className="data-issues" role="alert">
          <strong>
            Beberapa data memerlukan pemeriksaan. Data asli tidak dihapus.
          </strong>
          <ul>
            {data.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {message && (
        <div className="operation-status" role="status">
          {message}
        </div>
      )}
      <div className="dashboard-grid">
        <SchedulePanel
          data={data}
          slideCounts={
            presentationState.preview?.deck.schedule?.id === data.activeId &&
            !presentationState.sourceChanged
              ? Object.fromEntries(
                  data.items.map((item) => [
                    item.id,
                    presentationState.preview!.deck.frames.filter(
                      (frame) => frame.itemId === item.id,
                    ).length,
                  ]),
                )
              : undefined
          }
          editable={editable}
          busy={locked}
          onCreate={async (name) => {
            await run(() => repo.createSchedule(name), "Jadwal dibuat.");
          }}
          onRename={async (s, name) => {
            await run(
              () => repo.renameSchedule(s.id, name, s.revision),
              "Nama jadwal disimpan.",
            );
          }}
          onDuplicate={(s) =>
            act(
              () => repo.duplicateSchedule(s.id, s.revision),
              "Jadwal diduplikasi.",
            )
          }
          onDelete={(s) => {
            if (
              window.confirm(
                `Hapus jadwal “${s.name}” secara permanen? Lagu sumber tidak dihapus.`,
              )
            )
              act(
                () => repo.deleteSchedule(s.id, s.revision),
                "Jadwal dihapus.",
              );
          }}
          onActive={(scheduleId) =>
            act(() => repo.setActive(scheduleId), "Jadwal aktif disimpan.")
          }
          onRemove={(s, itemId) =>
            act(
              () => repo.removeItem(s.id, itemId, s.revision),
              "Item dilepas; lagu sumber tetap tersedia.",
            )
          }
          onReorder={(s, ids) =>
            act(
              () => repo.reorderItems(s.id, ids, s.revision),
              "Urutan jadwal disimpan.",
            )
          }
          onInspect={(itemId) => {
            if (data.activeId)
              void prepare({
                kind: "schedule",
                scheduleId: data.activeId,
                itemId,
              });
          }}
        />
        <PreviewWorkspace
          controller={presentation}
          state={presentationState}
          editable={editable}
          onDirty={markDirty}
          videoDefaults={{
            loop: prefs.loopPreview,
            muted: prefs.muted,
            volume: prefs.volume / 100,
          }}
        />
        <LiveControls
          controller={presentation}
          state={presentationState}
          editable={editable}
          dirty={previewDirty}
        />
      </div>
      <section className="panel library">
        <div className="library-header">
          <div>
            <h2>Perpustakaan materi</h2>
            <p>
              Kelola lagu dan susun alur ibadah, sepenuhnya di perangkat ini.
            </p>
          </div>
          <span className="small-tag">LOCAL LIBRARY</span>
        </div>
        <div className="library-tools">
          <div className="tabs" role="tablist" aria-label="Perpustakaan">
            {tabs.map((t, i) => (
              <button
                key={t.name}
                role="tab"
                id={`tab-${i}`}
                aria-controls="library-panel"
                aria-selected={i === tab}
                className={i === tab ? "selected" : ""}
                onClick={() => {
                  setTab(i);
                  setQuery("");
                }}
              >
                <t.icon size={16} />
                {t.name}
                <span>
                  {i === 0
                    ? data.songs.length
                    : i === 1
                      ? (data.translations?.length ?? 0)
                      : 0}
                </span>
              </button>
            ))}
          </div>
          {tab === 0 && (
            <label className="search">
              <Search size={16} />
              <input
                aria-label={`Cari ${tabs[tab].name}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Cari ${tabs[tab].name.toLowerCase()}…`}
              />
            </label>
          )}
        </div>
        <div role="tabpanel" id="library-panel" aria-labelledby={`tab-${tab}`}>
          {tab === 0 ? (
            <SongsLibrary
              data={data}
              query={query}
              editable={editable}
              busy={locked}
              onNew={() => open(id())}
              onEdit={(s) => open(s.id)}
              onInspect={(s) => void prepare({ kind: "song", songId: s.id })}
              onDuplicate={(s) =>
                act(
                  () => repo.duplicateSong(s.id, s.revision),
                  "Lagu diduplikasi.",
                )
              }
              onDelete={deleteSong}
              onAdd={(s) => {
                const active = data.schedules.find(
                  (x) => x.id === data.activeId,
                );
                if (active)
                  act(
                    () => repo.addSong(active.id, s.id, active.revision),
                    "Lagu ditambahkan ke jadwal.",
                  );
              }}
              onRecover={(songId) => {
                if (editor) return;
                open(songId);
              }}
              onDiscard={(songId, sequence) => {
                if (
                  window.confirm(
                    "Buang draft ini? Lagu tersimpan tidak diubah.",
                  )
                )
                  act(
                    () => repo.discardDraft(songId, sequence),
                    "Draft dibuang.",
                  );
              }}
            />
          ) : tab === 1 ? (
            <ScripturesLibrary
              repo={scriptureServices.scriptureRepo}
              importer={scriptureServices.importer}
              importState={scriptureServices.importState}
              data={data}
              editable={editable}
              busy={locked}
              onPreview={(selection) =>
                void prepare({ kind: "scripture", selection })
              }
              onChanged={() => void reload()}
            />
          ) : tab === 2 ? (
            <MediaLibrary
              services={mediaServices}
              data={data}
              editable={editable}
              onPreview={(selection) =>
                void prepare({ kind: "media", selection })
              }
              onChanged={() => void reload()}
            />
          ) : tab === 3 ? (
            <ThemesLibrary
              services={themeServices}
              preview={presentationState.preview}
              data={data}
              editable={editable}
              onChanged={() => void reload()}
              onApply={(id, scope) => {
                if (!lastSelection.current) {
                  presentation.report(
                    new Error(
                      "Pilih lagu/Scripture atau item jadwal untuk Preview terlebih dahulu.",
                    ),
                  );
                  return;
                }
                let selection = lastSelection.current;
                const preview = presentationState.preview,
                  currentItem = preview?.deck.frames[preview.index].itemId;
                if (selection.kind === "schedule" && currentItem)
                  selection = { ...selection, itemId: currentItem };
                if (
                  selection.kind === "schedule" &&
                  !selection.itemId &&
                  scope === "item"
                ) {
                  presentation.report(
                    new Error("Pilih item teks di Preview terlebih dahulu."),
                  );
                  return;
                }
                void prepare(selection, { id, scope });
              }}
            />
          ) : (
            <div className="library-empty">
              <div className="library-art">
                <TabIcon size={30} />
              </div>
              <div>
                <h3>{tabs[tab].name}</h3>
                <p>Tersedia pada Phase {tabs[tab].phase}.</p>
              </div>
            </div>
          )}
        </div>
      </section>
      {editor && (
        <SongEditor
          key={editor}
          songId={editor}
          song={data.songs.find((s) => s.id === editor)}
          draft={data.drafts.find((d) => d.songId === editor)}
          repo={repo}
          editable={editable}
          onSaved={() => void reload()}
          onClose={() => {
            setEditor(null);
            void reload();
          }}
        />
      )}
      <div className="foundation-note">
        <span className="small-star">✦</span>
        <div>
          <strong>Lagu, ayat, dan jadwal siap dipersiapkan.</strong>
          <p>
            Phase 6 · Tema, lagu, ayat, dan media lokal. Preview dan LIVE tetap
            terpisah; tampilkan dengan Go Live eksplisit.
          </p>
        </div>
      </div>
    </>
  );
}
