import { useEffect, useRef, useState } from "react";
import { WriterGate } from "../data/writer";
import { BackupRepository, type Stage } from "../data/backupRepository";
import { RestoreRepository } from "../data/restoreRepository";
import { HealthRepository } from "../data/healthRepository";
import { type RestorePlan, type RestoreMode } from "../recovery/restorePlan";
import { type Health } from "../recovery/diagnostics";
import { LIMITS } from "../backup/models";
import type { PresentationController } from "../presentation/controller";
export function BackupRecovery({
  gate,
  presentation,
  editable,
}: {
  gate: WriterGate;
  presentation: PresentationController;
  editable: boolean;
}) {
  const [services] = useState(() => ({
    backup: new BackupRepository(gate),
    restore: new RestoreRepository(gate, () =>
      presentation.assertMaintenanceReady(),
    ),
    health: new HealthRepository(gate, () =>
      presentation.assertMaintenanceReady(),
    ),
  }));
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [stage, setStage] = useState<Stage | null>(null),
    [plan, setPlan] = useState<RestorePlan | null>(null),
    [mode, setMode] = useState<RestoreMode>("existing"),
    [confirmed, setConfirmed] = useState(false),
    [health, setHealth] = useState<(Health & { id: string }) | null>(null),
    [stages, setStages] = useState<any[]>([]),
    [candidates, setCandidates] = useState<any[]>([]);
  const abort = useRef<AbortController | null>(null),
    mounted = useRef(true);
  const refresh = async () => {
    const [s, c] = await Promise.all([
      services.backup.stages(),
      services.restore.candidates(),
    ]);
    if (mounted.current) {
      setStages(s);
      setCandidates(c);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);
  const run = async (fn: (signal: AbortSignal) => Promise<string>) => {
    if (busy) return;
    const operation = new AbortController();
    abort.current = operation;
    setBusy(true);
    setStatus("Memproses lokal…");
    try {
      const message = await fn(operation.signal);
      if (mounted.current) setStatus(message);
    } catch (e) {
      if (mounted.current) setStatus((e as Error).message);
    } finally {
      if (mounted.current) {
        setBusy(false);
        void refresh();
      }
      if (abort.current === operation) abort.current = null;
    }
  };
  async function save(blob: Blob, id: string, signal: AbortSignal) {
    const picker = (window as any).showSaveFilePicker;
    if (picker) {
      // Picker must be requested in the click gesture; export action obtains it before hashing below.
      throw new Error(
        "Gunakan pilihan streaming yang dimulai sebelum pemrosesan.",
      );
    }
    if (blob.size > LIMITS.fallback)
      throw new Error(
        "Browser ini memerlukan File System Access untuk backup di atas 256 MiB.",
      );
    if (signal.aborted) throw new DOMException("Dibatalkan", "AbortError");
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `SAGI-${id}.sagibak`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const exportBackup = () => {
    // Acquire the optional save handle synchronously from this user action.
    const picker = (window as any).showSaveFilePicker;
    const handle = picker
      ? picker({
          suggestedName: "SAGI-backup.sagibak",
          types: [
            {
              description: "SAGI Backup",
              accept: { "application/octet-stream": [".sagibak"] },
            },
          ],
        })
      : null;
    void run(async (signal) => {
      const target = handle ? await handle : null;
      const archive = await services.backup.create(signal);
      if (
        archive.manifest.omissions.length &&
        !window.confirm(
          `BACKUP PARSIAL: ${archive.manifest.omissions.join("\n")}\nLanjutkan tanpa konten tersebut?`,
        )
      )
        return "Backup parsial dibatalkan; workspace tidak berubah.";
      if (target) {
        const writable = await target.createWritable();
        try {
          const reader = archive.blob.stream().getReader();
          while (true) {
            if (signal.aborted)
              throw new DOMException("Dibatalkan", "AbortError");
            const { done, value } = await reader.read();
            if (done) break;
            await writable.write(value);
          }
          await writable.close();
        } catch (e) {
          await writable.abort().catch(() => {});
          throw e;
        }
      } else await save(archive.blob, archive.manifest.id, signal);
      return `${archive.manifest.complete ? "Backup lengkap" : "Backup PARSIAL"} diserahkan ke browser. Buka kembali file melalui Verifikasi; unduhan saja belum membuktikan file tersimpan.`;
    });
  };
  return (
    <section className="panel settings-panel">
      <div className="panel-title">
        <span>Backup & Recovery</span>
      </div>
      <div className="settings-content backup-recovery">
        <p>
          Semua proses lokal dan offline. Backup berisi data pribadi; simpan
          file di tempat aman. Tidak dienkripsi.
        </p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={exportBackup}
        >
          Buat backup .sagibak
        </button>
        <label>
          File backup
          <input
            aria-label="File backup"
            type="file"
            accept=".sagibak"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setStage(null);
              setPlan(null);
              setConfirmed(false);
            }}
          />
        </label>
        <button
          className="button secondary"
          disabled={busy || !file}
          onClick={() =>
            void run(async (signal) => {
              const a = await services.backup.verify(file!, signal);
              return `Verifikasi lulus: ${a.rows.length} record; ${a.manifest.complete ? "lengkap" : "PARSIAL: " + a.manifest.omissions.join("; ")}`;
            })
          }
        >
          Verifikasi file
        </button>
        <button
          className="button secondary"
          disabled={busy || !file || !editable}
          onClick={() =>
            void run(async (signal) => {
              const s = await services.backup.stage(file!, signal);
              setStage(s);
              setPlan(null);
              return `Staging tervalidasi. ${s.manifest.complete ? "Lengkap" : "PARSIAL: " + s.manifest.omissions.join("; ")}`;
            })
          }
        >
          Siapkan restore
        </button>
        {stage && (
          <>
            <p>
              {stage.manifest.complete
                ? "Arsip lengkap menurut manifest tervalidasi."
                : "BACKUP PARSIAL — konten berikut tidak tersedia dalam restore:"}
            </p>
            {!stage.manifest.complete && (
              <ul>
                {stage.manifest.omissions.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
            <label>
              Mode restore
              <select
                aria-label="Mode restore"
                disabled={busy}
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as RestoreMode);
                  setPlan(null);
                  setConfirmed(false);
                }}
              >
                <option value="fresh">Workspace kosong</option>
                <option value="existing">
                  Merge · pertahankan data tujuan
                </option>
                <option value="both">Merge · simpan keduanya jika aman</option>
              </select>
            </label>
            <button
              className="button secondary"
              disabled={busy || !editable}
              onClick={() =>
                void run(async () => {
                  const p = await services.restore.preview(stage, mode);
                  setPlan(p);
                  setConfirmed(false);
                  return "Periksa dampak restore sebelum konfirmasi.";
                })
              }
            >
              Tinjau konflik restore
            </button>
          </>
        )}
        {plan && (
          <>
            <p className="field-help">
              Konfirmasi menyatakan Anda berhak menyimpan, memproyeksikan dan
              memulihkan konten ini pada profil tujuan sesuai lisensinya. Merge
              mempertahankan pengaturan tujuan yang sudah ada. Perubahan tujuan
              atau End Session mewajibkan preview ulang.
            </p>
            <div className="backup-impact" aria-label="Dampak restore">
              <ul>
                {plan.summary.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Saya memahami dampak restore dan pilihan konflik
            </label>
            <button
              className="button primary"
              disabled={busy || !editable || !confirmed}
              onClick={() =>
                void run(async (signal) => {
                  await services.restore.publish(plan.id, confirmed, signal);
                  setPlan(null);
                  setConfirmed(false);
                  window.dispatchEvent(new Event("sagi-restored"));
                  return "Restore atomik selesai. Muat ulang aplikasi sebelum mengedit atau Resume; tidak ada output otomatis.";
                })
              }
            >
              Publikasikan restore
            </button>
          </>
        )}
        <button
          className="button secondary"
          disabled={busy || !editable}
          onClick={() =>
            void run(async () => {
              if (
                !window.confirm(
                  "End Session: Black, tutup projector milik sesi ini, dan hentikan LIVE. Checkpoint tetap dipertahankan.",
                )
              )
                return "End Session dibatalkan.";
              await presentation.endSession();
              setPlan(null);
              setConfirmed(false);
              return "Sesi berakhir dan projector ditutup. Restore/repair dapat dipublikasikan setelah validasi.";
            })
          }
        >
          End Session untuk restore / repair
        </button>
        <p className="field-help">
          Black bukan End Session. Restore tidak mengaktifkan LIVE. Tutup juga
          jendela output lama yang tidak dimiliki sesi ini.
        </p>
        {candidates.map((c) => (
          <div key={c.id}>
            <p>Kandidat recovery {c.createdAt}</p>
            <button
              className="button secondary"
              disabled={busy || !editable}
              onClick={() =>
                void run(async (signal) => {
                  if (
                    !window.confirm(
                      "Pilih checkpoint ini untuk tawaran Resume? Checkpoint sebelumnya dipertahankan sebagai kandidat lain; tidak ada Go Live otomatis.",
                    )
                  )
                    return "Pemilihan dibatalkan";
                  await services.restore.activateCandidate(c.id, true, signal);
                  await presentation.loadRecovery();
                  return "Kandidat tersedia untuk Resume/Discard eksplisit. Video tetap paused.";
                })
              }
            >
              Pilih kandidat recovery
            </button>
          </div>
        ))}
        <hr />
        <h3>Storage Health</h3>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void run(async (signal) => {
              setHealth(await services.health.scan(false, signal));
              return "Scan metadata selesai; bukan verifikasi semua byte.";
            })
          }
        >
          Scan metadata
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void run(async (signal) => {
              setHealth(await services.health.scan(true, signal));
              return "Scan integritas penuh selesai.";
            })
          }
        >
          Scan integritas penuh
        </button>
        {health && (
          <>
            <p>
              {(health.bytes / 1048576).toFixed(1)} MiB payload ·{" "}
              {health.full ? "hash diperiksa" : "metadata saja"}
            </p>
            <div className="backup-impact">
              {health.findings.map((f) => (
                <div key={f.id}>
                  <p>
                    {f.severity}: {f.message}
                  </p>
                  {f.repair && (
                    <button
                      className="button secondary"
                      disabled={busy || !editable}
                      onClick={() =>
                        void run(async (signal) => {
                          if (
                            !window.confirm(
                              `Bangun ulang hanya pin ${f.id}? Tidak ada bytes dihapus.`,
                            )
                          )
                            return "Repair dibatalkan";
                          await services.health.repair(
                            health.id,
                            f.id,
                            true,
                            signal,
                          );
                          setHealth(null);
                          return "Pin diperbaiki secara atomik. Jalankan scan ulang.";
                        })
                      }
                    >
                      Tinjau & konfirmasi repair pin
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {stages.length > 0 && (
          <>
            <h3>Staging tersimpan</h3>
            <p>
              Gangguan tidak memublikasikan data parsial. Verifikasi ulang file
              untuk melanjutkan; penghapusan staging selalu eksplisit.
            </p>
            {stages.map((s) => (
              <div key={s.id}>
                <span>{s.id}</span>
                <button
                  className="button secondary"
                  disabled={busy || !editable}
                  onClick={() =>
                    void run(async () => {
                      if (
                        !window.confirm(
                          "Hapus hanya database staging ini? Workspace tidak dihapus.",
                        )
                      )
                        return "Dibatalkan";
                      await services.backup.removeStage(s.id);
                      if (stage?.name === s.id) {
                        setStage(null);
                        setPlan(null);
                      }
                      return "Staging dihapus.";
                    })
                  }
                >
                  Hapus staging
                </button>
              </div>
            ))}
          </>
        )}
        <p role="status">{status}</p>
        {busy && (
          <button
            className="button secondary"
            onClick={() => abort.current?.abort()}
          >
            Batalkan operasi
          </button>
        )}
      </div>
    </section>
  );
}
