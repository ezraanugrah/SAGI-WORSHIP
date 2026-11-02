type TrackedTransaction = { abort(): void; done: Promise<unknown> };

/** One authority per operator window. No mutation is allowed before a real lock grant. */
export class WriterGate {
  private epoch = 0;
  private owned = false;
  private maintenance = false;
  get busy() {
    return this.maintenance;
  }
  async exclusive<T>(operation: (permit: number) => Promise<T>): Promise<T> {
    this.assert();
    if (this.transactions.size)
      throw new Error("Penulisan masih berjalan. Tunggu lalu coba lagi.");
    this.epoch++;
    this.maintenance = true;
    this.notify();
    try {
      return await operation(-this.epoch);
    } finally {
      this.maintenance = false;
      this.notify();
    }
  }
  private transactions = new Set<TrackedTransaction>();
  private release?: () => void;
  private cancel?: () => void;
  private listeners = new Set<() => void>();
  message = "Memeriksa hak tulis…";
  get active() {
    return this.owned;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private notify() {
    this.listeners.forEach((fn) => fn());
  }
  ticket() {
    this.assert();
    return this.epoch;
  }
  assert(ticket = this.epoch) {
    if (
      !this.owned ||
      (this.maintenance ? ticket !== -this.epoch : ticket !== this.epoch)
    )
      throw new Error(
        "Workspace hanya baca atau hak tulis telah berakhir. Muat ulang untuk mencoba lagi.",
      );
  }
  track(tx: TrackedTransaction, ticket: number) {
    this.assert(ticket);
    this.transactions.add(tx);
    void tx.done.finally(() => this.transactions.delete(tx)).catch(() => {});
  }
  revoke(
    message = "Hak tulis berakhir. Tab ini hanya baca; muat ulang untuk mencoba lagi.",
  ) {
    this.owned = false;
    this.epoch++;
    this.message = message;
    for (const tx of this.transactions) {
      try {
        tx.abort();
      } catch {
        /* already finished */
      }
    }
    this.transactions.clear();
    const release = this.release;
    this.release = undefined;
    release?.();
    this.notify();
  }
  start(locks: LockManager | undefined = navigator.locks) {
    let cancelled = false;
    this.cancel?.();
    const cleanup = () => {
      cancelled = true;
      this.revoke();
      this.release?.();
      this.release = undefined;
    };
    this.cancel = cleanup;
    if (!locks) {
      this.revoke("Browser tidak mendukung Web Locks. Workspace hanya baca.");
      return cleanup;
    }
    void locks
      .request("sagi-workspace-writer", { ifAvailable: true }, async (lock) => {
        if (cancelled) return;
        if (!lock) {
          this.revoke(
            "Workspace sedang diedit pada tab lain. Tab ini hanya baca. Tutup tab lain, lalu muat ulang untuk mengedit.",
          );
          return;
        }
        this.epoch++;
        this.owned = true;
        this.message = "";
        this.notify();
        try {
          await new Promise<void>((resolve) => {
            this.release = resolve;
          });
        } finally {
          if (!cancelled && this.owned) this.revoke();
        }
      })
      .catch(() => {
        if (!cancelled)
          this.revoke(
            "Kepemilikan Web Lock hilang. Penulisan dibatalkan; tab ini hanya baca.",
          );
      });
    return cleanup;
  }
}
