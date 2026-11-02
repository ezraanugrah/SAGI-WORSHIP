import { useState, useEffect, useCallback, useRef } from "react";
import { ThemeRepository } from "../data/themeRepository";
import { WriterGate } from "../data/writer";
import { advancedDefaults, type ThemeSnapshot } from "../themes/models";
export function useThemes(gate: WriterGate) {
  const [repo] = useState(() => new ThemeRepository(gate)),
    [themes, setThemes] = useState<ThemeSnapshot[]>([]),
    [settings, setSettings] = useState(advancedDefaults),
    [error, setError] = useState(""),
    generation = useRef(0);
  const reload = useCallback(async () => {
    const token = ++generation.current;
    try {
      const [library, config] = await Promise.all([
        repo.list(),
        repo.settings(),
      ]);
      if (token !== generation.current) return;
      setThemes(library.themes);
      setSettings(config);
      setError(library.issues.join(" "));
    } catch (e) {
      if (token === generation.current) setError((e as Error).message);
    }
  }, [repo]);
  useEffect(() => {
    void reload();
    const fn = () => void reload();
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel("sagi-library-changes");
      channel.addEventListener("message", fn);
    } catch {}
    window.addEventListener("sagi-library-changed", fn);
    window.addEventListener("focus", fn);
    return () => {
      generation.current++;
      channel?.close();
      window.removeEventListener("sagi-library-changed", fn);
      window.removeEventListener("focus", fn);
    };
  }, [reload]);
  return { repo, themes, settings, error, reload };
}
