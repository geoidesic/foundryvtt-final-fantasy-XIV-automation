import { ACTIVE_EFFECT_MODES } from "~/src/helpers/constants";

/**
 * Handles primary base damage buff effects
 */
export default class PrimaryBaseDamageBuff {
  /**
   * @param {Actor} actor - The actor this effect is applied to
   */
  constructor(actor) {
    this.actor = actor;
  }

  /**
   * Process the primary base damage buff effect
   * @param {object} event - The event containing damage results
   * @return {Promise<void>} A promise that resolves when processing is complete
   */
  async process(event) {

    // Get all effects on the actor
    const effects = this.actor.effects.filter(e => !e.disabled);



    // Process each effect
    for (const effect of effects) {
      const origin = await fromUuid(effect.origin);



      // Process each change
      for (const change of effect.changes) {
        
        if(change.key === 'PrimaryBaseDamageBuff' && change.mode === ACTIVE_EFFECT_MODES.CUSTOM) {
          for (const [tokenId, targetData] of event.DamageResults) {
            const oldDamage = targetData.damage;
            targetData.damage = parseInt(targetData.damage) + parseInt(change.value);
            targetData.baseDamageFormula += ` + ${origin.name} (${change.value})`;
            
          }
        }
      }
    }
  }
}