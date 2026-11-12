import { loadLyricFonts } from "../presentation/fonts";
import { mediaRefs } from "../media/models";
import { readVerifiedAsset } from "../media/assetReader";
import { themeFor } from "../presentation/appearance";
import type { Live } from "../presentation/models";
import { waitEvent } from "../media/validation";
/** Verify/decode the candidate while the established audience frame remains mounted. */
export async function preflight(live: Live | null) {
  if (!live || live.mode === "black") return;
  const frame = live.deck.frames[live.index],
    bg = themeFor(live.deck, live.index)?.spec.background,
    refs =
      frame.kind === "media"
        ? [frame.media]
        : bg?.kind === "image" || bg?.kind === "video"
          ? [bg.asset, bg.poster]
          : [];
  const allowed = mediaRefs(live.deck);
  await loadLyricFonts();
  await document.fonts.ready;
  for (const ref of refs) {
    // Integrity is verified once per asset in this window (see readVerifiedAsset).
    const asset = await readVerifiedAsset(ref, allowed);
    // An asset that already decoded here needs no second probe on later slides.
    if (asset.decoded) continue;
    const url = URL.createObjectURL(asset.blob);
    try {
      if (ref.kind === "image") {
        const image = new Image();
        image.src = url;
        await image.decode();
        if (
          image.naturalWidth !== ref.width ||
          image.naturalHeight !== ref.height
        )
          throw new Error("Dimensi media tidak sesuai");
      } else {
        const video = document.createElement("video");
        video.muted = true;
        try {
          const ready = waitEvent(video, "loadeddata");
          video.src = url;
          await ready;
          if (
            video.videoWidth !== ref.width ||
            video.videoHeight !== ref.height
          )
            throw new Error("Dimensi video tidak sesuai");
        } finally {
          video.removeAttribute("src");
          video.load();
        }
      }
      asset.decoded = true;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
