import { expect, type Locator, type Page } from "@playwright/test";

/** "Slide X of N" under the Preview Output monitor. */
export function previewPosition(scope: Page | Locator) {
  return scope.getByTestId("preview-position");
}

/** Wait until slides are prepared in Preview. */
export async function previewReady(scope: Page | Locator) {
  await expect(previewPosition(scope)).toHaveText(/^Slide \d+ of \d+$/);
}

/** Open "Edit teks" under Live Output for the slide on screen. */
export async function openTextEditor(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Edit teks LIVE" });
  if (!(await dialog.isVisible()))
    await page
      .getByRole("region", { name: "LIVE projector control" })
      .getByRole("button", { name: "Edit teks", exact: true })
      .click();
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Close the "Edit teks" window. */
export async function closeTextEditor(page: Page) {
  await page
    .getByRole("button", { name: "Tutup edit teks", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Edit teks LIVE" }),
  ).toHaveCount(0);
}

/** Replace the text of the LIVE slide through "Edit teks". */
export async function editLiveText(page: Page, text: string) {
  const dialog = await openTextEditor(page);
  await dialog.getByLabel("Teks slide LIVE", { exact: true }).fill(text);
  await dialog
    .getByRole("button", { name: "Terapkan ke Live", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
}
