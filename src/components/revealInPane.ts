/**
 * Scroll `el` into view inside its own pane list only, so choosing a slide
 * never scrolls the page itself (scrollIntoView would on phones).
 */
export function revealInPane(el: HTMLElement | null) {
  const pane = el?.closest<HTMLElement>(".pane-body");
  if (!el || !pane) return;
  const box = pane.getBoundingClientRect(),
    row = el.getBoundingClientRect();
  if (row.top < box.top) pane.scrollTop -= box.top - row.top;
  else if (row.bottom > box.bottom)
    pane.scrollTop += Math.min(row.bottom - box.bottom, row.top - box.top);
}
