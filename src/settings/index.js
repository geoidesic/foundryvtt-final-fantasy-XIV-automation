import { MODULE_ID } from '~/src/helpers/constants';
import { log } from '~/src/helpers/utility';

export function registerSettings(app) {
  log.i("Building module settings");

  /** World Settings */

  /** User settings */
  dontShowWelcome()

}

function dontShowWelcome() {
  game.settings.register(MODULE_ID, 'dontShowWelcome', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.DontShowWelcome.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.DontShowWelcome.Hint`),
    scope: 'user',
    config: true,
    default: false,
    type: Boolean,
  });
}
