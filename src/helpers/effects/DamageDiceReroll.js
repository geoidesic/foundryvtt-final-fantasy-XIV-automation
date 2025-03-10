import { ACTIVE_EFFECT_MODES } from "~/src/helpers/constants";

/**
 * Handles damage dice reroll effects
 */
export default class DamageDiceReroll {
  /**
   * @param {Actor} actor - The actor this effect is applied to
   */
  constructor(actor) {
    this.actor = actor;
  }

  /**
   * Process the damage dice reroll effect
   * @param {object} event - The event containing damage results
   * @return {Promise<void>} A promise that resolves when processing is complete
   */
  async process(event) {
    game.system.log.o('[DAMAGE DICE REROLL] Processing damage dice reroll effect');
    const { DamageResults, isCritical } = event;
    if(!DamageResults || !DamageResults.size) {
      game.system.log.w('[DAMAGE DICE REROLL] No damage results found');
      return;
    }

    for (const effect of this.actor.effects) {
      if (effect.disabled || effect.isSuppressed) continue;
      
      const origin = fromUuidSync(effect.origin);
      for (const change of effect.changes) {
        if (change.key === 'DamageDiceReroll' && change.mode === ACTIVE_EFFECT_MODES.CUSTOM) {
          for (const [targetId, targetData] of DamageResults) {
            game.system.log.o('[DAMAGE DICE REROLL] Target data:', {
              targetId,
              targetData
            });
            if (!targetData.directHit) continue;
            
            const [numDice, dieType] = targetData.directHit.split('d').map(Number);
            if (!numDice || !dieType) continue;

            const additionalDice = Number(change.value) || 1;
            const newNumDice = numDice + additionalDice;
            game.system.log.o('[DAMAGE DICE REROLL] New number of dice:', {
              newNumDice
            });
            const kh = numDice;
            const originalFormula = `${numDice}d${dieType}`;
            targetData.directHit = `${newNumDice}d${dieType}kh${kh}`;
            targetData.directHitFormula = targetData.directHit;

            // Create tooltip parts
            const parts = [];
            parts.push(`1D${dieType}`);  // Base dice in uppercase
            if (isCritical) {
              parts.push('CRITICAL');
            }
            parts.push(effect.name.toUpperCase());  // Effect name in uppercase
            targetData.directHitDisplayFormula = `(${parts.join(' + ')})`;
          }
        }
      }
    }
  }
}