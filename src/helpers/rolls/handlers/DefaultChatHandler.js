import { SYSTEM_ID } from "~/src/helpers/constants.js";

/**
 * Handles the default chat message for an item
 */
export default class DefaultChatHandler {
  /**
   * @param {Actor} actor - The actor this handler is for
   */
  constructor(actor) {
    this.actor = actor;
  }

  /**
   * @param {Item} item - The item to create a chat message for
   */
  handle(item) {
    ChatMessage.create({
      user: game.user.id,
      speaker: game.settings.get(SYSTEM_ID, 'chatMessageSenderIsActorOwner')
        ? ChatMessage.getSpeaker({ actor: this.actor })
        : null,
      flags: {
        [SYSTEM_ID]: {
          data: {
            chatTemplate: 'RollChat',
            actor: {
              _id: this.actor._id,
              name: this.actor.name,
              img: this.actor.img
            },
            item: {
              _id: item._id,
              uuid: item.uuid,
              name: item.name,
              img: item.img,
              type: item.type,
              system: item.system
            }
          }
        }
      }
    });
  }
}
