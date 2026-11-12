import { t } from "../i18n";
import { ThemesLibrary } from "./ThemesLibrary";
import {
  DEFAULT_OUTLINE_PX,
  loadLyricFonts,
  lyricFont,
} from "../presentation/fonts";
import { resolveAppearance } from "../presentation/appearance";
import type { useThemes } from "../hooks/useThemes";
import { MediaLibrary } from "./MediaLibrary";
import type { useMedia } from "../hooks/useMedia";
import { BibleLibrary } from "./BibleLibrary";
import { ScriptureBackground } from "./ScriptureBackground";
import { SCRIPTURE_THEME_ID, type ThemeSpec } from "../themes/models";
import { applyOnline, loadSettings } from "../scriptures/online";
import { useFolderWatch } from "../hooks/useFolderWatch";
import { useSongSync } from "../hooks/useSongSync";
import { libraryRepos } from "../sync/libraryAdapters";
import { fileKey, inLibrary } from "../media/folderWatch";
import { MEDIA_TAB_KINDS } from "../media/importCoordinator";
import type { useScriptureServices } from "../hooks/useScriptures";
import { useEffect, useCallback, useMemo, useRef } from "react";
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
import { AutoArrange } from "./AutoArrange";
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
  onPrefsChange,
}: {
  onPreviewDirty?: (dirty: boolean) => void;
  /** Save preferences (lyric size/outline from the row under Live Output). */
  onPrefsChange?: (patch: Partial<Preferences>) => void;
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
  // Songs, Media and Themes sync with one Supabase account.
  const library = useMemo(
    () => libraryRepos(mediaServices.repo, themeServices.repo),
    [mediaServices.repo, themeServices.repo],
  );
  const sync = useSongSync(repo, editable, library);
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
  // What each prepared deck was made from, so the LIVE item can be shown
  // again with a new lyric size/outline (row under Live Output).
  type Request = {
    selection: Selection;
    override?: { id: string; scope: "item" | "all" };
  };
  const requests = useRef(new Map<string, Request>());
  const remember = (deckId: string, request: Request) => {
    requests.current.set(deckId, request);
    while (requests.current.size > 30)
      requests.current.delete(requests.current.keys().next().value!);
  };
  const latestPrefs = useRef(prefs);
  latestPrefs.current = prefs;
  const lyricStyle = (p: Preferences): Style => ({
    font: lyricFont(p.font),
    fontSize: p.fontSize,
    outline: p.outline ?? DEFAULT_OUTLINE_PX,
    safeMargin: p.safeMargin,
    theme: p.theme as Style["theme"],
    lines: 6,
  });
  // Videos from the Media tab always start with sound (Mute LIVE can still
  // silence them); theme video backgrounds are always silent.
  const videoDefaults = (p: Preferences) => ({
    loop: p.loopLive,
    muted: false,
    volume: p.volume / 100,
  });
  /** Workspace and themes resolved for `selection` (null after an error). */
  async function inputs(
    selection: Selection,
    override: Request["override"],
    signal?: AbortSignal,
  ) {
    // Measure with the real lyric fonts, not a fallback.
    await loadLyricFonts();
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
        signal,
      );
      if (signal?.aborted) return null;
      const appearance = await resolveAppearance(
        themeServices.repo,
        resolved,
        selection,
        override,
      );
      return { resolved, appearance };
    } catch (e) {
      if (!signal?.aborted) presentation.report(e);
      return null;
    }
  }
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
      !window.confirm(t("Buang perubahan Preview yang belum diterapkan?"))
    )
      return;
    const input = await inputs(selection, override, abort.signal);
    if (
      !input ||
      request !== preparationRequest.current ||
      abort.signal.aborted
    )
      return;
    lastSelection.current = selection;
    const ready = await presentation.prepare(
      input.resolved,
      selection,
      lyricStyle(latestPrefs.current),
      videoDefaults(latestPrefs.current),
      input.appearance,
    );
    const prepared = presentation.snapshot().preview;
    if (ready && prepared) remember(prepared.deck.id, { selection, override });
    return ready;
  }
  /**
   * Scriptures › Latar ayat. Verses on Live Output (and, once LIVE, on the
   * projector) take the new background at once; songs keep their theme.
   */
  async function saveScriptureBackground(spec: ThemeSpec) {
    const current = (await themeServices.repo.list()).themes.find(
      (th) => th.id === SCRIPTURE_THEME_ID,
    );
    await themeServices.repo.save(
      SCRIPTURE_THEME_ID,
      "Latar ayat",
      spec,
      current?.revision ?? 0,
    );
    await themeServices.reload();
    const { preview: shown, live } = presentation.snapshot();
    let selection = lastSelection.current;
    const itemId = shown?.deck.frames[shown.index]?.itemId;
    if (selection?.kind === "schedule" && itemId)
      selection = { ...selection, itemId };
    if (!selection || shown?.deck.frames[shown.index]?.kind !== "scripture") {
      setMessage("Latar ayat disimpan. Ayat berikutnya memakai latar ini.");
      return;
    }
    // The verses on Live Output get it now; on the projector only when that
    // same slide is already LIVE (a verse waiting for Go Live keeps waiting).
    const onProjector = live?.deck.id === shown.deck.id;
    if ((await prepare(selection)) && onProjector) await followLive();
  }
  /**
   * After the first Go Live, what the operator picks in Jadwal Ibadah (and a
   * theme) goes to the projector at once; before it, it only shows on the
   * Live Output panel. Black / Clear Text stay as they are.
   */
  async function followLive() {
    if (!presentation.snapshot().live) return;
    try {
      await presentation.goLive(true);
    } catch (e) {
      presentation.report(e);
    }
  }
  /**
   * New lyric size/outline from the row under Live Output: save it, then
   * show the LIVE item again with it on the same slide. Without a known
   * source (e.g. after a restart) it only applies to the next preparation.
   */
  const reliveRun = useRef(0);
  async function relive(patch: { fontSize?: number; outline?: number }) {
    onPrefsChange?.(patch);
    const next = { ...latestPrefs.current, ...patch };
    latestPrefs.current = next;
    // What waits on the panel (not yet on the projector) gets the new style
    // too, so the panel shows what Go Live will send.
    const waiting = presentation.snapshot();
    if (waiting.staged && waiting.preview) {
      const id = waiting.preview.deck.id,
        source = requests.current.get(id),
        input = source && (await inputs(source.selection, source.override));
      if (source && input)
        try {
          const built = await presentation.build(
            input.resolved,
            source.selection,
            lyricStyle(next),
            videoDefaults(next),
            input.appearance,
          );
          if (presentation.restage(built, id)) remember(built.deck.id, source);
        } catch (e) {
          presentation.report(e);
        }
    }
    const token = ++reliveRun.current,
      start = presentation.snapshot().live,
      source = start && requests.current.get(start.deck.id);
    if (!start || !source || start.deck.frames.every((f) => f.kind === "media"))
      return;
    const input = await inputs(source.selection, source.override);
    if (!input || token !== reliveRun.current) return;
    try {
      const built = await presentation.build(
        input.resolved,
        source.selection,
        lyricStyle(next),
        videoDefaults(next),
        input.appearance,
      );
      const now = presentation.snapshot().live;
      if (
        token !== reliveRun.current ||
        !now ||
        requests.current.get(now.deck.id) !== source
      )
        return;
      if (await presentation.relive(built, now.deck.id))
        remember(built.deck.id, source);
    } catch (e) {
      presentation.report(e);
    }
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
  const [arranging, setArranging] = useState(false);
  const locked = busy || editor !== null || arranging || loading;
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
        t(
          "Hapus lagu “{title}” secara permanen? {count} item yang memakai lagu ini juga akan dihapus dari jadwal. Tindakan ini tidak dapat dibatalkan.",
          { title: song.title, count },
        ),
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
                // The slide shown on the Live Output panel.
                current:
                  index ===
                  (!presentationState.staged &&
                  presentationState.live?.deck.id === scheduleDeck.deck.id
                    ? presentationState.live.index
                    : scheduleDeck.index),
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
          {t(error || mutationError)}
          <button
            onClick={() => {
              setMutationError("");
              void reload();
            }}
          >
            {t("Muat ulang data")}
          </button>
        </div>
      )}
      {data.issues.length > 0 && (
        <div className="data-issues" role="alert">
          <strong>
            {t(
              "Beberapa data memerlukan pemeriksaan. Data asli tidak dihapus.",
            )}
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
          {t(message)}
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
                  t(
                    "Kosongkan “{name}”? Semua item dilepas dari jadwal ini; lagu di Musik dan media tidak dihapus.",
                    { name: s.name },
                  ),
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
            onSlide={async (index) => {
              if (
                previewDirty &&
                !window.confirm(
                  t("Buang perubahan Preview yang belum diterapkan?"),
                )
              )
                return;
              // A slide picked in Jadwal Ibadah shows on the Live Output
              // panel; once LIVE, it goes to the projector too.
              presentation.select(index);
              await followLive();
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
            onInspect={async (itemId) => {
              if (!data.activeId) return;
              const ready = await prepare({
                kind: "schedule",
                scheduleId: data.activeId,
                itemId,
              });
              if (ready) await followLive();
            }}
            footer={
              <PreviewWorkspace state={presentationState} onDirty={markDirty} />
            }
          />
          <LiveControls
            controller={presentation}
            state={presentationState}
            editable={editable}
            lyric={{
              fontSize: prefs.fontSize,
              outline: prefs.outline ?? DEFAULT_OUTLINE_PX,
            }}
            onLyric={(patch) => void relive(patch)}
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
                  <span className="tab-badge">
                    {t("{n} baru", { n: newMedia })}
                  </span>
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
                onArrange={() => setArranging(true)}
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
                      t("Buang draft ini? Lagu tersimpan tidak diubah."),
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
                background={
                  <ScriptureBackground
                    themes={themeServices.themes}
                    assets={data.mediaAssets ?? []}
                    editable={editable}
                    onImport={async (file) => {
                      const asset = await mediaServices.importBackground(file);
                      await reload();
                      return asset;
                    }}
                    onSave={saveScriptureBackground}
                  />
                }
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
                lyricStyle={lyricStyle(prefs)}
                preview={presentationState.preview}
                data={data}
                editable={editable}
                onChanged={() => void reload()}
                onApply={async (id) => {
                  // The chosen theme stays on: it becomes the theme of every
                  // song, verse or schedule item shown next, until another
                  // theme is chosen.
                  try {
                    if (themeServices.settings.defaultThemeId !== id) {
                      await themeServices.repo.saveSettings(
                        { ...themeServices.settings, defaultThemeId: id },
                        themeServices.settings.revision,
                      );
                      await themeServices.reload();
                    }
                  } catch (e) {
                    presentation.report(e);
                    return;
                  }
                  if (!lastSelection.current) {
                    setMessage(
                      "Tema dipilih. Lagu yang ditampilkan berikutnya memakai tema ini.",
                    );
                    return;
                  }
                  let selection = lastSelection.current;
                  const preview = presentationState.preview,
                    currentItem = preview?.deck.frames[preview.index].itemId;
                  if (selection.kind === "schedule" && currentItem)
                    selection = { ...selection, itemId: currentItem };
                  if (selection.kind === "schedule" && !selection.itemId) {
                    presentation.report(
                      new Error("Pilih item teks di Preview terlebih dahulu."),
                    );
                    return;
                  }
                  // The item gets the theme on the Live Output panel; once
                  // LIVE, on the projector too.
                  if (await prepare(selection, { id, scope: "item" }))
                    await followLive();
                }}
              />
            ) : null}
          </div>
        </section>
      </div>
      {arranging && (
        <AutoArrange
          repo={repo}
          editable={editable}
          onClose={() => setArranging(false)}
          onSaved={(songId, title) => {
            setArranging(false);
            freshQuery.current = query;
            setMessage(
              t("Lagu “{title}” tersimpan di Song Library.", { title }),
            );
            void reload().then(() => setFresh(songId));
          }}
        />
      )}
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
