
import { LOG_PREFIX, MODULE_CODE } from "~/src/helpers/constants"

export const log = {
  ASSERT: 1, ERROR: 2, WARN: 3, INFO: 4, DEBUG: 5, VERBOSE: 6,
  set level(level) {
    this.a = (level >= this.ASSERT) ? console.assert.bind(window.console, LOG_PREFIX) : () => { };
    this.e = (level >= this.ERROR) ? console.error.bind(window.console, LOG_PREFIX) : () => { };
    this.w = (level >= this.WARN) ? console.warn.bind(window.console, LOG_PREFIX) : () => { };
    this.i = (level >= this.INFO) ? console.info.bind(window.console, LOG_PREFIX) : () => { };
    this.d = (level >= this.DEBUG) ? console.debug.bind(window.console, LOG_PREFIX) : () => { };
    this.v = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX) : () => { };
    this.loggingLevel = level;
  },
  get level() { return this.loggingLevel; }
};

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function isNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

export function ucfirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function camelCaseToTitleCase(camelCaseStr) {
  const words = camelCaseStr.replace(/([A-Z])/g, ' $1').trim();
  const titleCaseStr = words.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return titleCaseStr;
}

export function truncate(str, n) {
  return str.length > n ? str.substr(0, n - 1) + "..." : str;
}

/**
 * Generates a random element ID
 * @param {number} length - The length of the ID
 * @return {string} The generated ID
 */
export function generateRandomElementId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getActorOwner(actor) {
  const owners = getOwners(actor);
  if (owners.length === 0) {
    return game.user;
  }
  if (owners.length === 1) {
    return owners[0];
  }

  let owner = owners.reduce((owner, currentOwner) => {
    if (!currentOwner.isGM) {
      owner = currentOwner;
    }
    return owner;
  }, null);

  if (!owner) {
    if (game.user.isGM) {
      return game.user;
    }
  }

  if (!owner) {
    return game.user;
  }

  return owner;
}

export function getGMs() {
  return game.users.filter(u => u.isGM).map(u => u.id)
}

/**
 * This is necessary because of a wierd context difference between foundry and svelte
 * Foundry's update method interprets dot notation as data nodes and so creates a nested data structure from it if you use it as a key
 * Svelte's stores do not, they use it as a string literal.
 * If you're trying to use actor uuid as a storage key then this conversion becomes necessary
 * @param {string} uuid 
 * @returns {string} replaces dots with underscores
 */
export function encodeUuidString(uuid) {
  return uuid.replace(/\./g, "_");
}
export function decodeUuidString(uuid) {
  return uuid.replace(/_/g, "\.");
}

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Gets a localized string
 * @param {string} string - The string to localize
 * @return {string} The localized string
 */
export function localize(string) {
  if (typeof game === 'undefined') return string; //- avoid lint error
  return game.i18n.localize(`${MODULE_CODE}.${string}`);
}

/**
 * Check if an effect has the enabler tag
 * @param {ActiveEffect} effect - The effect to check
 * @return {boolean} - Whether the effect has the enabler tag
 */
export function isEnablerEffect(effect) {
  return effect?.system?.tags?.includes('enabler') ?? false;
}

/**
 * Resets the action state (or slots) for an actor. 
 * This is used to reset the action slots for an actor, e.g when they enter combat.
 * @todo probably should be moved to Actor class
 * @param {Actor} actor The actor to reset
 * @return {Promise<void>} A promise that resolves when the actor is updated
 */
export const resetActionState = async (actor) => {
  // Reset action state
  const baseActions = ['primary', 'secondary'];
  const extraActions = actor.statuses.has('focus') ? ['secondary'] : [];

  await actor.update({
    'system.actionState': {
      available: [...baseActions, ...extraActions],
      used: []
    }
  });
};

/**
 * Resets uses for a collection of items
 * @param {Item[]} items The items to reset
 * @return {Promise<void>} A promise that resolves when all items are updated
 */
export const resetUses = async (items) => {
  for (const item of items) {
    await item.update({ system: { uses: 0 } });
  }
}