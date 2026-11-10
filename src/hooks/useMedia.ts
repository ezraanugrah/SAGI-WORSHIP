import { useEffect, useRef, useState } from "react";
import { WriterGate } from "../data/writer";
import { MediaRepository } from "../data/mediaRepository";
import { prepareFile } from "../media/importCoordinator";
import type { MediaAsset } from "../media/models";
export function useMedia(gate: WriterGate) {
  const [repo] = useState(() => new MediaRepository(gate)),
    [status, setStatus] = useState(""),
    [working, setWorking] = useState(false),
    job = useRef<AbortController | null>(null),
    generation = useRef(0);
  function cancel() {
    generation.current++;
    job.current?.abort();
    job.current = null;
    setWorking(false);
    setStatus("Impor dibatalkan; file yang sudah selesai tetap tersimpan.");
  }
  useEffect(() => {
    const stop = gate.subscribe(() => {
      if (!gate.active && job.current) cancel();
    });
    return () => {
      stop();
      generation.current++;
      job.current?.abort();
    };
  }, [gate]);
  async function importFiles(files: File[]) {
    cancel();
    const token = ++generation.current,
      abort = new AbortController();
    job.current = abort;
    setWorking(true);
    const reports: string[] = [];
    try {
      const ticket = gate.ticket();
      for (let i = 0; i < files.length; i++) {
        if (token !== generation.current) break;
        gate.assert(ticket);
        setStatus(`Memvalidasi ${i + 1}/${files.length}: ${files[i].name}`);
        try {
          const prepared = await prepareFile(files[i], abort.signal);
          const estimate = await navigator.storage?.estimate();
          if (
            estimate?.quota &&
            estimate.usage !== undefined &&
            estimate.quota - estimate.usage <
              prepared.asset.original.size * 2 + 1048576
          )
            throw new Error(
              "Storage tidak mencukupi; data lama dipertahankan.",
            );
          if (token !== generation.current) break;
          await repo.import(prepared, abort.signal, ticket);
          reports.push(`${files[i].name}: tersimpan offline`);
        } catch (e) {
          if (abort.signal.aborted) break;
          reports.push(`${files[i].name}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      reports.push((e as Error).message);
    } finally {
      if (token === generation.current) {
        job.current = null;
        setWorking(false);
        setStatus(reports.join(" · "));
      }
    }
  }
  /**
   * Import one image for a theme background and return it. An identical image
   * already in the Media library is reused instead of being rejected.
   */
  async function importImage(file: File): Promise<MediaAsset> {
    setWorking(true);
    setStatus(`Memvalidasi ${file.name}`);
    try {
      const prepared = await prepareFile(file);
      if (prepared.asset.kind !== "image")
        throw new Error("Pilih file gambar (JPG, PNG, atau WebP).");
      const existing = (await repo.list()).assets.find(
        (a) => a.original.digest === prepared.asset.original.digest,
      );
      if (existing) {
        setStatus(`${file.name}: sudah ada di Media, dipakai ulang`);
        return existing;
      }
      const estimate = await navigator.storage?.estimate();
      if (
        estimate?.quota &&
        estimate.usage !== undefined &&
        estimate.quota - estimate.usage <
          prepared.asset.original.size * 2 + 1048576
      )
        throw new Error("Storage tidak mencukupi; data lama dipertahankan.");
      const asset = await repo.import(prepared);
      setStatus(`${file.name}: tersimpan offline`);
      return asset;
    } catch (e) {
      setStatus(`${file.name}: ${(e as Error).message}`);
      throw e;
    } finally {
      setWorking(false);
    }
  }
  return { repo, status, working, importFiles, importImage, cancel };
}
