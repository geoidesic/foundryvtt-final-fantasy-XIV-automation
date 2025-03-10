import WelcomeApplication from "~/src/components/applications/WelcomeApplication"
import { MODULE_ID } from "~/src/helpers/constants"

/**
 * Hook that runs when the system is ready
 * @return {void}
 */
export default function canvasReady() {
  Hooks.once("ready", async () => {
    if (!game.settings.get(MODULE_ID, 'dontShowWelcome')) {
      new WelcomeApplication().render(true, { focus: true });
    }
  });
}