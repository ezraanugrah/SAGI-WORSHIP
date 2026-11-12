import { Languages } from "lucide-react";
import { setLang, t, useLang } from "../i18n";
/** Top-bar language switch: Indonesian ⇄ English (this laptop only). */
export function LanguageToggle() {
  const lang = useLang();
  const next = lang === "id" ? "en" : "id";
  return (
    <button
      type="button"
      className="lang-toggle"
      data-testid="language-toggle"
      aria-label={
        lang === "id"
          ? "Ganti bahasa ke English"
          : "Switch language to Indonesian"
      }
      title={t("Bahasa: Indonesia / English")}
      onClick={() => setLang(next)}
    >
      <Languages size={16} aria-hidden="true" />
      <span>{lang.toUpperCase()}</span>
    </button>
  );
}
