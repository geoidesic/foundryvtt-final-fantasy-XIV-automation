import { activeEffectModes, SYSTEM_ID, ACTIVE_EFFECT_MODES } from "~/src/helpers/constants"
import effectProcessors from '../helpers/effects/index.js';

const BaseFFActor = (CONFIG && CONFIG.Combat && CONFIG.Actor.documentClass) || class {};


/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export default class FFXIVActor extends BaseFFActor {

  /**
   * Creates a new FFXIV actor
   * @param {object} data - The actor data
   * @param {object} context - The initialization context
   */
  constructor(data = {}, context) {
    super(data, context);
  }

  /**
   * Gets effects that enable combat turn slots
   * @return {Array<ActiveEffect>} effects on the actor that have a change with key = EnableCombatTurnSlot mode = custom
   */
  get enablerEffects() {
    return this.effects.filter(effect =>
      effect.changes.some(change =>
        change.key === 'EnableCombatTurnSlot' && change.mode === ACTIVE_EFFECT_MODES.CUSTOM
      )
    );
  }

  /**
   * Checks if item tags match enabler effect tags
   * @param {Item} item - The item to check
   * @return {boolean} Whether tags match
   */
  itemTagsMatchEnablerEffectTags(item) {
    const itemTags = item.system.tags;
    for (const effect of this.effects) {
      if (effect.system.tags?.some(tag => itemTags.includes(tag))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Add effects from an item to this actor
   * @param {Item} item - The item to add effects from
   * @return {Array} Array of effect UUIDs that were enabled
   */
  async addLinkedEffects(item) {
    if (!item.hasEffects) {
      game.system.log.p("[ADD LINKED EFFECTS] Item has no effects:", item);
      return [];
    }

    const effectsToCreate = [];
    for (const effect of item.effects) {
      // Log the full effect data for debugging
      game.system.log.p("[ADD LINKED EFFECTS] Processing effect:", {
        name: effect.name,
        system: effect.system,
        flags: effect.flags,
        origin: effect.origin
      });

      // Add detailed flag logging
      game.system.log.p("[ADD LINKED EFFECTS] Effect flags detail:", {
        rawFlags: effect.flags,
        systemFlags: effect.flags?.[SYSTEM_ID],
        stackableFlag: effect.getFlag(SYSTEM_ID, 'stackable'),
        overlayFlag: effect.getFlag(SYSTEM_ID, 'overlay')
      });

      const sourceActors = this.getEffectSources(effect);
      const stackingBehavior = effect.getFlag(SYSTEM_ID, 'stackable') || 'differentSource';

      // Handle different stacking behaviors
      switch (stackingBehavior) {
        case 'replaces':
          // Delete all existing instances of this effect before adding the new one
          const existingEffects = this.effects.filter(e => e.name === effect.name);
          game.system.log.p("[ADD LINKED EFFECTS] Found existing effects to replace:", existingEffects.length);
          for (const existingEffect of existingEffects) {
            game.system.log.p("[ADD LINKED EFFECTS] Removing existing effect for replacement:", existingEffect.name);
            await existingEffect.delete();
          }
          break;
        case 'anySource':
          // Always allow stacking
          break;
        case 'differentSource':
        default:
          // Only allow one instance per source
          if (sourceActors.has(this.uuid)) {
            game.system.log.p("[ADD LINKED EFFECTS] Effect already exists from this source:", {
              name: effect.name,
              source: this.uuid,
              existingSources: Array.from(sourceActors)
            });
            continue;
          }
      }

      const effectData = {
        ...effect.toObject(),
        disabled: false,
        // Maintain the original effect's origin
        origin: effect.origin || item.uuid,
        flags: {
          ...effect.flags,
          [SYSTEM_ID]: {
            ...effect.flags?.[SYSTEM_ID],  // Preserve existing system flags
            overlay: effect.getFlag(SYSTEM_ID, 'overlay'),
            stackable: effect.getFlag(SYSTEM_ID, 'stackable'),
            // Track who enabled this effect
            transferredBy: {
              actor: {
                uuid: this.uuid,
                name: this.name,
                img: this.img
              },
              item: {
                uuid: item.uuid,
                name: item.name
              }
            },
            // Maintain effect origin info needed by CombatSlotManager
            originEffect: {
              uuid: effect.uuid
            }
          }
        }
      };

      game.system.log.p("[ADD LINKED EFFECTS] Prepared effect data for creation:", effectData);
      effectsToCreate.push(effectData);
    }

    if (!effectsToCreate.length) {
      game.system.log.p("[ADD LINKED EFFECTS] No effects to add");
      return [];
    }

    game.system.log.p("[ADD LINKED EFFECTS] Creating effects on actor:", this.name, effectsToCreate);
    const created = await this.createEmbeddedDocuments("ActiveEffect", effectsToCreate);

    // Process hooks for newly created effects
    for (const effect of created) {
      if (!effect.isSuppressed) {
        await this._processEffectHooks(effect);
      }
    }

    game.system.log.p("[ADD LINKED EFFECTS] Created effects:", created.map(e => ({
      name: e.name,
      system: e.system,
      flags: e.flags,
      uuid: e.uuid
    })));
    return created.map(e => e.uuid);
  }

  /**
   * Process effect hooks for an effect
   * @param {ActiveEffect} effect - The effect to process hooks for
   * @return {Promise<void>} Returns a promise that resolves when hooks are processed
   */
  async _processEffectHooks(effect) {
    game.system.log.g("[PROCESS EFFECT HOOKS] Processing effect:", effect);
    game.system.log.g("[PROCESS EFFECT HOOKS] effectProcessors:", effectProcessors);

    for (const change of effect.changes) {
      const matchingMode = activeEffectModes.find(e => e.value === change.mode);
      if (matchingMode) {
        if (!effectProcessors[change.key]) {
          ui.notifications.error(`No effect processor found for key: ${change.key}`);
          return;
        }
        game.system.log.g("[PROCESS EFFECT HOOKS] Processing effect:", change.key);
        await Hooks.callAll(`FFXIV.${change.key}`, { actor: this, change, effect });
      } else {
        game.system.log.w("[PROCESS EFFECT HOOKS] No matching mode found for change:", change);
      }
    }
  }


  /**
   * Handles plugin overrides for status effect toggling
   */
  async handlePluginOverrides(movementSacrificingTraits) {

    //- if actor has focus, and has not moved, add the secondary action slot
    if (!this.statuses.has('focus') && !this.system.hasMoved && !this.hasSpecificDuplicate(this.system.actionState.available, 'secondary')) {

      for (const trait of movementSacrificingTraits) {
        //- find the related enabler slot for this and enable it
        const enablerEffects = trait.effects.filter(e =>
          e.changes.some(c => c.key === 'EnableCombatTurnSlot' && c.mode === ACTIVE_EFFECT_MODES.CUSTOM)
        );

        // Add each enabler slot to available if not already included
        for (const effect of enablerEffects) {
          for (const change of effect.changes) {
            if (change.key === 'EnableCombatTurnSlot' && change.mode === ACTIVE_EFFECT_MODES.CUSTOM) {
              const value = change.value;
              if (!this.system.actionState.available.includes(value)) {
                const updated = [...this.system.actionState.available, value];
                await this.update({
                  'system.actionState.available': updated
                });
              }
            }
          }
        }
      }

      await this.update({ system: { actionState: { available: [...this.system.actionState.available, 'secondary'] } } });
    }
    if (this.statuses.has('focus') && !this.system.hasMoved && this.hasSpecificDuplicate(this.system.actionState.available, 'secondary')) {

      for (const trait of movementSacrificingTraits) {
        //- find the related enabler slot for this and disable it
        const enablerEffects = trait.effects.filter(e =>
          e.changes.some(c => c.key === 'EnableCombatTurnSlot' && c.mode === ACTIVE_EFFECT_MODES.CUSTOM)
        );

        // Remove each enabler slot from available
        for (const effect of enablerEffects) {
          for (const change of effect.changes) {
            if (change.key === 'EnableCombatTurnSlot' && change.mode === ACTIVE_EFFECT_MODES.CUSTOM) {
              const value = change.value;
              if (this.system.actionState.available.includes(value)) {
                const updated = this.system.actionState.available.filter(slot => slot !== value);
                await this.update({
                  'system.actionState.available': updated
                });
              }
            }
          }
        }
      }

      await this.update({ system: { actionState: { available: this.removeFirstDuplicate(this.system.actionState.available, 'secondary') } } });
    }
  }
}