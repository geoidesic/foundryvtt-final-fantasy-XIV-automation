import { resetActionState, resetUses } from '~/src/helpers/util.js';

/**
 * Extended Combat class for Final Fantasy system
 * @extends {Combat}
 */
export default class FFCombat extends Combat {
  /**
   * Initialize the combat instance
   * @param {object} data - The combat data
   * @param {object} context - The initialization context
   */
  constructor(data, context) {
    super(data, context);
  }

  /**
   * Returns true if the current turn represents the end of the adventurer step
   * (i.e., if the current turn is the last PC and the next turn is an NPC)
   * @type {boolean}
   */
  get isAdventurerStepEnd() {
    if (!this.started || this.turn === null) return false;
    const currentCombatant = this.turns[this.turn];
    const nextCombatant = this.turns[this.turn + 1];
    return currentCombatant?.actor?.type === "PC" && nextCombatant?.actor?.type === "NPC";
  }

  /**
   * Returns true if the current turn represents the end of the enemy step
   * (i.e., if the current turn is the last NPC and the next turn is a PC or the round ends)
   * @type {boolean}
   */
  get isEnemyStepEnd() {
    if (!this.started || this.turn === null) return false;
    const currentCombatant = this.turns[this.turn];
    const nextCombatant = this.turns[this.turn + 1];
    return currentCombatant?.actor?.type === "NPC" && (!nextCombatant || nextCombatant?.actor?.type === "PC");
  }

  /**
   * Reset abilities and states, action slots, and effects for all combatants
   * @return {Promise<void>} Returns a promise that resolves when all combatants have been reset
   */
  async resetCombatantAbilities() {
    // Conditions that should persist through combat reset
    const persistentConditions = ['ko', 'dead', 'comatose', 'brink'];

    const combatants = this.combatants.contents;
    // For each combatant
    for (const combatant of combatants) {
      const actor = combatant.actor;
      if (!actor) continue;

      // Get all items that have limitations
      const items = actor.items.filter(i => i.system.hasLimitation);
      await resetUses(items);

      // Disable or delete all status effects except persistent conditions
      for (const effect of actor.effects) {
       
        if (effect.isTransferred) {
          await effect.update({ disabled: true });
        } else {
          // Skip effects that apply persistent conditions
          if (effect.statuses?.some(status => persistentConditions.includes(status))) {
            continue;
          }
          await effect.delete();
        }
      }
      await resetActionState(actor, true);
    }
  }

  /**
   * Return the Array of combatants sorted into initiative order
   * @return {Combatant[]} Array of sorted combatants
   */
  setupTurns() {
    this.turns ||= [];

    // Determine the turn order and the current turn
    const turns = this.combatants.contents.sort(this._sortCombatants);
    if (this.turn !== null) this.turn = Math.clamp(this.turn, 0, turns.length-1);

    // Update state tracking
    const currentTurn = turns[this.turn];
    this.current = this._getCurrentState(currentTurn);

    // One-time initialization of the previous state
    if (!this.previous) this.previous = this.current;

    // Return the array of prepared turns
    return this.turns = turns;
  }

  /**
   * Define how the array of Combatants is sorted in the displayed list
   * @param {Combatant} a - First combatant to compare
   * @param {Combatant} b - Second combatant to compare
   * @return {number} Sort order modifier
   * @protected
   */
  _sortCombatants(a, b) {
    const aIsNPC = a.actor?.type === "NPC";
    const bIsNPC = b.actor?.type === "NPC";
    
    // Set CSS classes based on the order
    if (aIsNPC && !bIsNPC) {
      a.css = 'npc-group-start'; // First NPC
      b.css = 'pc-group-end'; // Last PC before NPC
      return 1;
    } else if (!aIsNPC && bIsNPC) {
      a.css = 'pc-group-end'; // Last PC before NPC
      b.css = 'npc-group-start'; // First NPC
      return -1;
    }

    if (a.initiative === null && b.initiative === null) return 0;
    if (a.initiative === null) return 1;
    if (b.initiative === null) return -1;
    return b.initiative - a.initiative;
  }
}