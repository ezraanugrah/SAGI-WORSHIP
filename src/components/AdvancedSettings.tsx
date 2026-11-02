import type { PresentationController } from "../presentation/controller";
import { listScreens, type ScreenChoice } from "../presentation/windowManager";
import { useEffect, useState } from "react";
import type { useThemes } from "../hooks/useThemes";
import { validAdvanced, advancedDefaults } from "../themes/models";
export function AdvancedSettings({
  services,
  editable,
  onCalibration,
  controller,
}: {
  services: ReturnType<typeof useThemes>;
  editable: boolean;
  onCalibration: () => void;
  controller: PresentationController;
}) {
  const [screens, setScreens] = useState<ScreenChoice[]>([]),
    [screen, setScreen] = useState("");
  const [draft, setDraft] = useState(services.settings),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => setDraft(services.settings), [services.settings.revision]);
  return (
    <section
      className="panel settings-panel advanced-settings"
      aria-label="Pengaturan lanjutan"
    >
      <div className="panel-title">Themes & Advanced Settings</div>
      <fieldset disabled={!editable || saving}>
        <label>
          Default theme
          <select
            aria-label="Default theme"
            value={draft.defaultThemeId ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, defaultThemeId: e.target.value || null })
            }
          >
            <option value="">Gunakan preferensi dasar legacy</option>
            {services.themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reference canvas
          <select
            aria-label="Reference canvas"
            value={draft.reference}
            onChange={(e) =>
              setDraft({
                ...draft,
                reference: Number(e.target.value) as 720 | 1080,
              })
            }
          >
            <option value={1080}>1920 × 1080 · 16:9</option>
            <option value={720}>1280 × 720 · 16:9</option>
          </select>
        </label>
        <label>
          Display scaling
          <select
            aria-label="Display scaling"
            value={draft.scaling}
            onChange={(e) =>
              setDraft({
                ...draft,
                scaling: e.target.value as "fit" | "no-upscale",
              })
            }
          >
            <option value="fit">Fit · aspect ratio tetap</option>
            <option value="no-upscale">Fit tanpa pembesaran</option>
          </select>
        </label>
        <label>
          <input
            aria-label="Reduced motion"
            type="checkbox"
            checked={draft.reducedMotion}
            onChange={(e) =>
              setDraft({ ...draft, reducedMotion: e.target.checked })
            }
          />{" "}
          Reduced motion Preview
        </label>
        <label>
          <input
            aria-label="Contrast warnings"
            type="checkbox"
            checked={draft.contrastWarnings}
            onChange={(e) =>
              setDraft({ ...draft, contrastWarnings: e.target.checked })
            }
          />{" "}
          Peringatan kontras
        </label>
        <p className="field-help">
          Tema default memiliki tipografi sendiri dan mengungguli preferensi
          dasar. Default ini hanya dipakai saat persiapan baru; LIVE tidak
          berubah. Font memakai unit referensi 1080. Reference canvas tidak
          mengubah resolusi monitor fisik. Video background selalu silent dan
          dimulai paused.
        </p>
        <button
          className="button primary"
          disabled={!validAdvanced(draft)}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await services.repo.saveSettings(
                draft,
                services.settings.revision,
              );
              await services.reload();
              setError("Pengaturan lanjutan tersimpan lokal");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          Simpan pengaturan lanjutan
        </button>
      </fieldset>
      <button
        className="button secondary"
        disabled={!editable || saving}
        onClick={async () => {
          if (
            !window.confirm(
              "Reset pengaturan lanjutan ke default? Tema, media, lagu, dan LIVE tidak dihapus/diubah.",
            )
          )
            return;
          setSaving(true);
          try {
            await services.repo.saveSettings(
              { ...advancedDefaults },
              services.settings.revision,
            );
            await services.reload();
            setError("Pengaturan lanjutan direset");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        Reset pengaturan lanjutan
      </button>
      {error && <p role="status">{error}</p>}
      {services.error && <p role="alert">{services.error}</p>}
      <div className="media-filters">
        <button
          className="button secondary"
          disabled={!editable}
          onClick={async () => {
            try {
              setScreens(await listScreens());
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Pilih layar dari Settings
        </button>
        {screens.length > 0 && (
          <label>
            Layar tujuan Settings
            <select
              aria-label="Layar tujuan Settings"
              value={screen}
              onChange={(e) => setScreen(e.target.value)}
            >
              <option value="">Manual</option>
              {screens.map((s, i) => (
                <option key={i} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="button secondary"
          disabled={!editable}
          onClick={() => {
            try {
              controller.windows.open(
                screen === "" ? undefined : screens[Number(screen)],
              );
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Open projector dari Settings
        </button>
        <button
          className="button secondary"
          disabled={!editable}
          onClick={() => {
            try {
              controller.windows.fullscreen();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Fullscreen dari Settings
        </button>
      </div>
      <button className="button secondary" onClick={onCalibration}>
        Siapkan kalibrasi di Preview
      </button>
      <p className="field-help">
        Kalibrasi tetap di Preview; tampilkan ke audience hanya dengan Go Live.
        Gunakan Open Projector/Fullscreen pada panel LIVE; jika izin layar
        ditolak, pindahkan jendela secara manual. Media, pin, dan quota tersedia
        di Data & penyimpanan serta Media Library. Audio foreground tetap
        memakai kontrol Phase 5.
      </p>
    </section>
  );
}
