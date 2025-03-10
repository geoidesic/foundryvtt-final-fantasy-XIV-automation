import { MODULE_ID } from "~/src/helpers/constants";

/**
 * Hook that runs when combat starts
 * @return {void}
 */
export default function combatStart() {

  Hooks.on("combatStart", async (combat, data, meta, id) => {
    const combatStartSound = game.settings.get(MODULE_ID, 'combatStartSound').trim();
    if (combatStartSound !== '') {
      foundry.audio.AudioHelper.play({ src: combatStartSound, volume: 1, autoplay: true, loop: false });
    }
    await combat.resetCombatantAbilities();
  });
}