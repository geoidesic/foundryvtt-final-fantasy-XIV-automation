import { SYSTEM_ID } from "~/src/helpers/constants";
import DefaultChatHandler  from "~/src/helpers/rolls/handlers/DefaultChatHandler";
import AbilitiesLimiter from "~/src/helpers/effects/AbilitiesLimiter";
/**
 * Handles all effect-related operations
 */
export default class EffectManager extends CONFIG.FFXIV.EffectManager {
  /**
   * @param {Actor} actor - The actor this handler is for
   */
  constructor(actor) {
    super();
    this.actor = actor;
    this.DefaultChatHandler = new DefaultChatHandler(actor);
  }

  /**
   * Handle all effects for an action
   * @param {Item} item - The item being used
   * @param {Object} result - The result from the action handler
   * @return {Promise<void>} Returns a promise that resolves when all effects are handled
   */
  async handleEffects(item, result) {
    console.log("[FFXIVA] | [EFFECT MANAGER] handleEffects call stack:", item, result);

    game.system.log.o('[EFFECT MANAGER] Starting handleEffects:', {
      itemName: item?.name,
      itemType: item?.type,
      itemSystem: item?.system,
      resultData: result,
      actorEffects: this.actor.effects.map(e => ({
        name: e.name,
        changes: e.changes,
        flags: e.flags,
        disabled: e.disabled
      }))
    });



    // Check with AbilitiesLimiter
    const abilitiesLimiter = new AbilitiesLimiter(this.actor);
    const shouldProceed = await abilitiesLimiter.process({ item });

    game.system.log.o('[EFFECT MANAGER] AbilitiesLimiter check result:', {
      itemName: item?.name,
      shouldProceed,
      hasEnablerEffects: item.system.enables?.list?.length > 0
    });

    const { hasTargets, targets } = result;

    // Handle target effects
    console.log("[FFXIVA] | [EFFECT MANAGER] Target effects check:", {
      itemName: item?.name,
      shouldProceed,
      hasGrants: item.system.grants?.value,
      grantsList: item.system.grants?.list,
      hasTargets,
      targets: targets
    });

    if (shouldProceed && item.system.grants?.value && hasTargets) {
      game.system.log.o('[EFFECT MANAGER] Processing target effects:', {
        itemName: item.name,
        grants: item.system.grants,
        targets: targets.map(t => t.actor?.name)
      });
      // Convert Set to Array if needed
      const targetArray = targets instanceof Set ? Array.from(targets) : targets;
      await this._applyEffectsFromList(item, item.system.grants.list, targetArray);
    }

    // Handle source effects
    if (shouldProceed && item.system.sourceGrants?.list?.length) {
      game.system.log.o('[EFFECT MANAGER] Processing source effects:', {
        itemName: item.name,
        sourceGrants: item.system.sourceGrants,
        actor: this.actor.name
      });
      await this._applyEffectsFromList(item, item.system.sourceGrants.list, [{ actor: this.actor }]);
    }

    // Process enabler effects regardless of roll success
    if (shouldProceed && item.system.enables?.list?.length > 0) {
      game.system.log.o('[EFFECT MANAGER] Processing enabler effects:', {
        itemName: item.name,
        enables: item.system.enables,
        actor: this.actor.name
      });
      await this._handleEnablerEffects(item);
    }
  }

  /**
   * Apply effects from a list to specified targets
   * @protected
   * @param {Item} sourceItem - The item granting the effects
   * @param {Array} effectList - List of effect references to process
   * @param {Array} targets - Array of targets to apply effects to
   */
  async _applyEffectsFromList(sourceItem, effectList, targets) {
    if (!effectList?.length || !targets?.length) {
      if (!effectList?.length) {
        game.system.log.w("[EFFECT MANAGER] No effects to apply");
      }
      if (!targets?.length) {
        game.system.log.w("[EFFECT MANAGER] No targets to apply effects to");
      }
      return;
    }

    game.system.log.o("[EFFECT MANAGER] Processing effects from:", {
      sourceItem: sourceItem?.name,
      sourceItemUUID: sourceItem?.uuid,
      actor: this.actor?.name,
      effectList,
      targets: targets.map(t => t.actor?.name)
    });

    for (const target of targets) {
      const targetActor = target.actor;
      if (!targetActor) continue;

      try {
        const effectData = await this._prepareEffectData(sourceItem, effectList, targetActor);
        if (effectData.length) {
          await targetActor.createEmbeddedDocuments('ActiveEffect', effectData);
        }
      } catch (error) {
        game.system.log.e("Error applying effects to target", error);
        ui.notifications.error(game.i18n.format("FFXIV.Errors.EffectApplicationFailed", { target: targetActor.name }));
      }
    }
  }

  /**
   * Prepare effect data from effect items
   * @protected
   * @param {Item} sourceItem - The item granting the effects
   * @param {Array} effectList - List of effect references to process
   * @param {Actor} targetActor - The actor to check against for existing effects
   * @return {Promise<Array>} Array of prepared effect data
   */
  async _prepareEffectData(sourceItem, effectList, targetActor) {
    // Get all effects from the grants list
    const effectPromises = effectList.flatMap(async (grantRef) => {
      const effectItem = await fromUuid(grantRef.uuid);
      if (!effectItem) return [];

      // Get all effects from the effect item
      return effectItem.effects.map(effect => {
        // Check if effect already exists
        const existingEffect = targetActor.effects.find(e =>
          e.name === effect.name &&
          e.origin === sourceItem.uuid
        );

        // Skip if effect already exists
        if (existingEffect) return null;

        // Handle status effects
        if (effect.statuses?.size) {
          return this._handleStatusEffect(effect, targetActor);
        }

        // For non-status effects, prepare clean data
        return this._prepareCleanEffectData(effect, effectItem, sourceItem);
      });
    });

    // Wait for all effect data to be prepared and flatten the array
    return (await Promise.all(effectPromises)).flat().filter(Boolean);
  }

  /**
   * Handle status effect application
   * @protected
   * @param {ActiveEffect} effect - The effect to process
   * @param {Actor} targetActor - The actor to apply the status to
   * @return {null} Always returns null as statuses are handled directly
   */
  _handleStatusEffect(effect, targetActor) {
    const statuses = Array.from(effect.statuses);
    // Only toggle statuses that aren't already active
    const statusesToToggle = statuses.filter(status => !targetActor.statuses.has(status));
    if (statusesToToggle.length) {
      targetActor.toggleStatusEffect(statusesToToggle[0]);
    }
    return null;
  }

  /**
   * Prepare clean effect data for creation
   * @protected
   * @param {ActiveEffect} effect - The effect to clean
   * @param {Item} effectItem - The item containing the effect
   * @param {Item} sourceItem - The item granting the effect
   * @return {Object} Clean effect data
   */
  _prepareCleanEffectData(effect, effectItem, sourceItem) {
    game.system.log.o('[EFFECT MANAGER] Preparing clean effect data:', {
      effectName: effect.name,
      effectItemSystem: effectItem.system,
      sourceItemSystem: sourceItem.system
    });

    // Get durations array from source item (the granting item) first, then fall back to effect item
    const durations = sourceItem.system.durations || effectItem.system.durations || [];
    // Use the first applicable duration
    const duration = durations[0] || { type: 'none' };

    // Prepare the duration data
    const durationData = {
      startTime: game.time.worldTime,
      startRound: game.combat?.round ?? 0,
      startTurn: game.combat?.turn ?? 0,
      combat: game.combat?.id
    };

    // Add duration-specific data based on type
    if (duration.type === 'hasAmount' && duration.amount) {
      durationData.type = duration.units || 'rounds';
      durationData[duration.units === 'turns' ? 'turns' : 'rounds'] = duration.amount;
    } else if (duration.type === 'hasQualifier' && duration.qualifier) {
      durationData.type = duration.qualifier;
      if (duration.qualifier === 'nextAbility') {
        durationData.requiresAbility = true;
      } else if (duration.qualifier === 'untilDamage') {
        durationData.requiresDamage = true;
      }
    }

    game.system.log.o('[EFFECT MANAGER] Prepared duration data:', {
      effectName: effect.name,
      durationType: duration.type,
      durationUnits: duration.units,
      durationQualifier: duration.qualifier,
      durationData
    });

    return {
      name: effect.name,
      img: effect.img,
      changes: foundry.utils.deepClone(effect.changes),
      duration: durationData,
      disabled: false,
      flags: foundry.utils.deepClone(effect.flags),
      origin: sourceItem.uuid,
    };
  }

  /**
   * Handle enabler effects for an action
   * @protected
   */
  async _handleEnablerEffects(item) {
    if (!item.system.enables?.list?.length) return [];

    const enabledEffects = [];
    for (const enableRef of item.system.enables.list) {
      const effects = await this._processEnablerRef(item, enableRef);
      enabledEffects.push(...effects);
    }

    game.system.log.o('[ABILITY:ENABLER] Enabled effects:', enabledEffects);
    return enabledEffects;
  }

  /**
   * Process a single enabler reference
   * @protected
   * @param {Item} sourceItem - The item triggering the enabler
   * @param {Object} enableRef - The reference to the item to enable
   * @return {Promise<Array>} Array of enabled effect UUIDs
   */
  async _processEnablerRef(sourceItem, enableRef) {
    // Find and validate items
    const { compendiumItem, actorItem } = await this._findEnablerItems(enableRef);
    if (!actorItem || !actorItem.hasEffects) return [];

    // Check usage limits
    if (!await this.actor.actorItemHasRemainingUses(actorItem)) {
      game.system.log.w("[ENABLE]", `${actorItem.name} has no remaining uses`);
      return [];
    }

    // Handle special case for traits that sacrifice movement
    if (actorItem.type === 'trait' && actorItem.system.sacrificesMovement) {
      const canSacrificeMovement = await this._handleMovementSacrifice(actorItem);
      if (!canSacrificeMovement) return [];
    }

    // Apply effects
    const effectsEnabled = await this.actor.addLinkedEffects(actorItem);
    
    // Handle chat message if needed
    if (effectsEnabled.length && sourceItem.name !== actorItem.name) {
      await this.DefaultChatHandler.handle(actorItem);
    }

    return effectsEnabled;
  }

  /**
   * Handle the movement sacrifice mechanic for traits
   * @protected
   * @param {Item} item - The item that sacrifices movement
   * @return {Promise<boolean>} Whether the movement can be sacrificed
   */
  async _handleMovementSacrifice(item) {
    const tokenId = this.actor.token?.id;
    if (!tokenId) return true;

    if (getTokenMovement(tokenId) > 0) {
      ui.notifications.warn(`Cannot enable ${item.name} after moving.`);
      return false;
    }

    if (!game.combat) {
      ui.notifications.warn("Focus can only be toggled during combat.");
      return false;
    }

    await this.actor.toggleStatusEffect("focus");
    return true;
  }

} 