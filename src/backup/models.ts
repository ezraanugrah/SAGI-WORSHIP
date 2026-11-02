import { stores } from "../db";
export const LIMITS = {
  archive: 2 * 1024 ** 3,
  manifest: 8 * 1024 ** 2,
  metadata: 64 * 1024 ** 2,
  record: 17 * 1024 ** 2,
  records: 250000,
  payloads: 4096,
  chunk: 4 * 1024 ** 2,
  fallback: 256 * 1024 ** 2,
};
export type Store = (typeof stores)[number];
export type Row = { store: Store; value: Record<string, any> };
export type Snapshot = Row[];
export type Entry = {
  store: Store;
  id: string;
  offset: number;
  length: number;
  hash: string;
  kind: "json" | "chunk";
  index?: number;
};
export type Manifest = {
  format: "sagi-backup";
  version: 1;
  id: string;
  createdAt: string;
  appVersion: string;
  entries: Entry[];
  bytes: number;
  complete: boolean;
  omissions: string[];
};
export type Archive = { manifest: Manifest; rows: Snapshot };
export const checkCancel = (signal?: AbortSignal) => {
  if (signal?.aborted)
    throw new DOMException("Operasi dibatalkan", "AbortError");
};
export function fail(message: string): never {
  throw new Error(`Backup: ${message}`);
}
export const hashPattern = /^[a-f0-9]{64}$/;
