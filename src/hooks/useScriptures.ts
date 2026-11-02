import { useEffect, useState, useSyncExternalStore } from "react";
import { WriterGate } from "../data/writer";
import { ScriptureRepository } from "../data/scriptureRepository";
import { ImportCoordinator } from "../scriptures/importCoordinator";
export function useScriptureServices(gate: WriterGate) {
  const [repo] = useState(() => new ScriptureRepository(gate)),
    [importer] = useState(() => new ImportCoordinator(gate, repo));
  const importState = useSyncExternalStore(
    importer.subscribe,
    importer.snapshot,
  );
  useEffect(() => {
    const stop = importer.start();
    return () => {
      stop();
      importer.dispose();
    };
  }, [importer]);
  return { scriptureRepo: repo, importer, importState };
}
