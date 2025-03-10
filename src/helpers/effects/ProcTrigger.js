import { SYSTEM_ID } from "~/src/helpers/constants";

/**
 * Handles proc trigger effects
 */
export default class ProcTrigger {
  /**
   * @param {Actor} actor - The actor this effect is applied to
   */
  constructor(actor) {
    this.actor = actor;
  }

  /**
   * Process the proc trigger effect
   * @param {object} event - The event containing item and roll data
   * @return {Promise<void>} A promise that resolves when processing is complete
   */
  async process(event) {
    game.system.log.o('[PROC] Starting proc trigger process:', event);

    const { item, roll } = event;
    if (!item.system.procs?.list?.length) {
      game.system.log.o('[PROC] No procs in list, returning');
      return;
    }

    // Get d20 result - either from existing roll or make new roll
    let d20Result;
    if (item.system.hasCR && roll) {
      const d20Term = roll.terms[0];
      d20Result = d20Term.modifiers.includes('kh1') 
        ? Math.max(...d20Term.results.map(r => r.result))
        : d20Term.results[0].result;
      game.system.log.o('[PROC] Using existing roll d20 result:', d20Result);
    } else {
      const procRoll = await new Roll('1d20').evaluate();
      d20Result = procRoll.terms[0].results[0].result;
      game.system.log.o('[PROC] Made new roll d20 result:', d20Result);
    }

    if (!item.system.procTrigger || d20Result < item.system.procTrigger) {
      game.system.log.o('[PROC] Roll did not meet proc trigger threshold:', {
        procTrigger: item.system.procTrigger,
        d20Result
      });
      return;
    }

    game.system.log.o('[PROC] Processing proc effects');
    // Process each proc effect
    for (const procRef of item.system.procs.list) {
      game.system.log.o('[PROC] Processing proc ref:', procRef);
      
      const procItem = await fromUuid(procRef.uuid);
      if (!procItem) {
        game.system.log.o('[PROC] Could not find proc item:', procRef.uuid);
        continue;
      }
      game.system.log.o('[PROC] Found proc item:', procItem);

      // Add the proc effect directly to the actor
      game.system.log.o('[PROC] Adding proc effect to actor:', procItem.name);
      const addedEffects = await this.actor.addLinkedEffects(procItem);
      game.system.log.o('[PROC] Added effects:', addedEffects);

      // Send a chat message for the proc trigger
      await ChatMessage.create({
        user: game.user.id,
        speaker: game.settings.get(SYSTEM_ID, 'chatMessageSenderIsActorOwner') ? ChatMessage.getSpeaker({ actor: this.actor }) : null,
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
                _id: procItem._id,
                uuid: procItem.uuid,
                name: procItem.name,
                img: procItem.img,
                type: procItem.type,
                system: procItem.system
              }
            }
          }
        }
      });
    }
  }
}