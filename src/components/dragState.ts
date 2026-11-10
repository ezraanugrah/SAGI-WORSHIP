/**
 * Marks the page while a song or media card is being dragged, so the Jadwal
 * Ibadah can show where to drop it (CSS: :root[data-sagi-drag]).
 */
function end() {
  delete document.documentElement.dataset.sagiDrag;
}
export function startDrag(kind: "song" | "media") {
  // Deferred: changing styles inside dragstart can cancel the drag in Chrome.
  setTimeout(() => {
    document.documentElement.dataset.sagiDrag = kind;
  }, 0);
  window.addEventListener("dragend", end, { once: true, capture: true });
  window.addEventListener("drop", end, { once: true, capture: true });
}
export const endDrag = end;
