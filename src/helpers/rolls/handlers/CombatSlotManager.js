import { SYSTEM_ID } from "~/src/helpers/constants";

/**
 * Handles all combat slot operations
 */
export default class CombatSlotManager {
  /**
   * @param {Actor} actor - The actor this handler is for
   */
  constructor(actor) {
    this.actor = actor;
  }

  /**
   * Mark a slot as used in the combat tracker
   * @param {Item} item - The item being used
   * @param {Object} result - The result from the action handler
   * @return {Promise<void>} Returns a promise that resolves when the slot is marked
   */
  async markSlotUsed(item, result) {
    const { message } = result;
    const actionType = item.system.type || 'primary';

    // Skip if message already has applied damage results
    const state = message?.flags?.[SYSTEM_ID]?.state;
    if (state?.damageResults) {
      const hasAppliedDamage = Object.values(state.damageResults).some(result => result.applied);
      if (hasAppliedDamage) {
        game.system.log.w('[SLOT:USAGE] Message already has applied damage results, skipping slot update');
        return;
      }
    }

    // Track reaction usage
    if (item.system.type === 'reaction') {
      await this.actor.update({
        'system.actionState.usedReaction': true
      });
      return;
    }

    let slotToUse;

    game.system.log.o('[SLOT:USAGE] Checking slots:', {
      itemName: item.name,
      actionType,
      itemTags: item.system.tags,
      itemSystem: item.system,
      requires: item.system.requires
    });

    // First check for primary/secondary slot
    if (this.actor.system.actionState.available.includes(actionType)) {
      slotToUse = actionType;
      game.system.log.o('[SLOT:USAGE] Using default action type slot:', actionType);
    }
    // #105 Allow using primary slot for secondary actions
    else if (actionType === 'secondary' && this.actor.system.actionState.available.includes('primary')) {
      slotToUse = 'primary';
      game.system.log.o('[SLOT:USAGE] Using primary slot for secondary action');
    }

    // If no primary/secondary slot found, check for custom slots
    if (!slotToUse && item.system.tags?.length) {
      const customSlots = this.actor.system.actionState.available.filter(slot =>
        slot !== 'primary' && slot !== 'secondary'
      );

      const matchingSlot = customSlots.find(slot =>
        item.system.tags.includes(slot)
      );

      if (matchingSlot) {
        slotToUse = matchingSlot;

        game.system.log.o('[SLOT:USAGE] Found matching slot:', {
          slot: matchingSlot,
          itemName: item.name,
          itemTags: item.system.tags
        });

        const enablerEffectForThisSlot = this.actor.enablerEffects.find(effect => 
          effect.changes.some(change => 
            change.value === matchingSlot
          )
        );

        if (enablerEffectForThisSlot) {
          game.system.log.o('[SLOT:USAGE] Found enabler effect:', {
            effectName: enablerEffectForThisSlot.name,
            changes: enablerEffectForThisSlot.changes,
            origin: enablerEffectForThisSlot.origin
          });

          const originItemUuid = enablerEffectForThisSlot.getFlag(SYSTEM_ID, 'originEffect.uuid')?.split('.').slice(0, -2).join('.');
          if (originItemUuid) {
            const originItem = fromUuidSync(originItemUuid);
            if (originItem) {
              game.system.log.o('[SLOT:USAGE] Found origin item:', {
                name: originItem.name,
                currentUses: originItem.system.uses,
                maxUses: originItem.system.maxUses
              });

              const uses = (originItem.system.uses || 0) + 1;
              await originItem.update({ system: { uses } });
            }

            game.system.log.o('[SLOT:USAGE] Removing enabler effect:', enablerEffectForThisSlot.name);
            await enablerEffectForThisSlot.delete();
          }
        }
      }
    }

    if (!slotToUse) {
      game.system.log.w('[SLOT:USAGE] No slot found to use for:', item.name);
      return;
    }

    // Create new available array and remove exactly one instance of the used slot
    const newAvailable = [...this.actor.system.actionState.available];
    const indexToRemove = newAvailable.findIndex(slot => slot === slotToUse);
    if (indexToRemove !== -1) {
      newAvailable.splice(indexToRemove, 1);
    }

    // Create new used array
    const newUsed = [...this.actor.system.actionState.used, {
      type: slotToUse,
      messageId: message?.id
    }];

    game.system.log.o('[SLOT:USAGE] Updating action state:', {
      oldAvailable: this.actor.system.actionState.available,
      newAvailable,
      oldUsed: this.actor.system.actionState.used,
      newUsed,
      itemName: item.name,
      slotUsed: slotToUse
    });

    // Update the actor's action state
    await this.actor.update({
      'system.actionState.available': newAvailable,
      'system.actionState.used': newUsed
    });
  }
} 