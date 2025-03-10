/**
 * Handles enabling additional combat turn slots
 */
export default class EnableCombatTurnSlot {
  /**
   * @param {Actor} actor - The actor this effect is applied to
   */
  constructor(actor) {
    this.actor = actor;
  }

  /**
   * Process the effect
   * @param {object} event - The event object containing actor, change, and effect
   * @return {Promise<void>} Returns a promise that resolves when the effect has been processed
   */
  async process(event) {

    const { actor, change } = event;
    const { value } = change;

    // Get current action state
    const current = actor.system.actionState.available;
    if (!Array.isArray(current)) {
      return;
    }


    // Only add if not already included
    if (!current.includes(value)) {
      const updated = [...current, value];
      
      // Update the actor's data directly first
      actor.system.actionState.available = updated;
      
      // Then persist the change
      await actor.update({
        'system.actionState.available': updated
      });
      
    }
  }
} 