/**
 * Scroll `el` into view inside its own scrolling list only (never the page,
 * which scrollIntoView would do on phones). Keeps a small margin and stays
 * clear of a sticky list header.
 */
export function revealInPane(el: HTMLElement | null, pane = ".pane-body") {
  const list = el?.closest<HTMLElement>(pane);
  if (!el || !list) return;
  const sticky = list.querySelector<HTMLElement>(".songs-toolbar, .lib-head");
  const margin = 6,
    box = list.getBoundingClientRect(),
    top = box.top + (sticky?.offsetHeight ?? 0) + margin,
    bottom = box.bottom - margin,
    row = el.getBoundingClientRect();
  if (row.top < top) list.scrollTop -= top - row.top;
  else if (row.bottom > bottom)
    list.scrollTop += Math.min(row.bottom - bottom, row.top - top);
}
