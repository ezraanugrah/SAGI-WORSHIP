import { expect, type Page } from "@playwright/test";

/**
 * Open the projector window with Reconnect. If this operator page already
 * opened one (also before a reload), SAGI reconnects that same window instead
 * of opening a new one, so that window is returned.
 */
export async function projectorWindow(page: Page) {
  let existing: Page | undefined;
  for (const other of page.context().pages())
    if (
      other !== page &&
      !other.isClosed() &&
      other.url().includes("#/projector") &&
      (await other.opener()) === page
    )
      existing = other;
  const popup = existing ? null : page.waitForEvent("popup");
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  const output = existing ?? (await popup!);
  await expect(output.getByTestId("projector")).toBeVisible();
  await expect(page.getByTestId("connection-status")).toHaveText("Tersinkron");
  return output;
}
