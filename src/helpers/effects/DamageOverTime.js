import { SYSTEM_ID } from "~/src/helpers/constants";
import { ACTIVE_EFFECT_MODES } from "~/src/helpers/constants";

/**
 * Handles damage over time effects
 */
export default class DamageOverTime {
  /**
   * @param {Actor} actor - The actor this effect is applied to
   */
  constructor(actor) {
    this.actor = actor;
  }

  /**
   * Process the damage over time effect
   * @param {object} event - The event containing damage results
   * @return {Promise<void>} A promise that resolves when processing is complete
   */
  async process(event) {
    const { change, effect, isMovingForward = true } = event;
    const currentHP = this.actor.system.points.HP.val;
    const dotDamage = (parseInt(change.value) || 0) * (isMovingForward ? 1 : -1);
    
    if (dotDamage === 0) return;

    const newHP = Math.max(0, currentHP - dotDamage);
    game.system.log.o("[DOT] Applying damage:", {
      actor: this.actor.name,
      damage: dotDamage,
      newHP
    });

    await this.actor.update({ "system.points.HP.val": newHP });

    if (isMovingForward && this.actor.system.points.HP.val === 0 && !this.actor.statuses.has('ko')) {
      await this.actor.toggleStatusEffect("ko");
    }

    // Create chat message with correct props for RollChat
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flags: {
        [SYSTEM_ID]: {
          data: {
            chatTemplate: "RollChat",
            actor: {
              _id: this.actor.id,
              name: this.actor.name,
              img: this.actor.img
            },
            item: {
              name: effect.name,
              img: effect.img || effect.icon, // Support both v11 and v12
              type: "effect",
              system: {
                description: `${this.actor.name} ${isMovingForward ? 'takes' : 'recovers'} ${Math.abs(dotDamage)} damage ${isMovingForward ? 'from' : 'due to reversing'} ${effect.name}`,
                formula: dotDamage.toString()
              }
            }
          }
        }
      }
    });
  }

  /**
   * Handle DOT effects during combat updates
   * @param {Combat} combat - The combat being updated
   * @param {object} changed - The changes made to the combat
   * @param {object} options - Update options
   */
  async updateCombat(combat, changed, options) {
    // Only process if turn or round changed
    if (!("turn" in changed || "round" in changed) || changed.turn === null) {
      game.system.log.o("[DOT] Skipping - no turn/round change:", { changed });
      return;
    }

    // Only process for the previous combatant
    const previousCombatant = combat.turns[combat.previous?.turn];
    if (!previousCombatant || previousCombatant.actor.id !== this.actor.id) {
      game.system.log.o("[DOT] Skipping - not previous combatant:", { 
        actor: this.actor.name,
        previousCombatant: previousCombatant?.actor?.name,
        previousTurn: combat.previous?.turn,
        currentTurn: combat.turn
      });
      return;
    }

    const isMovingForward = options.direction === 1;
    const nextTurn = combat.previous?.turn + 1;
    const isLastTurn = nextTurn === combat.turns.length;
    const nextCombatant = isLastTurn ? combat.turns[0] : combat.turns[nextTurn];
    
    game.system.log.o("[DOT] Checking phase:", {
      actor: this.actor.name,
      direction: isMovingForward ? "forward" : "backward",
      previousType: previousCombatant?.actor?.type,
      nextType: nextCombatant?.actor?.type,
      nextTurn,
      totalTurns: combat.turns.length,
      isLastTurn,
      isWrapping: isLastTurn
    });

    // Find the last PC and NPC in the turn order
    const lastPC = [...combat.turns].reverse().find(t => t.actor?.type === "PC");
    const lastNPC = [...combat.turns].reverse().find(t => t.actor?.type === "NPC");

    // Check if this actor is the last of their type
    const isLastOfType = 
      (this.actor.type === "PC" && lastPC?.actor?.id === this.actor.id) ||
      (this.actor.type === "NPC" && lastNPC?.actor?.id === this.actor.id);

    // Check if this is a phase transition
    const nextType = nextCombatant?.actor?.type;
    const isPhaseTransition = 
      (this.actor.type === "PC" && nextType === "NPC") ||
      (this.actor.type === "NPC" && nextType === "PC") ||
      (isLastTurn && isLastOfType); // Also consider end of round as phase transition

    game.system.log.o("[DOT] Phase check:", {
      actor: this.actor.name,
      actorType: this.actor.type,
      nextType,
      isPhaseTransition,
      isLastOfType,
      isLastTurn
    });

    // Only process if this is a phase transition
    if (!isPhaseTransition) {
      game.system.log.o("[DOT] Skipping - not a phase transition:", {
        actor: this.actor.name,
        direction: isMovingForward ? "forward" : "backward",
        actorType: this.actor.type,
        nextType,
        isLastOfType
      });
      return;
    }

    // Check for relevant DOT effects
    const relevantEffects = this.actor.effects.filter(e => 
      !e.disabled && e.changes.some(c => c.key === "DamageOverTime" && c.mode === ACTIVE_EFFECT_MODES.CUSTOM)
    );

    if (relevantEffects.length === 0) {
      game.system.log.o("[DOT] Skipping - no relevant effects:", {
        actor: this.actor.name,
        effectCount: this.actor.effects.size
      });
      return;
    }

    game.system.log.o("[DOT] Processing combat update:", {
      actor: this.actor.name,
      direction: isMovingForward ? "forward" : "backward",
      phase: {
        currentType: this.actor.type,
        nextType
      }
    });

    // Process each relevant effect
    for (const effect of relevantEffects) {
      for (const change of effect.changes) {
        if (change.key === "DamageOverTime" && change.mode === ACTIVE_EFFECT_MODES.CUSTOM) {
          await Hooks.callAll('FFXIV.DamageOverTime', { 
            actor: this.actor, 
            change, 
            effect,
            isMovingForward 
          });
        }
      }
    }
  }
} 