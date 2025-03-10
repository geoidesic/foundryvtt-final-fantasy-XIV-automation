// Import effects directly
import updateCombat from './updateCombat.js';
import preDeleteChatMessage from './preDeleteChatMessage.js';
import targetToken from './targetToken.js';
import deleteCombat from './deleteCombat.js';
import combatStart from './combatStart.js';
import preUpdateToken from './preUpdateToken.js';
import canvasReady from './canvasReady.js';
import preCreateCombatant from './preCreateCombatant.js';
import updateActiveEffect from './updateActiveEffect.js';
import ready from './ready.js';
import init from './init.js';
import effects from '~/src/helpers/effects';

// Export effects as an object
export default {
  preDeleteChatMessage,
  targetToken,
  deleteCombat,
  updateCombat,
  combatStart,
  preUpdateToken,
  canvasReady,
  preCreateCombatant,
  updateActiveEffect,
  ready,
  init,
  onDamage,
  onAbilityUse
};

export { 
  preDeleteChatMessage,
  targetToken,
  deleteCombat,
  updateCombat,
  combatStart,
  preUpdateToken,
  canvasReady,
  preCreateCombatant,
  updateActiveEffect,
  ready,
  init,
};

console.log("[FFXIVA] | [HOOKS] Setting up hooks");

/**
 * Hook that runs when damage is applied
 */
function onDamage() {
  Hooks.on("FFXIVA.onDamage", async (event) => {
    const actor = event.actor;
    if (!actor) return;

    const durationManager = new effects.DurationManager(actor);
    await durationManager.onDamage(event);
  });
}

/**
 * Hook that runs when an ability is used
 */
function onAbilityUse() {
  console.log("[FFXIVA] | [HOOKS] Registering onAbilityUse hook");
  Hooks.on("FFXIVA.onAbilityUse", async (event) => {
    console.log("[FFXIVA] | [ABILITY USE HOOK] Hook triggered", {
      itemName: event.item?.name,
      isNewAbilityUse: event.isNewAbilityUse,
      stack: new Error().stack
    });
  });
}