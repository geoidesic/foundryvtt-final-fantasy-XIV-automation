import { SYSTEM_ID } from "~/src/helpers/constants";
import { generateRandomElementId } from "~/src/helpers/util";
import DefaultChat from "~/src/helpers/rolls/handlers/DefaultChatHandler";

/**
 * Handles all action-related operations
 */
export default class ActionHandler {
  /**
   * @param {Actor} actor - The actor this handler is for
   */
  constructor(actor) {
    this.actor = actor;
    this.DefaultChat = new DefaultChat(actor);
  }

  /**
   * Handle an action ability
   * @param {Item} item - The action item
   * @param {Object} [options={}] - Additional options
   * @return {Promise<{success: boolean, message: ChatMessage|null}>} Returns result of action handling
   */
  async handle(item, options = {}) {
    console.log("[FFXIVA] | [ACTION HANDLER] Starting handle", {
      itemName: item?.name,
      options,
      stack: new Error().stack // This will show us the call stack
    });

    try {
      this.options = options;  // Store options for use in other methods
      const { targets, hasTargets, targetIds } = this._getActionTargets();
      const limiterType = this._checkAbilityLimiter();

      let roll;
      let isCritical = false;
      let d20Result = null;
      let isSuccess;
      let message;

      // Handle MP cost before rolling
      await this._handleCostMP(item);

      if (item.system.hasCR) {
        ({ message, roll, isCritical, d20Result, isSuccess } = await this._rollWithCR(item, targets, hasTargets, targetIds));
      } else {
        // Log item system state for debugging
        // game.system.log.o('[ACTION:HANDLE] Item system state:', {
        //   itemName: item.name,
        //   hasBaseEffectDamage: item.system.hasBaseEffectDamage,
        //   hasBaseEffectHealing: item.system.hasBaseEffectHealing,
        //   hasBaseEffectRestoreMP: item.system.hasBaseEffectRestoreMP,
        //   baseEffectDamage: item.system.baseEffectDamage,
        //   baseEffectHealing: item.system.baseEffectHealing,
        //   baseEffectRestoreMP: item.system.baseEffectRestoreMP,
        //   fullSystem: item.system
        // });

        // Use DefaultChat if there's no custom action message
        if(item.system.hasBaseEffectDamage || item.system.hasBaseEffectHealing || item.system.hasBaseEffectRestoreMP) {
          // game.system.log.o('[ACTION:HANDLE] Creating custom message');
          message = await ChatMessage.create(this._createActionMessageData(item, hasTargets, targetIds));
        } else {
          // game.system.log.o('[ACTION:HANDLE] Using DefaultChat');
          this.DefaultChat.handle(item);
        }
      }

      // If we have a DamageOnly limiter, skip all non-damage effects
      if (limiterType !== 'DamageOnly') {
        // Handle healing if the action has healing effects
        if (item.system.baseEffectHealing) {
          await this._handleHealing(item, this.actor, isCritical);
        }

        // Handle MP restoration if the action has MP restoration effects (self only)
        if (item.system.hasBaseEffectRestoreMP && item.system.baseEffectRestoreMP) {
          // game.system.log.o('[MP:RESTORE] Attempting MP restoration');
          await this._handleMPRestoration(item);
        }

        // Handle barrier if the action has barrier effects
        if (item.system.hasBaseEffectBarrier && item.system.baseEffectBP) {
          await this._handleBarrier(item);
        }
      }

      // Call the ability use hook after all processing is complete
      await Hooks.callAll('FFXIV.onAbilityUse', { 
        actor: this.actor, 
        item,
        isNewAbilityUse: true
      });

      console.log("[FFXIVA] | [ACTION HANDLER] Calling ability use hook", {
        itemName: item?.name,
        isNewAbilityUse: true,
        stack: new Error().stack
      });

      return {
        handledSuccessfully: true,
        isCritical,
        roll,
        d20Result,
        hasTargets,
        targets,
        isSuccess,
        message
      };
    } catch (error) {
      game.system.log.e("Error in action handler", error);
      ui.notifications.error(
        game.i18n.format("FFXIV.Errors.ActionHandlingFailed", { target: this.actor.name })
      );
      return { handledSuccessfully: false };
    }
  }

  /**
   * @internal
   * Retrieves targets from the user and checks if they exist.
   */
  _getActionTargets() {
    const targets = game.user.targets;
    const hasTargets = targets.size > 0;
    const targetIds = Array.from(targets).map(target => target.id);
    return { targets, hasTargets, targetIds };
  }

  /**
   * @internal
   * Creates and returns the final message, roll, and critical data if an item uses CR checks.
   */
  async _rollWithCR(item, targets, hasTargets, targetIds) {
    // Handle roll with modifiers
    const { roll, isCritical, d20Result } = await this._handleRollWithModifiers(item);
    let isSuccess = false;
    // Create initial message data
    const messageData = this._createActionMessageData(item, hasTargets, targetIds, roll, isCritical);
    messageData.flags[SYSTEM_ID].data.isCritical = isCritical;
    messageData.flags[SYSTEM_ID].data.d20Result = d20Result;

    // If there are targets, figure out the CR value from the target
    if (hasTargets) {
      const {
        crValue,
        targetActor
      } = this._getTargetCRValue(item, targets);

      // Evaluate success
      isSuccess = this._evaluateSuccess({ roll, crValue, isCritical });
      game.system.log.o('[ABILITY:ROLL] CR check isSuccess:', isSuccess);
      messageData.flags[SYSTEM_ID].data.isSuccess = isSuccess;

      // Log CR check output
      game.system.log.o('[ABILITY:ROLL] CR check:', {
        itemName: item.name,
        rollTotal: roll.total,
        CR: item.system.CR,
        crValue,
        isSuccess,
        isCritical,
        d20Result
      });
    }

    // Send the roll message to the chat
    const message = await roll.toMessage(messageData);
    return { message, roll, isCritical, d20Result, isSuccess };
  }

  /**
   * @internal
   * Handle healing from an action
   * @param {Item} item - The action item
   * @param {Actor} targetActor - The actor to heal
   * @param {boolean} isCritical - Whether this was a critical hit
   * @return {Promise<void>} A promise that resolves when healing is complete
   */
  async _handleHealing(item, targetActor, isCritical = false) {
    if (!item.system.baseEffectHealing) return;

    // If it's a critical hit, the healing formula should already be doubled by _handleCriticalHit
    const healingRoll = await new Roll(item.system.baseEffectHealing).evaluate();
    const healingAmount = healingRoll.total;

    game.system.log.o('[HEALING] Applying healing:', {
      itemName: item.name,
      targetName: targetActor.name,
      healingAmount,
      isCritical
    });

    // Calculate new HP value, not exceeding max HP
    const currentHP = targetActor.system.points.HP.val;
    const maxHP = targetActor.system.points.HP.max;
    const newHP = Math.min(currentHP + healingAmount, maxHP);

    game.system.log.o('[HEALING] HP values:', {
      currentHP,
      maxHP,
      newHP,
      healingApplied: newHP - currentHP
    });

    // Update the target's HP
    await targetActor.update({ "system.points.HP.val": newHP });
  }

  /**
   * @internal
   * Retrieves the CR value from the first target if available.
   */
  _getTargetCRValue(item, targets) {
    const target = targets.values().next().value;
    const targetActor = target?.actor;
    let crValue = 0;

    if (targetActor) {
      if (targetActor.type === "npc") {
        crValue = targetActor.system.attributes[item.system.CR]?.val || 0;
      } else {
        crValue = targetActor.system.attributes.secondary[item.system.CR]?.val || 0;
      }
    }

    return { crValue, targetActor };
  }

  /**
   * @internal
   * Evaluates if a roll is successful based on CR and critical.
   */
  _evaluateSuccess({ roll, crValue, isCritical }) {
    // If critical, auto success. Otherwise compare to CR value.
    return isCritical || roll.total >= crValue;
  }

  /**
   * @internal
   * Create message data for an action
   */
  _createActionMessageData(item, hasTargets, targets, roll = null, isCritical = false) {
    const messageData = {
      id: `${SYSTEM_ID}--message-${generateRandomElementId()}`,
      speaker: game.settings.get(SYSTEM_ID, 'chatMessageSenderIsActorOwner')
        ? ChatMessage.getSpeaker({ actor: this.actor })
        : null,
      flavor: `${item.name}`,
      rolls: roll ? [roll] : undefined,
      flags: {
        [SYSTEM_ID]: {
          data: {
            chatTemplate: "ActionRollChat",
            actor: this._buildActorData(this.actor),
            item: this._buildItemData(item),
            hasTargets,
            targets,
            isSuccess: false,
            isCritical: false,
            d20Result: null
          },
          state: {
            damageResults: false,
            initialised: false,
            mpCost: item.system.hasCostMP ? item.system.costMP : 0,
            mpRestored: false
          },
          css: `leather ${isCritical ? 'crit' : ''}`
        }
      }
    };

    if (roll) {
      messageData.flags[SYSTEM_ID].data.roll = roll.total;
    }

    return messageData;
  }

  /**
   * @internal
   * Builds a minimal data object for the actor to embed in a chat flag.
   */
  _buildActorData(actor) {
    return {
      _id: actor._id,
      uuid: actor.uuid,
      name: actor.name,
      img: actor.img
    };
  }

  /**
   * @internal
   * Builds a minimal data object for the item to embed in a chat flag.
   */
  _buildItemData(item) {
    return {
      _id: item._id,
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      type: item.type,
      system: {
        baseEffectHealing: item.system?.baseEffectHealing,
        baseEffectDamage: item.system?.baseEffectDamage,
        baseEffectRestoreMP: item.system?.baseEffectRestoreMP,
        baseEffectBP: item.system?.baseEffectBP,
        hasBaseEffectBarrier: item.system?.hasBaseEffectBarrier,
        directHitDamage: item.system?.directHitDamage,
        hasDirectHit: item.system?.hasDirectHit,
        CR: item.system?.CR,
        isHealerRecovery: Boolean(item?.system?.baseEffectHealing)
      }
    };
  }

  /**
   * @internal
   * Handle roll with modifiers
   */
  async _handleRollWithModifiers(item) {
    // Construct the final roll formula
    const formula = this._constructRollFormulaFromModifiers(item);

    // Combine formula with attribute checks, if any
    const { rollFormula, rollData } = await this._handleAttributeCheck(item, formula);
  
    // Evaluate the roll
    const roll = await new Roll(rollFormula, rollData).evaluate();
    
    // Detect critical hits
    const { isCritical, d20Result } = await this._handleCriticalHit(roll, item);

    game.system.log.o('[ABILITY:ROLL] Roll result:', {
      itemName: item.name,
      rollTotal: roll.total,
      isCritical,
      d20Result
    });

    return { roll, isCritical, d20Result };
  }

  /**
   * @internal
   * Constructs the roll formula by reading actor's extra modifiers.
   */
  _constructRollFormulaFromModifiers(item) {
    let [diceCount, diceType] = [1, 20];
    let formula = '';

    // Get modifiers from the options passed through
    const { bonusDice, penalty } = this.options?.extraModifiers || {};

    // If there's advantage or extra dice, we modify the standard d20
    if (bonusDice) {
      diceCount += parseInt(bonusDice, 10);
      // For advantage-like mechanics, use 'kh1' to keep the highest roll
      diceType = '20kh1';
    }

    // Build the formula piece
    formula = `${diceCount}d${diceType}${penalty ? ` - ${penalty}` : ''}`;
    return formula;
  }

  /**
   * @internal
   * Handle critical hit detection and processing
   */
  async _handleCriticalHit(roll, item) {
    const d20Term = roll.terms?.[0];
    if (!d20Term) {
      game.system.log.w("[CRITICAL] No d20 term found in roll:", roll);
      return { isCritical: false, d20Result: 0 };
    }

    const d20Result = d20Term.modifiers?.includes('kh1')
      ? Math.max(...d20Term.results.map(r => r.result))
      : d20Term.results?.[0]?.result ?? 0;

    const isCritical = d20Result === 20;

    game.system.log.d("[CRITICAL] Critical hit check:", {
      d20Result,
      isCritical,
      itemName: item.name,
      isHealerRecovery: Boolean(item?.system?.baseEffectHealing)
    });

    // If it's a critical hit, double the damage/healing dice
    if (isCritical) {
      this._doubleCriticalDamageIfNeeded(item);
    }

    return { isCritical, d20Result };
  }

  /**
   * @internal
   * Doubles relevant "dice" fields if item is a critical hit.
   */
  _doubleCriticalDamageIfNeeded(item) {
    // Determine which formulas to double based on item type
    let formulaFields = [];
    
    if (Boolean(item?.system?.baseEffectHealing)) {
      formulaFields.push('baseEffectHealing');
    }
    if (!formulaFields.length) {
      formulaFields = ['directHitDamage', 'baseEffectDamage'];
    }

    game.system.log.o('[CRITICAL] Doubling damage/healing for critical hit:', {
      itemName: item.name,
      formulaFields
    });

    for (const field of formulaFields) {
      const formula = item.system?.[field];
      game.system.log.o('[CRITICAL] Formula:', {
        field,
        formula
      });
      if (formula) {
        // Double the number of dice in all dice expressions
        const modifiedFormula = formula.replace(/(\d+)d(\d+)/g, (match, count, sides) => {
          return `${parseInt(count, 10) * 2}d${sides}`;
        });
        game.system.log.o('[CRITICAL] Modified formula:', {
          field,
          formula,
          modifiedFormula
        });
        item.system[field] = modifiedFormula;

      }
    }
  }

  /**
   * @internal
   * Handle attribute check
   */
  async _handleAttributeCheck(item, rollFormula, rollData = {}) {
    if (item.system.hasCheck) {
      const attrVal = this.actor.system.attributes.primary[item.system.checkAttribute]?.val || 0;
      rollData[item.system.checkAttribute] = attrVal;
      rollFormula += ` + @${item.system.checkAttribute}`;
    }
    return { rollFormula, rollData };
  }

  /**
   * @internal
   * Handle MP cost for an action
   * @param {Item} item - The action item
   * @return {Promise<void>} A promise that resolves when MP cost is handled
   */
  async _handleCostMP(item) {
    

    if (!item.system.hasCostMP || !item.system.costMP) {
      return;
    }

    const cost = item.system.costMP;
    const currentMP = this.actor.system.points.MP.val;


    try {
      // Update the actor's MP
      await this.actor.update({
        'system.points.MP.val': currentMP - cost
      });
    } catch (error) {
      game.system.log.e('[MP:COST] Error deducting MP cost:', error);
      throw error;
    }
  }

  /**
   * @internal
   * Handle MP restoration from an action (self only)
   * @param {Item} item - The action item
   * @return {Promise<void>} A promise that resolves when MP restoration is complete
   */
  async _handleMPRestoration(item) {
   
    if (!item.system.baseEffectRestoreMP) {
      return;
    }

    // Convert formula to string if it's a number
    const formula = String(item.system.baseEffectRestoreMP);
    const mpRoll = await new Roll(formula).evaluate();
    const mpAmount = mpRoll.total;


    // Calculate new MP value, not exceeding max MP
    const currentMP = this.actor.system.points.MP.val;
    const maxMP = this.actor.system.points.MP.max;
    const newMP = Math.min(currentMP + mpAmount, maxMP);


    try {
      // Update the actor's MP
      await this.actor.update({ "system.points.MP.val": newMP });
    } catch (error) {
      game.system.log.e('[MP:RESTORE] Error restoring MP:', error);
      throw error;
    }
  }

  /**
   * @internal
   * Handle barrier points from an action
   * @param {Item} item - The action item
   * @return {Promise<void>} A promise that resolves when barrier is applied
   */
  async _handleBarrier(item) {
   

    if (!item.system.baseEffectBP) {
      return;
    }

    const barrierAmount = item.system.baseEffectBP;
   

    const currentBP = this.actor.system.points.BP.val;
    const newBP = currentBP + barrierAmount;

   

    try {
      // Update the actor's BP
      await this.actor.update({ "system.points.BP.val": newBP });

      // Verify the update
      const updatedBP = this.actor.system.points.BP.val;
     
    } catch (error) {
      game.system.log.e('[BARRIER] Error applying barrier points:', error);
      throw error;
    }
  }

  /**
   * @internal
   * Check if there are any ability limiters active on the actor
   * @return {string|null} The type of limitation, if any
   */
  _checkAbilityLimiter() {
    const limiterEffect = this.actor.effects.find(e => 
      e.changes.some(c => c.key === 'AbilitiesLimiter')
    );
    
    if (!limiterEffect) return null;
    
    const limiterChange = limiterEffect.changes.find(c => c.key === 'AbilitiesLimiter');
    return limiterChange?.value || null;
  }
} 