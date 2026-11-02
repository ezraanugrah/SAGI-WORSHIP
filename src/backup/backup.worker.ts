import { decodeArchive } from "./container";
import { validateRows, portableRows } from "./validation";
self.onmessage = async (event: MessageEvent<{ file: Blob }>) => {
  try {
    const archive = await decodeArchive(event.data.file);
    await validateRows(archive.rows);
    if (portableRows(archive.rows).omissions.length)
      throw new Error("Arsip mengandung Scripture tanpa izin ekspor");
    self.postMessage({ archive });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
