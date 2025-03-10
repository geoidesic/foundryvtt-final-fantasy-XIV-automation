import { SYSTEM_ID } from "~/src/helpers/constants";

/**
 * Handles all attribute-related operations
 */
export default class AttributeHandler {
  /**
   * @param {Actor} actor - The actor this handler is for
   */
  constructor(actor) {
    this.actor = actor;
  }

  /**
   * Handle an action ability
   * @param {Object} [options={}] -  options
   * @return {Promise<{success: boolean, message: ChatMessage|null}>} Returns result of action handling
   */
  async handle(options = {}) {
    const { key, code } = options;
    const attributeValue = this.actor.system.attributes[key][code].val;
    const rollFormula = `1d20 + ${attributeValue}`;
    const attributeName = game.i18n.localize(`FFXIV.Types.Actor.Types.PC.Attributes.${key}.${code}.Abbreviation`);
    const roll = await new Roll(rollFormula).evaluate({ async: true });
    const isCritical = roll.total === 20;
    const messageData = {
      speaker: game.settings.get(SYSTEM_ID, 'chatMessageSenderIsActorOwner') ? ChatMessage.getSpeaker({ actor: this.actor }) : null,
      flavor: `${attributeName} ${game.i18n.localize('FFXIV.Check')}`,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      roll,
      flags: {
        [SYSTEM_ID]: {
          data: {
            chatTemplate: "AttributeRollChat",
            actor: {
              _id: this.actor._id,
              name: this.actor.name,
              img: this.actor.img
            },
            flavor: `${attributeName} ${game.i18n.localize('FFXIV.Check')}`,
            key: key,
            code: code,
            modifier: attributeValue,
            isCritical
          },
          css: `attribute-roll ${isCritical ? 'crit' : ''}`
        }
      }
    };
    await roll.toMessage(messageData);
  }
}