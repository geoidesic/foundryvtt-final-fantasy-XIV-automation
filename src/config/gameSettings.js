import { TJSGameSettings } from '#runtime/svelte/store/fvtt/settings';
import { MODULE_ID }       from '~/src/helpers/constants';

/**
 * Provides a shared instance of TJSGameSettings across the module
 * @type {TJSGameSettings}
 */
export const gameSettings = new TJSGameSettings(MODULE_ID);
