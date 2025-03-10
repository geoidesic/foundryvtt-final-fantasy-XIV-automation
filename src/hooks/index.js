// Import effects directly
import renderCombatTracker from './renderCombatTracker.js';
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
  renderCombatTracker,
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
  renderCombatTracker, 
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

console.log("[FFXIV] | [HOOKS] Setting up hooks");

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
  console.log("[FFXIV] | [HOOKS] Registering onAbilityUse hook");
  Hooks.on("FFXIVA.onAbilityUse", async (event) => {
    console.log("[FFXIV] | [ABILITY USE HOOK] Hook triggered", {
      itemName: event.item?.name,
      isNewAbilityUse: event.isNewAbilityUse,
      stack: new Error().stack
    });
  });
}