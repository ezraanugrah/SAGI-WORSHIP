import { ScriptureRepository } from "../data/scriptureRepository";
import { searchNormalize } from "./references";
import type { Translation, Verse } from "./models";
type Result = { total: number; results: Verse[] };
export class SearchClient {
  private worker: Worker | null = null;
  private generation = 0;
  private request = 0;
  private datasetKey = "";
  private loading: Promise<void> | null = null;
  private fallback = false;
  private pending: {
    id: number;
    done: (value: Result) => void;
    error: (message: string) => void;
  } | null = null;
  cancelQuery() {
    this.request++;
    this.pending = null;
  }
  cancel() {
    this.generation++;
    this.cancelQuery();
    this.worker?.terminate();
    this.worker = null;
    this.datasetKey = "";
    this.loading = null;
    this.fallback = false;
  }
  private async load(
    repo: ScriptureRepository,
    t: Translation,
    generation: number,
  ) {
    let bytes = 0,
      after: string | null = null,
      count = 0;
    try {
      this.worker = new Worker(new URL("./search.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      this.fallback = true;
      return;
    }
    const worker = this.worker;
    worker.onmessage = (event) => {
      const value = event.data,
        pending = this.pending;
      if (
        generation === this.generation &&
        pending?.id === this.request &&
        value.requestId === pending.id &&
        value.generation === String(generation)
      )
        pending.done(value);
    };
    worker.onerror = () =>
      this.pending?.error("Worker pencarian gagal. Muat ulang data.");
    while (true) {
      const rows = await repo.batch(t, after);
      if (generation !== this.generation) return;
      if (!rows.length) break;
      count += rows.length;
      bytes += new TextEncoder().encode(JSON.stringify(rows)).byteLength * 2;
      if (bytes > 64 * 1024 * 1024) {
        worker.terminate();
        this.worker = null;
        this.fallback = true;
        return;
      }
      worker.postMessage({
        type: "load",
        generation: String(generation),
        rows,
      });
      after = rows.at(-1)!.id;
    }
    if (count !== t.verseCount)
      throw new Error("Dataset tidak lengkap; pencarian dihentikan.");
  }
  async query(
    repo: ScriptureRepository,
    t: Translation,
    query: string,
    offset: number,
    done: (value: Result) => void,
    error: (message: string) => void,
  ) {
    const key = `${t.id}:${t.contentHash}`;
    if (key !== this.datasetKey) {
      this.cancel();
      this.datasetKey = key;
      this.loading = this.load(repo, t, this.generation);
    }
    const generation = this.generation,
      requestId = ++this.request;
    this.pending = { id: requestId, done, error };
    try {
      await this.loading;
      if (generation !== this.generation || requestId !== this.request) return;
      if (this.fallback) {
        const result = await this.scan(
          repo,
          t,
          query,
          offset,
          generation,
          requestId,
        );
        if (result && requestId === this.request) done(result);
        return;
      }
      this.worker!.postMessage({
        type: "search",
        generation: String(generation),
        requestId,
        query,
        offset,
      });
    } catch (e) {
      if (generation === this.generation && requestId === this.request)
        error((e as Error).message);
    }
  }
  private async scan(
    repo: ScriptureRepository,
    t: Translation,
    query: string,
    offset: number,
    generation: number,
    request: number,
  ): Promise<Result | null> {
    let after: string | null = null,
      total = 0,
      count = 0;
    const results: Verse[] = [],
      q = searchNormalize(query);
    while (true) {
      const rows = await repo.batch(t, after);
      if (generation !== this.generation || request !== this.request)
        return null;
      if (!rows.length) break;
      count += rows.length;
      for (const v of rows)
        if (q && searchNormalize(v.text).includes(q)) {
          if (total >= offset && results.length < 100) results.push(v);
          total++;
        }
      after = rows.at(-1)!.id;
    }
    if (count !== t.verseCount) throw new Error("Dataset tidak lengkap.");
    return { total, results };
  }
}
