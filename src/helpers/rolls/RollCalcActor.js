import { SYSTEM_ID } from "~/src/helpers/constants.js"
import ActionHandler from "./handlers/ActionHandler.js";
import AttributeHandler from "./handlers/AttributeHandler.js";
import EffectManager from "./handlers/EffectManager.js";
import CombatSlotManager from "./handlers/CombatSlotManager.js";
import GuardManager from "./handlers/GuardManager.js";
import DefaultChat from "~/src/helpers/rolls/handlers/DefaultChatHandler.js";


/**
 * Extends RollCalc to handle actor-specific roll calculations
 * @extends {RollCalc}
 */
export default class RollCalcActor extends CONFIG.FFXIV.RollCalc {


  constructor(params) {
    super(params);
    this.params = params;
    this.ActionHandler = new ActionHandler(params.actor);
    this.AttributeHandler = new AttributeHandler(params.actor);
    this.EffectManager = new EffectManager(params.actor);
    this.CombatSlotManager = new CombatSlotManager(params.actor);
    this.GuardManager = new GuardManager(params.actor);
    this.DefaultChat = new DefaultChat(params.actor);
  }

  /**
   * @param {Item} item - The item to create a chat message for
   */
  defaultChat(item) {
    this.DefaultChat.handle(item);
  }

  /**
   * @param {Item} item - The equipment item
   */
  equipment(item) {
    this.params.item = item;
    ChatMessage.create({
      user: game.user.id,
      speaker: game.settings.get(SYSTEM_ID, 'chatMessageSenderIsActorOwner') ? ChatMessage.getSpeaker({ actor: this.params.actor }) : null,
      flags: { [SYSTEM_ID]: { data: { ...this.params, chatTemplate: 'EquipmentChat' } } }
    })
  }

  /**
   * @param {string} key - The attribute key
   * @param {string} code - The attribute code
   */
  attribute(key, code) {
    this.AttributeHandler.handle({key, code});
  }

  /**
   * @param {string} type - The type of ability
   * @param {Item} item - The ability item
   */
  ability(type, item) {
    console.log("[FFXIVA] | [ABILITY CHAIN] Starting ability chain", {
      // Add relevant details
    });
    this._routeAbility(item);
  }

  /**
   * @param {Item} item - The trait item
   */
  abilityTrait(item) {
    this.defaultChat(item);
  }

  /**
   * @param {Item} item - The action item
   * @param {Object} [options={}] - Additional options
   */
  async abilityAction(item, options = {}) {

    try {
      game.system.log.d("game.combat?.started", game.combat?.started);
      // Some guards only apply to combat
      if (!game.combat?.started) {
        if (!(await this.GuardManager.handleGuards(item, [
          'isAction', 'hasModifiers'
        ]))) {
          return;
        }
      } else {
        // Early return if guards fail
        if (!(await this.GuardManager.handleGuards(item, [
          'isAction', 'hasNoUnappliedDamage', 'isActorsTurn', 
          'isReaction', 'targetsMatchActionIntent', 'hasRequiredEffects',
          'hasAvailableActionSlot', 'hasRemainingUses','meetsMPCost', 'hasModifiers', 
        ]))) {
          return;
        }
      }

      // Get the modifiers from the guard
      const extraModifiers = this.GuardManager.RG.shuttle.hasModifiers.extraModifiers;

      // Handle the action
      const result = await this.ActionHandler.handle(item, { ...options, extraModifiers });
      if (!result.handledSuccessfully) {
        return;
      }

      // Handle proc triggers
      if (item.system.procTrigger) {
        Hooks.callAll('FFXIV.ProcTrigger', {
          actor: this.params.actor,
          item,
          roll: result.roll,
          targets: result.targets
        });
      }

      // Handle effects
      await this.EffectManager.handleEffects(item, result);

      // Mark slot as used
      await this.CombatSlotManager.markSlotUsed(item, result);

    } catch (error) {
      game.system.log.e("Error in ability action", error);
      ui.notifications.error(game.i18n.format("FFXIV.Errors.AbilityActionFailed", { target: this.params.actor.name }));
    }
  }

  /**
   * Route ability to appropriate handler
   * @param {Item} item - The item to route
   * @return {Promise<void>} Returns a promise that resolves when the ability has been routed and handled
   */
  _routeAbility(item) {
    if (item.type === "action") {
      this.abilityAction(item);
    } else if (item.type === "trait") {
      this.abilityTrait(item);
    }
  }
}