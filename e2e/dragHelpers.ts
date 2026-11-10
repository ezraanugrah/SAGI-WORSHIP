import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Drag a song row (or a media card's list item) into the active Week, the
 * same way a mouse drag does, without depending on scrolling mid-drag.
 */
export async function dragToWeek(source: Locator) {
  const page = source.page();
  await expect(source).toHaveAttribute("draggable", "true");
  // Drops are ignored while the Week is saving.
  await expect(
    page.getByRole("region", { name: "Jadwal ibadah" }),
  ).not.toHaveAttribute("aria-busy", "true");
  const items = page.getByTestId("schedule-item"),
    before = await items.count();
  const zone = page.getByTestId("week-drop-zone");
  const data = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer: data });
  await zone.dispatchEvent("dragover", { dataTransfer: data });
  await zone.dispatchEvent("drop", { dataTransfer: data });
  await data.dispose();
  await expect(items).toHaveCount(before + 1);
}

/** The draggable list item that holds the media card for `title`. */
export function mediaCard(page: Page, title: string) {
  return page
    .getByRole("list", { name: "Daftar media" })
    .getByRole("listitem")
    .filter({
      has: page.getByRole("button", {
        name: `Pilih media ${title}`,
        exact: true,
      }),
    });
}
