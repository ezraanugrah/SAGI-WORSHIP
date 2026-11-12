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
        Lirik selalu Extra Bold, putih, dengan outline hitam. Font, ukuran, dan
        tebal outline diatur di Pengaturan › Tipografi lirik atau di bawah Live
        Output, untuk semua tema. Di sini hanya posisi dan bayangan teks.
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
        Rata horizontal
        <select
          aria-label="Rata horizontal"
          value={value.align}
          onChange={(e) =>
            set({ align: e.target.value as Typography["align"] })
          }
        >
          <option value="left">Kiri</option>
          <option value="center">Tengah</option>
          <option value="right">Kanan</option>
        </select>
      </label>
      <label>
        Rata vertikal
        <select
          aria-label="Rata vertikal"
          value={value.vertical}
          onChange={(e) =>
            set({ vertical: e.target.value as Typography["vertical"] })
          }
        >
          <option value="top">Atas</option>
          <option value="middle">Tengah</option>
          <option value="bottom">Bawah</option>
        </select>
      </label>
      {numeric("Jarak baris", "lineHeight", 1, 2, 0.05)}
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
