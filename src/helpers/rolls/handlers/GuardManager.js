import RollGuards from "~/src/helpers/rolls/RollGuards.js";

/**
 * Handles all guard checks
 */
export default class GuardManager {
  /**
   * @param {Actor} actor - The actor this handler is for
   * @param {RollGuards} rollGuards - The RollGuards instance to use for checks
   */
  constructor(actor) {
    this.actor = actor;
    this.RG = new RollGuards(actor);
  }

  /**
   * Handle guards for an item
   * @param {Item} item - The item to check guards for
   * @param {Array<string>} guardMethodNames - Array of guard method names to check
   * @return {Promise<boolean>} Returns true if all guards pass, false otherwise
   */
  async handleGuards(item, guardMethodNames) {
    // game.system.log.o('[GUARDS] Starting guard checks for:', {
    //   itemName: item.name,
    //   guardMethodNames
    // });

    // Run guards sequentially, stop on first failure
    for (const methodName of guardMethodNames) {
      const guardMethod = this.RG[methodName];
      if (!guardMethod) {
        game.system.log.w(`[GUARD] Guard method ${methodName} not found`);
        continue;
      }

      try {
        // game.system.log.o(`[GUARD] Running guard: ${methodName}`);
        const result = await guardMethod.call(this.RG, item);
        // game.system.log.o(`[GUARD] ${methodName} result:`, result);
        
        if (!result) {
          game.system.log.d(`[GUARD] ${methodName} check failed for ${item.name}`);
          return false;
        }
      } catch (error) {
        game.system.log.e(`[GUARD] Error in ${methodName} check:`, error);
        return false;
      }
    }
    // game.system.log.o('[GUARDS] All guards passed');
    return true;
  }
} 