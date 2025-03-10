import { resetUses, resetActionState } from '~/src/helpers/util.js';
import { resetTokenMovement } from '~/src/stores';
import effects from '~/src/helpers/effects';

/**
 * Hook that runs when combat is updated
 * @return {void}
 */
export default function updateCombat() {
  // Reset uses at end of turn for abilities with 'turn' limitation units
  Hooks.on("updateCombat", async (combat, changed, options, userId) => {
    // Only process if the turn or round actually changed
    if (!("turn" in changed || "round" in changed) || changed.turn === null) return;
  
    // Get the previous combatant
    const previousTurn = combat.turns[combat.previous?.turn];
    if (!previousTurn) return;
  
    const actor = previousTurn.actor;
    if (!actor) return;
  
    // Find all items with turn-based limitations
    const turnLimitedItems = actor.items.filter(i =>
      i.system.hasLimitation &&
      i.system.limitationUnits === "turn"
    );
  
    await resetUses(turnLimitedItems);
  
    // Reset action state at end of turn for the previous actor
    await resetActionState(actor);
  
    // Reset usedReaction for all actors in combat since reactions are per-turn, not per-actor's-turn
    for (const combatant of combat.turns) {
      const currentActor = combatant.actor;
      if (!currentActor) continue;

      await currentActor.update({
        'system.actionState.usedReaction': false
      });
    }
  
    //- reset hasMoved flag and movement store
    await actor.update({ system: { hasMoved: false } });
    resetTokenMovement(previousTurn.token.id);
  
    // Process effects using our new pattern
    for (const combatant of combat.turns) {
      const currentActor = combatant.actor;
      if (!currentActor) continue;

      // Instantiate each effect helper and filter for ones with updateCombat
      const effectProcessors = Object.values(effects)
        .map(EffectClass => new EffectClass(currentActor))
        .filter(processor => typeof processor.updateCombat === 'function');

      // Call updateCombat on each processor that has it
      for (const processor of effectProcessors) {
        await processor.updateCombat(combat, changed, options);
      }
    }
  });
}
