import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  fileKey,
  inLibrary,
  isWatchable,
  permission,
  saveWatch,
  scanFolder,
  type FolderHandle,
} from "./folderWatch";
import type { MediaAsset } from "./models";

/** A fake folder: name -> [size, lastModified]. */
function folder(
  files: Record<string, [number, number]>,
  access: "granted" | "prompt" = "granted",
): FolderHandle {
  return {
    kind: "directory",
    name: "Downloads",
    async *values() {
      yield { kind: "directory", name: "Foto lama" };
      for (const [name, [size, lastModified]] of Object.entries(files))
        yield {
          kind: "file",
          name,
          getFile: async () =>
            new File([new Uint8Array(size)], name, { lastModified }),
        };
    },
    queryPermission: async () => access,
    requestPermission: async () => "granted",
  };
}

describe("watched folder", () => {
  it("only lists supported, finished, visible media files, newest first", async () => {
    const files = await scanFolder(
      folder({
        "lama.png": [10, 1000],
        "Ibadah.MP4": [20, 3000],
        "slide.pdf": [30, 2000],
        "film.mp4.crdownload": [40, 4000],
        "film.webm.part": [40, 4000],
        ".rahasia.png": [5, 5000],
        "catatan.txt": [5, 5000],
        "deck.pptx": [5, 5000],
        "kosong.jpg": [0, 6000],
      }),
    );
    expect(files.map((f) => f.name)).toEqual([
      "Ibadah.MP4",
      "slide.pdf",
      "lama.png",
    ]);
    expect((await files[0].read()).size).toBe(20);
    expect(isWatchable("foto.JPEG")).toBe(true);
    expect(isWatchable("video.webm.crdownload")).toBe(false);
  });
  it("knows which files are already in the library by name and size", () => {
    const asset = {
      filename: "lama.png",
      original: { size: 10 },
    } as unknown as MediaAsset;
    expect(inLibrary({ name: "lama.png", size: 10 }, [asset])).toBe(true);
    expect(inLibrary({ name: "lama.png", size: 11 }, [asset])).toBe(false);
    expect(fileKey({ name: "a.png", size: 1, lastModified: 2 })).toBe(
      "a.png|1|2",
    );
  });
  it("asks for access again only when told to", async () => {
    expect(await permission(folder({}, "prompt"))).toBe("prompt");
    expect(await permission(folder({}, "prompt"), true)).toBe("granted");
    expect(await permission(folder({}))).toBe("granted");
  });
  it("reports when a folder cannot be remembered across restarts", async () => {
    // A plain object with functions cannot be stored; a real browser handle can.
    expect(
      await saveWatch({ handle: folder({}), since: 0, auto: false }),
    ).toBe(false);
  });
});
