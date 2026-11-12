import { t } from "../i18n";
import type { PresentationController } from "../presentation/controller";
import type { ScreenChoice } from "../presentation/windowManager";
import { hasSecondScreen } from "../presentation/screens";

/**
 * Open the projector window (Go Live / Reconnect). Without a chosen screen it
 * opens on the laptop; when a second screen is connected, say how to get it
 * onto the projector.
 */
export function openProjector(
  controller: PresentationController,
  screen: ScreenChoice | undefined,
) {
  controller.windows.open(screen);
  if (!screen && hasSecondScreen())
    controller.report(
      new Error(
        t(
          "Jendela proyektor terbuka di layar laptop. Klik “Layar” sekali agar SAGI selalu membukanya di layar proyektor, atau geser jendela itu ke layar proyektor lalu klik Fullscreen di sana.",
        ),
      ),
    );
}
