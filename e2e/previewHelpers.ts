import { expect, type Locator, type Page } from "@playwright/test";

/** "Slide X of N" under the Preview Output monitor. */
export function previewPosition(scope: Page | Locator) {
  return scope.getByTestId("preview-position");
}

/** Wait until slides are prepared in Preview. */
export async function previewReady(scope: Page | Locator) {
  await expect(previewPosition(scope)).toHaveText(/^Slide \d+ of \d+$/);
}

/** Open the "Edit teks" window for the current Preview slide. */
export async function openTextEditor(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Edit teks sebelum LIVE" });
  if (!(await dialog.isVisible()))
    await page.getByRole("button", { name: "Edit teks", exact: true }).click();
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Close the "Edit teks" window (no unapplied changes expected). */
export async function closeTextEditor(page: Page) {
  await page
    .getByRole("button", { name: "Tutup edit teks", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Edit teks sebelum LIVE" }),
  ).toHaveCount(0);
}
