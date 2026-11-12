import { t } from "../i18n";
import type { Typography } from "../themes/models";
export function TypographyEditor({
  value,
  onChange,
}: {
  value: Typography;
  onChange: (v: Typography) => void;
}) {
  const set = (patch: Partial<Typography>) => onChange({ ...value, ...patch });
  const numeric = (
    label: string,
    key: "lineHeight",
    min: number,
    max: number,
    step = 1,
  ) => (
    <label key={key}>
      {label}
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value[key]}
        onChange={(e) => set({ [key]: Number(e.target.value) })}
      />
    </label>
  );
  return (
    <div className="typography-editor">
      <p className="field-help typography-note">
        {t(
          "Lirik selalu Extra Bold, putih, dengan outline hitam. Font, ukuran, dan tebal outline diatur di Pengaturan › Tipografi lirik atau di bawah Live Output, untuk semua tema. Di sini hanya posisi dan bayangan teks.",
        )}
      </p>
      <label>
        <input
          aria-label="Italic tema"
          type="checkbox"
          checked={value.italic}
          onChange={(e) => set({ italic: e.target.checked })}
        />{" "}
        Italic
      </label>
      <label>
        <input
          aria-label="Underline tema"
          type="checkbox"
          checked={value.underline}
          onChange={(e) => set({ underline: e.target.checked })}
        />{" "}
        Underline
      </label>
      <label>
        {t("Rata horizontal")}
        <select
          aria-label="Rata horizontal"
          value={value.align}
          onChange={(e) =>
            set({ align: e.target.value as Typography["align"] })
          }
        >
          <option value="left">{t("Kiri")}</option>
          <option value="center">{t("Tengah")}</option>
          <option value="right">{t("Kanan")}</option>
        </select>
      </label>
      <label>
        {t("Rata vertikal")}
        <select
          aria-label="Rata vertikal"
          value={value.vertical}
          onChange={(e) =>
            set({ vertical: e.target.value as Typography["vertical"] })
          }
        >
          <option value="top">{t("Atas")}</option>
          <option value="middle">{t("Tengah")}</option>
          <option value="bottom">{t("Bawah")}</option>
        </select>
      </label>
      {numeric(t("Jarak baris"), "lineHeight", 1, 2, 0.05)}
      {(["x", "y", "blur"] as const).map((key) => (
        <label key={key}>
          Shadow {key}
          <input
            aria-label={`Shadow ${key}`}
            type="number"
            min={key === "blur" ? 0 : -12}
            max={12}
            value={value.shadow[key]}
            onChange={(e) =>
              set({
                shadow: { ...value.shadow, [key]: Number(e.target.value) },
              })
            }
          />
        </label>
      ))}
      <label>
        Shadow color
        <input
          aria-label="Shadow color"
          type="color"
          value={value.shadow.color}
          onChange={(e) =>
            set({ shadow: { ...value.shadow, color: e.target.value } })
          }
        />
      </label>
    </div>
  );
}
