import { t } from "../i18n";
import type { PresentationController } from "../presentation/controller";
import { useEffect, useState } from "react";
import type { useThemes } from "../hooks/useThemes";
import {
  SCRIPTURE_THEME_ID,
  validAdvanced,
  advancedDefaults,
} from "../themes/models";
export function AdvancedSettings({
  services,
  editable,
  onCalibration,
}: {
  services: ReturnType<typeof useThemes>;
  editable: boolean;
  onCalibration: () => void;
  /** Kept for callers; projector windows are opened from the top bar. */
  controller?: PresentationController;
}) {
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
            <option value="">{t("Tanpa tema (latar hitam)")}</option>
            {services.themes
              .filter((th) => th.id !== SCRIPTURE_THEME_ID)
              .map((t) => (
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
            <option value="fit">{t("Fit · aspect ratio tetap")}</option>
            <option value="no-upscale">{t("Fit tanpa pembesaran")}</option>
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
          {t("Peringatan kontras")}
        </label>
        <p className="field-help">
          {t(
            "Default theme = tema yang sedang dipakai (sama dengan pilihan di tab Themes), untuk lagu yang ditampilkan berikutnya; LIVE tidak berubah. Font dan ukuran lirik diatur di Tipografi lirik. Reference canvas tidak mengubah resolusi monitor fisik. Latar video tema selalu tanpa suara dan berputar sendiri saat tayang.",
          )}
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
              setError(t("Pengaturan lanjutan tersimpan lokal"));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {t("Simpan pengaturan lanjutan")}
        </button>
      </fieldset>
      <button
        className="button secondary"
        disabled={!editable || saving}
        onClick={async () => {
          if (
            !window.confirm(
              t(
                "Reset pengaturan lanjutan ke default? Tema, media, lagu, dan LIVE tidak dihapus/diubah.",
              ),
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
            setError(t("Pengaturan lanjutan direset"));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        {t("Reset pengaturan lanjutan")}
      </button>
      {error && <p role="status">{t(error)}</p>}
      {services.error && <p role="alert">{t(services.error)}</p>}
      <button className="button secondary" onClick={onCalibration}>
        {t("Siapkan kalibrasi di Preview")}
      </button>
      <p className="field-help">
        {t(
          "Kalibrasi tampil di panel Live Output dulu; ke proyektor hanya dengan Go Live. Buka proyektor dengan tombol Live di kanan atas (Layar/Fullscreen di kiri atas); jika izin layar ditolak, pindahkan jendela secara manual.",
        )}
      </p>
    </section>
  );
}
