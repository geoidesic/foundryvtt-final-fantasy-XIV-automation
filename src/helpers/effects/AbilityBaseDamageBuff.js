import { ACTIVE_EFFECT_MODES } from "~/src/helpers/constants";

/**
 * Handles primary base damage buff effects
 */
export default class AbilityBaseDamageBuff {
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
    const { DamageResults } = event;
    game.system.log.o('[ABILITY DAMAGE BUFF] Processing ability base damage buff effect', {
      DamageResults,
      actorEffects: this.actor.effects
    });
    
    for (const effect of this.actor.effects) {
      const origin = fromUuidSync(effect.origin);
      game.system.log.o('[ABILITY DAMAGE BUFF] Processing effect:', {
        effect,
        origin,
        changes: effect.changes
      });
      
      for (const change of effect.changes) {
        game.system.log.o('[ABILITY DAMAGE BUFF] Checking change:', {
          key: change.key,
          mode: change.mode,
          value: change.value,
          matches: change.key === 'AbilityBaseDamageBuff' && change.mode === ACTIVE_EFFECT_MODES.CUSTOM
        });
        
        if(change.key === 'AbilityBaseDamageBuff' && change.mode === ACTIVE_EFFECT_MODES.CUSTOM) {
          for (const [tokenId, targetData] of DamageResults) {
            const oldDamage = targetData.damage;
            targetData.damage = parseInt(targetData.damage) + parseInt(change.value);
            targetData.baseDamageFormula += ` + ${origin.name} (${change.value})`;
            game.system.log.o('[ABILITY DAMAGE BUFF] Applied damage buff:', {
              tokenId,
              oldDamage,
              newDamage: targetData.damage,
              addedValue: change.value
            });
          }
        }
      }
    }
  }
}