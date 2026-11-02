import { parseDataset } from "./importFormat";
self.onmessage = async (event: MessageEvent<{ jobId: string; file: File }>) => {
  try {
    const { jobId, file } = event.data;
    const prepared = await parseDataset(
      new Uint8Array(await file.arrayBuffer()),
    );
    self.postMessage({ jobId, prepared });
  } catch (e) {
    self.postMessage({ jobId: event.data.jobId, error: (e as Error).message });
  }
};
