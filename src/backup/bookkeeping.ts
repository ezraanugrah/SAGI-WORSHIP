/** Operational receipts/journals contain no library content and are never recursively archived. */
export function operationalRecord(v: any): boolean {
  if (
    !v ||
    v.format !== 1 ||
    typeof v.id !== "string" ||
    !Number.isFinite(Date.parse(v.createdAt))
  )
    return false;
  const exact = (keys: string[]) =>
    Object.keys(v).length === keys.length &&
    keys.every((k) => Object.hasOwn(v, k));
  if (v.kind === "stage")
    return (
      /^sagi-phase7-stage-[a-f0-9-]{36}$/.test(v.id) &&
      ["preparing", "ready"].includes(v.state) &&
      /^[a-f0-9]{64}$/.test(v.expectedFingerprint) &&
      Number.isSafeInteger(v.count) &&
      v.count >= 0 &&
      typeof v.manifestId === "string" &&
      exact([
        "id",
        "format",
        "kind",
        "state",
        "manifestId",
        "expectedFingerprint",
        "count",
        "createdAt",
      ])
    );
  if (v.kind === "receipt")
    return (
      v.id.startsWith("phase7:receipt:") &&
      typeof v.stage === "string" &&
      ["fresh", "existing", "both"].includes(v.mode) &&
      Number.isSafeInteger(v.count) &&
      v.count >= 0 &&
      exact(["id", "format", "kind", "stage", "mode", "createdAt", "count"])
    );
  if (v.kind === "repair")
    return (
      v.id.startsWith("phase7:repair:") &&
      typeof v.owner === "string" &&
      exact(["id", "format", "kind", "owner", "createdAt"])
    );
  return false;
}
export const includeSnapshotRecord = (store: string, value: any) =>
  store !== "backup_manifest" || !operationalRecord(value);
