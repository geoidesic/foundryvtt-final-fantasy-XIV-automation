import { MODULE_ID } from '~/src/helpers/constants';
import { localize } from '~/src/helpers/util';
import { gameSettings } from '~/src/config/gameSettings';

export function registerSettings(app) {
  game.system.log.i(`Building ${MODULE_ID} settings`);

  /** World Settings */

  /** User settings */
  dontShowWelcome()
  combatStartSound()

}

function dontShowWelcome() {
  gameSettings.register({
    namespace: MODULE_ID,
    key: 'dontShowWelcome',
    options: {
      name: localize('Setting.DontShowWelcome.Name'),
      hint: localize('Setting.DontShowWelcome.Hint'),
      scope: 'user',
      config: true,
      default: false,
      type: Boolean
    }
  });
}

/**
 * Configures the sound played when combat starts.
 * Allows users to set a custom sound effect that plays when
 * a new combat encounter begins.
 * @return {void}
 */
function combatStartSound() {
  gameSettings.register({
    namespace: MODULE_ID,
    key: 'combatStartSound',
    options: {
      name: localize('Setting.combatStartSound.Name'),
      hint: localize('Setting.combatStartSound.Hint'),
      scope: 'user',
      config: true,
      default: 'sounds/drums.wav',
      type: String,
      filePicker: "any",
    }
  });
}
