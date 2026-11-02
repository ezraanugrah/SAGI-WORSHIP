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
    key: "size" | "lineHeight" | "lines" | "minSize",
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
        onChange={(e) =>
          set(
            key === "size"
              ? {
                  size: Number(e.target.value),
                  minSize: Math.min(value.minSize, Number(e.target.value)),
                }
              : { [key]: Number(e.target.value) },
          )
        }
      />
    </label>
  );
  return (
    <div className="typography-editor">
      <label>
        Font tema
        <select
          aria-label="Font tema"
          value={value.font}
          onChange={(e) => set({ font: e.target.value as Typography["font"] })}
        >
          {["Arial", "Georgia", "Verdana"].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      {numeric("Ukuran tema", "size", 24, 120)}
      <label>
        Bobot teks
        <select
          aria-label="Bobot teks"
          value={value.weight}
          onChange={(e) => set({ weight: Number(e.target.value) as 400 | 700 })}
        >
          <option value={400}>Normal</option>
          <option value={700}>Bold</option>
        </select>
      </label>
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
        Warna teks
        <input
          aria-label="Warna teks"
          type="color"
          value={value.color}
          onChange={(e) => set({ color: e.target.value })}
        />
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
      {numeric("Maksimum baris", "lines", 1, 12)}
      <label>
        Text fitting
        <select
          aria-label="Text fitting"
          value={value.fit}
          onChange={(e) => set({ fit: e.target.value as Typography["fit"] })}
        >
          <option value="paginate">Paginasi</option>
          <option value="shrink">Shrink terbatas lalu paginasi</option>
        </select>
      </label>
      {numeric("Ukuran minimum", "minSize", 24, value.size)}
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <label key={side}>
          Margin {side}
          <input
            aria-label={`Margin ${side}`}
            type="number"
            min={0}
            max={20}
            value={value.margins[side]}
            onChange={(e) =>
              set({
                margins: { ...value.margins, [side]: Number(e.target.value) },
              })
            }
          />
        </label>
      ))}
      <label>
        Outline width
        <input
          aria-label="Outline width"
          type="number"
          min={0}
          max={4}
          step={0.5}
          value={value.outline.width}
          onChange={(e) =>
            set({
              outline: { ...value.outline, width: Number(e.target.value) },
            })
          }
        />
      </label>
      <label>
        Outline color
        <input
          aria-label="Outline color"
          type="color"
          value={value.outline.color}
          onChange={(e) =>
            set({ outline: { ...value.outline, color: e.target.value } })
          }
        />
      </label>
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
