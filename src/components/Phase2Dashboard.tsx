import { ThemesLibrary } from "./ThemesLibrary";
import { resolveAppearance } from "../presentation/appearance";
import type { useThemes } from "../hooks/useThemes";
import { MediaLibrary } from "./MediaLibrary";
import type { useMedia } from "../hooks/useMedia";
import { BibleLibrary } from "./BibleLibrary";
import { applyOnline, loadSettings } from "../scriptures/online";
import { useFolderWatch } from "../hooks/useFolderWatch";
import { useSongSync } from "../hooks/useSongSync";
import { fileKey, inLibrary } from "../media/folderWatch";
import { MEDIA_TAB_KINDS } from "../media/importCoordinator";
import type { useScriptureServices } from "../hooks/useScriptures";
import { useEffect, useCallback, useRef } from "react";
import { PreviewWorkspace, slideSummary } from "./PreviewWorkspace";
import type { MediaSelection } from "../media/models";
import { LiveControls } from "./LiveControls";
import {
  PresentationController,
  type PresentationState,
} from "../presentation/controller";
import type { Selection } from "../presentation/generateSlides";
import type { Style } from "../presentation/models";
import { useState } from "react";
import { Repository } from "../data/repository";
import { useWorkspace } from "../hooks/useWorkspace";
import { id, type Schedule, type Song } from "../domain/models";
import type { Preferences } from "../db";
import { SongsLibrary } from "./SongsLibrary";
import { SongEditor } from "./SongEditor";
import { SchedulePanel, type ScheduleSlide } from "./SchedulePanel";
import { weekName, weekSchedules } from "../domain/weeks";

const tabs = ["Songs", "Scriptures", "Media", "Presentations", "Themes"];
export function Phase2Dashboard({
  repo,
  editable,
  prefs,
  presentation,
  presentationState,
  scriptureServices,
  mediaServices,
  themeServices,
  onPreviewDirty,
}: {
  onPreviewDirty?: (dirty: boolean) => void;
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
    // Song just created in the editor: highlighted in Musik for dragging.
    [fresh, setFresh] = useState<string | null>(null),
    // The music search when that song's editor closed (see SongsLibrary).
    freshQuery = useRef(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [mutationError, setMutationError] = useState("");
  const [previewDirty, setPreviewDirty] = useState(false);
  // Musik library sync between laptops; runs whatever tab is shown.
  const sync = useSongSync(repo, editable);
  // Watched laptop folder: checked while the app is open, whatever tab is shown.
  const watch = useFolderWatch({
    enabled: true,
    assets: data.mediaAssets ?? [],
    editable,
    working: mediaServices.working,
    // The watched folder feeds the Media tab: pictures and videos only.
    importFiles: (files) => mediaServices.importFiles(files, MEDIA_TAB_KINDS),
  });
  const newMedia =
    watch.state.status === "watching"
      ? (() => {
          const s = watch.state;
          return s.files.filter(
            (f) =>
              s.fresh.has(fileKey(f)) && !inLibrary(f, data.mediaAssets ?? []),
          ).length;
        })()
      : 0;
  const markDirty = useCallback((dirty: boolean) => setPreviewDirty(dirty), []);
  // The top-bar toolbar's Go Live follows the same "unapplied Preview" rule.
  useEffect(() => {
    onPreviewDirty?.(previewDirty);
  }, [previewDirty, onPreviewDirty]);
  useEffect(() => () => onPreviewDirty?.(false), [onPreviewDirty]);
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
      // TB2 / ESV columns from the official APIs, when chosen and cached.
      const online = await applyOnline(resolved, loadSettings());
      resolved = online.data;
      if (online.notes.length) setMessage(online.notes.join(" "));
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
  const creating = useRef(false);
  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => setFresh(null), 8000);
    return () => clearTimeout(timer);
  }, [fresh]);
  function open(songId: string, created = false) {
    creating.current = created;
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
  // The schedule item open in Preview expands to its slides in the Schedule.
  const preview = presentationState.preview;
  const scheduleDeck =
    preview &&
    preview.deck.schedule?.id === data.activeId &&
    !presentationState.sourceChanged
      ? preview
      : null;
  const openItemId =
    scheduleDeck?.deck.frames[scheduleDeck.index]?.itemId ?? null;
  const openSlides: ScheduleSlide[] = scheduleDeck
    ? scheduleDeck.deck.frames.flatMap((frame, index) =>
        frame.itemId === openItemId
          ? [
              {
                index,
                label: frame.label,
                text: slideSummary(scheduleDeck.deck, index),
                current: index === scheduleDeck.index,
              },
            ]
          : [],
      )
    : [];
  const weeks = weekSchedules(data.schedules);
  /** Make Week n active, creating it the first time it is used. */
  const openWeek = async (n: number) => {
    const week = weeks[n - 1];
    if (!week) return repo.createSchedule(weekName(n));
    await repo.setActive(week.id);
    return week;
  };
  /** Where a dropped song/media goes: the active Week, else Week 1. */
  const weekFor = async (s: Schedule | null) => s ?? openWeek(1);
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
        <div className="operation-status" role="status" key={message}>
          {message}
        </div>
      )}
      <div className="workspace">
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
            onClear={(s) => {
              if (
                window.confirm(
                  `Kosongkan “${s.name}”? Semua item dilepas dari jadwal ini; lagu di Musik dan media tidak dihapus.`,
                )
              )
                act(
                  () => repo.clearSchedule(s.id, s.revision),
                  `${s.name} dikosongkan.`,
                );
            }}
            onAddMedia={(s, payload) => {
              let selection: MediaSelection;
              try {
                selection = JSON.parse(payload) as MediaSelection;
              } catch {
                setMutationError("Data media yang ditarik tidak valid.");
                return;
              }
              act(
                async () => {
                  const week = await weekFor(s);
                  await mediaServices.repo.addToSchedule(
                    week.id,
                    selection,
                    week.revision,
                  );
                },
                s
                  ? "Media ditambahkan ke jadwal."
                  : "Media ditambahkan ke Week 1.",
              );
            }}
            openItemId={openItemId}
            slides={openSlides}
            onSlide={(index) => {
              if (
                previewDirty &&
                !window.confirm(
                  "Buang perubahan Preview yang belum diterapkan?",
                )
              )
                return;
              presentation.select(index);
            }}
            onAddSong={(s, songId) =>
              act(
                async () => {
                  const week = await weekFor(s);
                  await repo.addSong(week.id, songId, week.revision);
                },
                s
                  ? "Lagu ditambahkan ke jadwal."
                  : "Lagu ditambahkan ke Week 1.",
              )
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
          />
        </div>
        <section className="library">
          <div className="tabs" role="tablist" aria-label="Perpustakaan">
            {tabs.map((name, i) => (
              <button
                key={name}
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
                {name}
                {name === "Media" && newMedia > 0 && (
                  <span className="tab-badge">{newMedia} baru</span>
                )}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="library-panel"
            className="panel library-panel"
            aria-labelledby={`tab-${tab}`}
          >
            {tab === 0 ? (
              <SongsLibrary
                data={data}
                query={query}
                onQuery={setQuery}
                onWeek={(n) => act(() => openWeek(n), `${weekName(n)} aktif.`)}
                editable={editable}
                busy={locked}
                onNew={() => open(id(), true)}
                freshId={fresh}
                freshQuery={freshQuery.current}
                sync={sync}
                onEdit={(s) => open(s.id)}
                onInspect={(s) => void prepare({ kind: "song", songId: s.id })}
                onDuplicate={(s) =>
                  act(
                    () => repo.duplicateSong(s.id, s.revision),
                    "Lagu diduplikasi.",
                  )
                }
                onDelete={deleteSong}
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
              <BibleLibrary
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
                onTarget={() =>
                  weekFor(
                    data.schedules.find((s) => s.id === data.activeId) ?? null,
                  )
                }
              />
            ) : tab === 2 ? (
              <MediaLibrary
                services={mediaServices}
                watch={watch}
                data={data}
                editable={editable}
                onPreview={(selection) =>
                  void prepare({ kind: "media", selection })
                }
                onChanged={() => void reload()}
              />
            ) : tab === 3 ? (
              <MediaLibrary
                mode="presentations"
                services={mediaServices}
                data={data}
                editable={editable}
                onPreview={(selection) =>
                  void prepare({ kind: "media", selection })
                }
                onChanged={() => void reload()}
              />
            ) : tab === 4 ? (
              <ThemesLibrary
                onImportMedia={async (file) => {
                  const asset = await mediaServices.importBackground(file);
                  await reload();
                  return asset;
                }}
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
            ) : null}
          </div>
        </section>
      </div>
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
            const created = creating.current ? editor : null;
            creating.current = false;
            if (created) freshQuery.current = query;
            setEditor(null);
            void reload().then(() => {
              if (created) setFresh(created);
            });
          }}
        />
      )}
    </>
  );
}
