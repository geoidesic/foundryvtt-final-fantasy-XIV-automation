import { resetActionState, resetUses } from '~/src/helpers/util.js';
const BaseFFCombat = eval("CONFIG?.Combat?.documentClass") || class {};

/**
 * Extended Combat class for Final Fantasy system
 * @extends {Combat}
 */
export default class FFCombat extends BaseFFCombat {
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

}