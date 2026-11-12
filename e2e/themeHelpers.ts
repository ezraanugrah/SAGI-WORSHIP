import { expect, type Page } from "@playwright/test";
import { imageFile, videoFile } from "./mediaFixtures";

/** The single action left in the theme details. */
export const APPLY_THEME = "Terapkan ke item Live Output";

type MediaInput = Awaited<ReturnType<typeof imageFile>>;

/**
 * Themes are made through "Impor media": one picture or video opens the theme
 * editor with it as background. Solid and gradient themes switch the
 * background kind in the editor before saving. The new theme is selected.
 */
export async function createTheme(
  page: Page,
  name: string,
  kind: "solid" | "gradient" | "image" | "video" = "solid",
  file?: MediaInput,
) {
  await page.getByRole("tab", { name: /Themes/ }).click();
  await page
    .getByLabel("File media tema", { exact: true })
    .setInputFiles(
      file ??
        (kind === "video" ? await videoFile(page) : await imageFile(page)),
    );
  const editor = page.getByRole("region", { name: "Editor tema" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Nama tema", { exact: true }).fill(name);
  if (kind === "solid" || kind === "gradient")
    await editor
      .getByLabel("Jenis background", { exact: true })
      .selectOption(kind);
  await editor
    .getByRole("button", { name: "Simpan tema", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await page
    .getByRole("button", { name: `Pilih tema ${name}`, exact: true })
    .click();
}
