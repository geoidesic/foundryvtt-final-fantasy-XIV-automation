

import WelcomeAppShell from './WelcomeAppShell.svelte';
import { SvelteApplication } from "@typhonjs-fvtt/runtime/svelte/application";
import { MODULE_ID, MODULE_TITLE, MODULE_CODE } from "~/src/helpers/constants"
import { version } from "../../../module.json";

export default class WelcomeApplication extends SvelteApplication
{
   /**
    * Default Application options
    *
    * @returns {object} options - Application options.
    * @see https://foundryvtt.com/api/interfaces/client.ApplicationOptions.html
    */
   static get defaultOptions()
   {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: `${MODULE_ID}-welcome`,
        classes: [`${MODULE_CODE} welcome`],
         resizable: true,
         minimizable: true,
         width: 290,
         height: 355,
         headerIcon: 'systems/foundryvtt-final-fantasy/assets/aardvark-claw.webp',
         title: game.i18n.localize(`v${version} ${MODULE_TITLE}`),
         svelte: {
            class: WelcomeAppShell,
            target: document.body,
            intro: true,
            props: {
               version  // A prop passed to HelloFoundryAppShell for the initial message displayed.
            }
         }
      });
   }
}