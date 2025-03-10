import { MODULE_ID } from "~/src/helpers/constants";
import { registerSettings } from "~/src/settings"
import { setupEffectsProcessors } from '~/src/config/effectsProcessors';

/**
 * Hook that runs during system initialization
 * @return {void}
*/
export default function init() {
  
  Hooks.once("init", async (a, b, c) => {

    game.system.log.i(`Starting module ${MODULE_ID}`);
    
    registerSettings();
    setupEffectsProcessors();
  
    Handlebars.registerHelper("getSetting", function (moduleName, settingKey) {
      return game.settings.get(moduleName, settingKey);
    });
  
    Hooks.call("FFXIVA.initIsComplete");
  
    
  });
}