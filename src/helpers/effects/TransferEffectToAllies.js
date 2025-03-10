import { SYSTEM_ID } from "../constants";

/**
 * Handles transferring effects to allied actors
 */
export default class TransferEffectToAllies {
  /**
   * @param {Actor} actor - The actor this effect is applied to
   */
  constructor(actor) {
    this.actor = actor;
  }

  /**
   * Delete transferred effects from allies
   * @param {object} event - The event containing effect data
   * @return {Promise<void>} Returns a promise that resolves when the effects have been deleted
   */
  async delete(event) {
    const { effect } = event;

    const transferredEffects = game.actors.reduce((acc, actor) => {
      return acc.concat(actor.effects.filter(e => 
        e.getFlag(SYSTEM_ID, 'transferredBy.actor.uuid') === this.actor.uuid &&
        e.name === effect.name
      ));
    }, []);
    
    game.system.log.p("[EFFECT] Removing transferredEffects", transferredEffects);
    game.system.log.p("[EFFECT] Removing transferred effects for", effect.name);
    
    for (const transferredEffect of transferredEffects) {
      await transferredEffect.delete();
    }
  }

  /**
   * Process the transfer effect to allies
   * @param {object} event - The event containing effect data
   * @return {Promise<void>} A promise that resolves when processing is complete
   */
  async process(event) {
    game.system.log.p("[TRANSFER] Starting effect transfer process", event);
    const { effect } = event;
    game.system.log.p("[TRANSFER] Source actor:", this.actor.name);
    game.system.log.p("[TRANSFER] Effect:", effect);

    // Get stacking behavior
    const stackingBehavior = effect.getFlag(SYSTEM_ID, 'stackable') || 'differentSource';
   
    // Create the effect on each ally's actor
    for (const token of this.actor.allyTokens) {
      game.system.log.p("[TRANSFER] Processing token:", token.name);
      
      // Skip if no actor
      if (!token.actor) {
        game.system.log.p("[TRANSFER] No actor for token, skipping");
        continue;
      }

      // Handle stacking behavior
      if (stackingBehavior === 'replaces') {
        // Delete all existing instances of this effect before adding the new one
        const existingEffects = token.actor.effects.filter(e => e.name === effect.name);
        game.system.log.p("[TRANSFER] Found existing effects to replace:", existingEffects.length);
        for (const existingEffect of existingEffects) {
          game.system.log.p("[TRANSFER] Removing existing effect for replacement:", existingEffect.name);
          await existingEffect.delete();
        }
      }

      // Create a copy of the effect on the ally
      const effectData = {
        name: effect.name,
        img: effect.img,
        changes: foundry.utils.deepClone(effect.changes),
        flags: foundry.utils.deepClone(effect.flags),
        origin: effect.origin,
        disabled: false
      };

      game.system.log.p("[TRANSFER] Original effect flags:", effect.flags);
      game.system.log.p("[TRANSFER] Cloned effect flags:", effectData.flags);

      //NB: do not set duration as this will be controlled by the origin item
      effectData.flags[SYSTEM_ID] = {
        ...effectData.flags[SYSTEM_ID],
        transferredBy: {
          actor: {
            uuid: this.actor.uuid,
            name: this.actor.name,
            img: this.actor.img
          }
        }
      }

      game.system.log.p("[TRANSFER] Final effect flags after origin update:", effectData.flags);

      try {
        await token.actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
        game.system.log.p("[TRANSFER] Successfully created effect on", token.name, effectData, token.actor);
      } catch (error) {
        game.system.log.e("[TRANSFER] Error creating effect:", error);
      }
    }
  }
} 