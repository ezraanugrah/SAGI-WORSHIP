/** The app's media and theme stores, as the library sync sees them. */
import type { MediaRepository } from "../data/mediaRepository";
import type { ThemeRepository } from "../data/themeRepository";
import type { LibraryRepos } from "./librarySync";

export function libraryRepos(
  media: MediaRepository,
  themes: ThemeRepository,
): LibraryRepos {
  return {
    media: {
      list: async () => (await media.list()).assets,
      payload: (ref) => media.payload(ref),
      importRemote: async (asset, payloads) => {
        try {
          await media.import({ asset, payloads });
        } catch (e) {
          const message = (e as Error).message;
          // Same file already here, or deleted here earlier (that deletion
          // is then sent to the other laptops): nothing to import.
          if (/File identik|kedaluwarsa setelah penghapusan/.test(message))
            return;
          throw e;
        }
      },
      remove: async (id, digest) => {
        await media.delete(id, digest);
      },
    },
    themes: {
      list: async () =>
        (await themes.list()).themes.filter((t) => t.id.startsWith("theme:")),
      apply: async (id, name, spec) => {
        const current = (await themes.list()).themes.find((t) => t.id === id);
        await themes.save(id, name, spec, current?.revision ?? 0);
      },
    },
  };
}
