import { localize } from "~/src/helpers/util";
import { SYSTEM_ID } from "~/src/helpers/constants";

/**
 * Class to handle various checks and guards for rolling actions
 */
export default class RollGuards extends CONFIG.FFXIV.RollGuards {

  /** @type {Actor} The actor associated with these roll guards */
  actor;

  /** 
   * Shuttle object used to pass data from guards to roll calculator
   * @type {Object} 
   */
  shuttle = {
    hasModifiers: {
      extraModifiers: null
    }
  }

  /**
   * Create a new RollGuards instance
   * @param {Actor} actor - The actor to check guards for
   */
  constructor(actor) {
    super();
    this.actor = actor;
  }

  /**
   * Check if the item is an action
   * @param {Item} item - The item to check
   * @return {Promise<boolean>} Whether the item is an action
   */
  async isAction(item) {
    return item.type === 'action';
  }

  /**
   * Check if there is an active combat
   * @return {Promise<boolean>} Whether there is an active combat
   */
  async isCombat() {
    return game.combat;
  }

  /**
   * Check if there are valid targets selected
   * @param {Item} item - The item being used
   * @return {Promise<boolean>} Whether there are valid targets
   */
  async hasTargets(item) {
    // Check if we have targeted entities
    const targets = game.user.targets;
    const hasTargets = targets.size > 0;

    // if no targets, then don't roll
    if (!hasTargets) {
      ui.notifications.warn(`${item.name} has no targets. Please select targets and roll again.`);
      return false
    }
    return true;
  }

  /**
   * Check if the selected targets match the action's targeting requirements
   * @param {Item} item - The item being used
   * @return {Promise<boolean>} Whether the targets match the requirements
   */
  async targetsMatchActionIntent(item) {

    const target = item.system.target;
    const targets = game.user.targets;
    const size = targets.size;

    // Store original targets to restore later if needed
    const originalTargets = new Set(game.user.targets);
    let token;
    try {
      // Handle self-targeting
      if (target === 'self') {
        token = this.actor.activeToken;
        if (!token) {
          ui.notifications.warn("No token found for self-targeting");
          return false;
        }
        // Try to target
        await token.setTarget(true, { user: game.user, releaseOthers: true });
        return true;
      }
      
      // Handle other targeting types
      switch (target) {
        case 'single':
          if (size !== 1) {
            ui.notifications.warn("This ability requires exactly one target");
            return false;
          }
          token = this.actor.activeToken;
          if(targets.has(token)) {
            ui.notifications.warn("This ability cannot target yourself");
            return false;
          }
          break;
        case 'enemy':
          if (size < 1) {
            ui.notifications.warn("This ability requires at least one enemy target");
            return false;
          }
          token = this.actor.activeToken;
          if(targets.has(token)) {
            ui.notifications.warn("This ability cannot target yourself");
            return false;
          }
          // Additional enemy validation could go here
          break;
        case 'ally':
          if (size < 1) {
            ui.notifications.warn("This ability requires at least one ally target");
            return false;
          }
          // Additional ally validation could go here
          break;
        case 'all':
          if (size < 1) {
            ui.notifications.warn("This ability requires at least one target");
            return false;
          }
          break;
      }

      return true;
    } catch (error) {
      game.system.log.e('Error in targetsMatchActionIntent:', error);
      return false;
    } finally {
      // Only restore original targets if we're NOT doing self-targeting
      if (target !== 'self' && originalTargets.size > 0) {
        game.user.targets.forEach(t => t.setTarget(false, { user: game.user, releaseOthers: false }));
        originalTargets.forEach(t => t.setTarget(true, { user: game.user, releaseOthers: false }));
      }
    }
  }

  /**
   * Check if the item has remaining uses available
   * @param {Item} item - The item to check
   * @return {Promise<boolean>} Whether the item has uses remaining
   */
  async hasRemainingUses(item) {
    // Check for limitations only if in combat
    if (item.system.hasLimitation && game.combat) {
      const maxUses = item.system.limitation;

      // Check remaining uses
      const remainingUses = maxUses - (item.system.uses || 0);
      if (remainingUses <= 0) {
        ui.notifications.warn(`${item.name} has no remaining uses.`);
        return false;
      }

      // Confirm use
      const confirmed = await Dialog.confirm({
        title: "Confirm Ability Use",
        content: `<p>Use ${item.name}? (${remainingUses} use${remainingUses > 1 ? 's' : ''} remaining)</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: true
      });

      if (!confirmed) return false;

      // Update uses while preserving other system data
      const systemData = foundry.utils.deepClone(item.system);
      systemData.uses = (systemData.uses || 0) + 1;
      await item.update({ system: systemData });
    }
    return true;
  }

  /**
   * Check and handle any modifiers for the roll
   * @param {Item} item - The item being used
   * @return {Promise<boolean>} Whether modifiers were successfully handled
   */
  async hasModifiers(item) {
    if (!item.system.hasCR) {
      return true;
    }

    // Show dialog for extra modifiers
    this.shuttle.hasModifiers.extraModifiers = await this._showModifierDialog(item);

    // If dialog was cancelled or closed, unmark effects for deletion
    if (!this.shuttle.hasModifiers.extraModifiers?.confirmed) {
      // Remove pending deletion flags from all effects
      for (const effect of this.actor.effects) {
        if (effect.getFlag(SYSTEM_ID, 'pendingDeletion')) {
          await effect.unsetFlag(SYSTEM_ID, 'pendingDeletion');
        }
      }
      return false;
    }

    // If confirmed, delete all effects marked for deletion
    for (const effect of this.actor.effects) {
      if (effect.getFlag(SYSTEM_ID, 'pendingDeletion')) {
        await effect.delete();
      }
    }

    Hooks.call('FFXIV.processTargetRollAdditionalModifiers', { item, extraModifiers: this.shuttle.hasModifiers.extraModifiers, actor: this.actor });
    return true;
  }

  /**
   * Check if the item has any enablers
   * @param {Item} item - The item to check
   * @return {Promise<boolean>} Whether the item has enablers
   */
  async hasEnablers(item) {
    if (!game.combat || !item.system.enables?.value) { return false }
    const enablesList = item.system.enables.list;
    if (!enablesList?.length) { return false }
    return true;
  }

  /**
   * Check if there is an appropriate action slot available
   * @param {Item} item - The item to check
   * @return {Promise<boolean>} Whether an enabler slot is available
   */
  async hasAvailableActionSlot(item) {
    // Skip this check for reactions
    if (item.system.type === 'reaction') return true;

    const { actionState } = this.actor.system;
    const actionType = item.system.type || 'primary'; // default to primary if not set

    game.system.log.cyan('[SLOT:USAGE] Checking available action slot:', actionType);

    // Get enabler slots (non-primary/secondary slots)
    const enablerSlots = actionState.available.filter(slot =>
      slot !== 'primary' && slot !== 'secondary'
    );

    game.system.log.cyan('[SLOT:USAGE] Enabler slots:', enablerSlots);

    // First check if any of the item's tags match enabler slots
    // @why: because we want to allow custom slots to be used first if they match an enabler slot
    if (item.system.tags?.some(tag => enablerSlots.includes(tag))) {
      return true;
    }

    game.system.log.cyan('[SLOT:USAGE] No enabler slots match:', item.system.tags);

    // Then check if we have a matching action slot (primary/secondary)
    if (actionState.available.includes(actionType)) {
      return true;
    }

    game.system.log.cyan('[SLOT:USAGE] No matching action slot:', actionType);

    // If actionType is secondary, then we can use the secondary or primary slot
    if (actionType === 'secondary' && actionState.available.filter(slot => slot === 'secondary' || slot === 'primary').length) {
      return true;
    }

    game.system.log.cyan('[SLOT:USAGE] No matching action slot:', actionType);

    // Finally check enabled effects if we have enablers
    if (await this.hasEnablers(item)) {
      const enabledEffects = this.actor.effects.filter(
        effect => effect.system.tags?.includes('enabler')
      );
      game.system.log.cyan('[SLOT:USAGE] Enabled effects:', enabledEffects);

      if (enabledEffects?.length) {
        const enabledEffectsLinkedToEnablerSlots = enabledEffects.filter(
          effect => enablerSlots.some(slot => {
            const originItem = fromUuidSync(effect.origin);
            return originItem?.system.tags?.includes(slot);
          })
        );

        if (enabledEffectsLinkedToEnablerSlots.length) {
          return true;
        }
      }
    }

    // If we get here, no valid slot was found
    const msg = localize("Errors.SlotNotAvailable").replace("%s", actionType);
    ui.notifications.warn(msg);
    return false;
  }

  /**
   * Check if the item matches any enabler effects
   * @param {Item} item - The item to check
   * @return {Promise<boolean>} Whether the item matches enabler effects
   */
  async matchesEnablerEffect(item) {
    return this.actor.itemTagsMatchEnablerEffectTags(item);
  }

  /**
   * Check if the actor has all required effects for the item
   * @param {Item} item - The item to check
   * @return {Promise<boolean>} Whether all required effects are present
   */
  async hasRequiredEffects(item) {
    if (!item.system.requires?.value) { return true }

    // Check each required effect
    for (const requireRef of item.system.requires.list) {
      const requiredItem = await fromUuid(requireRef.uuid);
      if (!requiredItem) continue;
      // Check if any of the required item's effects are active (not disabled)
      let hasActiveEffect = false;
      for (const effect of this.actor.effects) {
        if (effect.name === requiredItem.name) {
          hasActiveEffect = true;
          // Flag the effect for deletion instead of deleting it immediately
          await effect.setFlag(SYSTEM_ID, 'pendingDeletion', true);
          break;
        }
      }

      if (!hasActiveEffect) {
        ui.notifications.warn(game.i18n.format("FFXIV.Warnings.RequiredEffectNotActive", { name: requiredItem.name }));
        return false;
      }
    }
    return true;
  }

  /**
   * Check if it is currently the actor's turn
   * @param {Item} item - The item being used
   * @return {Promise<boolean>} Whether it is the actor's turn
   */
  async isActorsTurn(item) {
    // Skip this check if not in combat
    if (!game.combat) return true;

    // Get the current combatant
    const currentCombatant = game.combat.combatant;
    if (!currentCombatant) return true;

    // Reactions can be used on any turn
    if (item.system.type === 'reaction') return true;

    // For non-reactions, check if it's this actor's turn
    const isCurrentTurn = currentCombatant.actor.id === this.actor.id;
    if (!isCurrentTurn) {
      ui.notifications.warn("Cannot use this action outside of your turn.");
    }
    return isCurrentTurn;
  }

  /**
   * Check if the item is a reaction
   * @param {Item} item - The item to check
   * @return {Promise<boolean>} Whether the item is a reaction
   */
  async isReaction(item) {
    // Only check reactions
    if (item.system.type !== 'reaction') return true;

    // Skip this check if not in combat
    if (!game.combat) return true;

    const actionState = this.actor.system.actionState;
    if (actionState.usedReaction) {
      ui.notifications.warn("Cannot use multiple reactions in the same turn.");
      return false;
    }
    return true;
  }

  /**
   * Check if there is an available action slot for the item
   * @param {Item} item - The item to check
   * @return {Promise<boolean>} Whether an action slot is available
   */
  async hasAvailableSlot(item) {
    // Skip this check for reactions
    if (item.system.type === 'reaction') return true;

    const actionState = this.actor.system.actionState;
    const available = actionState.available || [];
    const actionType = item.system.type;
    const hasSlot = available.includes(actionType);
    if (!hasSlot) {
      ui.notifications.warn(`No ${actionType} action slot available.`);
    }
    return hasSlot;
  }

  /**
   * Check if there are any unapplied damage results in chat messages
   * @param {Item} item - The item being used
   * @return {Promise<boolean>} Whether there are no unapplied damage results
   */
  async hasNoUnappliedDamage(item) {
    // Skip this check for non-damaging actions
    if (!item.system.baseEffectDamage && !item.system.directHitDamage) return true;

    // Get all chat messages with damage
    const messages = game.messages.filter(m => {
      const data = m.flags?.[SYSTEM_ID]?.data;
      return data?.chatTemplate === "ActionRollChat" &&
             (data?.item?.system?.baseEffectDamage || data?.item?.system?.directHitDamage);
    });

    // Check if any messages have unapplied damage
    for (const message of messages) {
      const state = message.flags?.[SYSTEM_ID]?.state;
      if (!state?.damageResults) continue;

      // Check if any target has unapplied damage
      const hasUnappliedDamage = Object.values(state.damageResults).some(result => !result.applied);
      
      if (hasUnappliedDamage) {
        ui.notifications.warn("There are unapplied damage results in chat. Please apply or undo them before making another action roll.");
        return false;
      }
    }

    return true;
  }

  /**
   * Check if the actor has enough MP to use the action
   * @param {Item} item - The item being used
   * @return {Promise<boolean>} Whether the actor has enough MP
   */
  async meetsMPCost(item) {
    // Skip this check if the item doesn't have an MP cost
    if (!item.system.hasCostMP || !item.system.costMP) {
      // game.system.log.o('[MP:CHECK] No MP cost, skipping check');
      return true;
    }

    // Get current MP based on actor type
    let currentMP;
    
      // For PCs, MP is stored in system.points.MP.val
      currentMP = this.actor.system.points.MP.val;
      // game.system.log.o('[MP:CHECK] PC MP:', currentMP);
    

    const cost = item.system.costMP;

    // game.system.log.o('[MP:CHECK] Checking MP cost:', {
    //   actorType: this.actor.type,
    //   currentMP,
    //   cost,
    //   hasEnough: currentMP >= cost
    // });

    if (currentMP < cost) {
      ui.notifications.warn(`Not enough MP to use ${item.name}. Required: ${cost} MP, Current: ${currentMP} MP`);
      return false;
    }

    return true;
  }
}
