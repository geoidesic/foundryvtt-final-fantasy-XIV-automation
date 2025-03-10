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

  }
}