import { SYSTEM_ID } from "~/src/helpers/constants";

/**
 * Handles special duration types for effects
 */
export default class AbilitiesLimiter {
  /**
   * @param {Actor} actor - The actor this effect is applied to
   */
  constructor(actor) {
    this.actor = actor;
  }

  /**
   * Process the primary base damage buff effect
   * @param {object} event - The event containing damage results
   * @return {Promise<boolean>} A promise that resolves to true if the ability should be allowed, false otherwise
   */
  async process(event) {
    // Get all effects on the actor
    const effects = this.actor.effects.filter(e => !e.disabled);

    // Check if the actor has the Next Ability Does Damage Only effect
    const damageOnlyEffect = this.actor.effects.find(e => 
      e.name === 'Next Ability Does Damage Only' && !e.disabled
    );

    if (!damageOnlyEffect) return true;

    game.system.log.o('[ABILITIES LIMITER] Found Next Ability Does Damage Only effect:', {
      event,
      effect: damageOnlyEffect
    });

    // Add detailed logging at the start
    console.log("[FFXIV] | [ABILITIES LIMITER] Starting process with effect state:", {
      effectName: damageOnlyEffect?.name,
      effectChanges: damageOnlyEffect?.changes,
      effectOrigin: damageOnlyEffect?.origin,
      effectFlags: damageOnlyEffect?.flags,
      effectDuration: damageOnlyEffect?.duration,
      effectDisabled: damageOnlyEffect?.disabled
    });

    // If we have the effect, validate and modify the event to only include damage
    if (event.item?.system) {
      game.system.log.o('[ABILITIES LIMITER] Processing item:', {
        itemName: event.item.name,
        itemType: event.item.type,
        itemSystem: event.item.system,
        itemEffects: event.item.effects?.map(e => ({
          name: e.name,
          changes: e.changes,
          flags: e.flags
        }))
      });

      // Check if the ability has any non-damage effects
      const hasNonDamageEffects = this._hasNonDamageEffects(event.item.system);
      const hasSourceEffects = this._hasSourceEffects(event.item.system);
      const hasEnablerEffects = this._hasEnablerEffects(event.item.system);

      game.system.log.o('[ABILITIES LIMITER] Effect checks:', {
        itemName: event.item.name,
        hasNonDamageEffects,
        hasSourceEffects,
        hasEnablerEffects,
        system: {
          baseEffectDamage: event.item.system.baseEffectDamage,
          baseEffectHealing: event.item.system.baseEffectHealing,
          baseEffectBarrier: event.item.system.baseEffectBarrier,
          baseEffectRestoreMP: event.item.system.baseEffectRestoreMP,
          directHitType: event.item.system.directHitType,
          directHitDamage: event.item.system.directHitDamage,
          grants: event.item.system.grants,
          sourceGrants: event.item.system.sourceGrants,
          enables: event.item.system.enables,
          procs: event.item.system.procs
        }
      });

      // If the ability has source effects, prevent its use entirely
      if (hasSourceEffects) {
        game.system.log.o('[ABILITIES LIMITER] Ability has source effects, preventing use:', {
          itemName: event.item.name,
          hasSourceEffects
        });
        ui.notifications.warn(game.i18n.format('FFXIV.Warnings.NextAbilityDamageOnly'));
        return false;
      }

      // If the ability has enabler effects, prevent its use
      if (hasEnablerEffects) {
        game.system.log.o('[ABILITIES LIMITER] Ability has enabler effects, preventing use:', {
          itemName: event.item.name,
          hasEnablerEffects
        });
        ui.notifications.warn(game.i18n.format('FFXIV.Warnings.NextAbilityDamageOnly'));
        return false;
      }

      if (hasNonDamageEffects) {
        game.system.log.o('[ABILITIES LIMITER] Ability has non-damage effects:', {
          itemName: event.item.name,
          system: event.item.system
        });

        // If the ability has no damage component at all, prevent its use
        if (!this._hasDamageComponent(event.item.system)) {
          ui.notifications.warn(game.i18n.format('FFXIV.Warnings.NextAbilityDamageOnly'));
          return false;
        }

        // Store original values
        const originalBaseEffectHealing = event.item.system.baseEffectHealing;
        const originalBaseEffectBarrier = event.item.system.baseEffectBarrier;
        const originalBaseEffectRestoreMP = event.item.system.baseEffectRestoreMP;
        const originalDirectHitHealing = event.item.system.directHitHealing;
        const originalDirectHitBarrier = event.item.system.directHitBarrier;
        const originalDirectHitRestoreMP = event.item.system.directHitRestoreMP;
        const originalGrantsList = [...(event.item.system.grants?.list || [])];
        const originalProcsList = [...(event.item.system.procs?.list || [])];

        // Remove all non-damage effects
        event.item.system.baseEffectHealing = null;
        event.item.system.baseEffectBarrier = null;
        event.item.system.baseEffectRestoreMP = null;
        event.item.system.directHitHealing = null;
        event.item.system.directHitBarrier = null;
        event.item.system.directHitRestoreMP = null;
        event.item.system.grants = { list: [], value: false };
        event.item.system.procs = { list: [], value: false };

        game.system.log.o('[ABILITIES LIMITER] Modified ability to only do damage:', {
          itemName: event.item.name,
          originalHealing: originalBaseEffectHealing,
          originalBarrier: originalBaseEffectBarrier,
          originalRestoreMP: originalBaseEffectRestoreMP,
          originalDirectHitHealing,
          originalDirectHitBarrier,
          originalDirectHitRestoreMP,
          originalGrantsList,
          originalProcsList,
          modifiedSystem: event.item.system
        });

        ui.notifications.warn(game.i18n.format('FFXIV.Warnings.NextAbilityDamageOnly'));
      }

      // Remove the effect since it's been used
      game.system.log.o('[ABILITIES LIMITER] Attempting to delete effect:', {
        effectName: damageOnlyEffect.name,
        effectId: damageOnlyEffect.id,
        effectDuration: damageOnlyEffect.duration,
        effectFlags: damageOnlyEffect.flags,
        effectChanges: damageOnlyEffect.changes,
        effectDisabled: damageOnlyEffect.disabled
      });

      // Add before the delete attempt
      console.log("[FFXIV] | [ABILITIES LIMITER] About to delete effect:", {
        effectName: damageOnlyEffect.name,
        effectId: damageOnlyEffect.id,
        effectDuration: damageOnlyEffect.duration,
        effectChanges: damageOnlyEffect.changes,
        deleteResult: await damageOnlyEffect.delete()
      });

      try {
        await damageOnlyEffect.delete();
        game.system.log.o('[ABILITIES LIMITER] Successfully deleted effect');
      } catch (error) {
        game.system.log.e('[ABILITIES LIMITER] Failed to delete effect:', error);
      }

      // Add after the delete attempt
      console.log("[FFXIV] | [ABILITIES LIMITER] After delete attempt:", {
        effectStillExists: this.actor.effects.has(damageOnlyEffect.id),
        remainingEffects: this.actor.effects.map(e => ({
          name: e.name,
          id: e.id
        }))
      });
    }

    return true;
  }

  /**
   * Check if an ability has any non-damage effects
   * @param {object} system - The ability's system data
   * @return {boolean} Whether the ability has non-damage effects
   * @private
   */
  _hasNonDamageEffects(system) {
    return !!(
      system.baseEffectHealing ||
      system.baseEffectBarrier ||
      system.baseEffectRestoreMP ||
      system.directHitHealing ||
      system.directHitBarrier ||
      system.directHitRestoreMP ||
      (system.grants?.list || []).length > 0 ||
      (system.procs?.list || []).length > 0
    );
  }

  /**
   * Check if an ability has any source effects
   * @param {object} system - The ability's system data
   * @return {boolean} Whether the ability has source effects
   * @private
   */
  _hasSourceEffects(system) {
    return !!(system.sourceGrants?.list?.length);
  }

  /**
   * Check if an ability has any enabler effects
   * @param {object} system - The ability's system data
   * @return {boolean} Whether the ability has enabler effects
   * @private
   */
  _hasEnablerEffects(system) {
    return !!(system.enables?.list?.length);
  }

  /**
   * Check if an ability has any damage component
   * @param {object} system - The ability's system data
   * @return {boolean} Whether the ability has a damage component
   * @private
   */
  _hasDamageComponent(system) {
    return !!(
      system.baseEffectDamage ||
      (system.directHitType === 'damage' && system.directHitDamage)
    );
  }
}