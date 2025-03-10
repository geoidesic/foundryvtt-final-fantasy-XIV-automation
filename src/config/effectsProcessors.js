import effects from '~/src/helpers/effects';

/**
 * Sets up all effect processors by registering their respective hook listeners
 * Each processor handles a specific type of effect in the system
 * @return {void} Nothing is returned
 */
export function setupEffectsProcessors() {
  game.system.log.o('[EFFECTS] Setting up effect processors');

  Hooks.on('FFXIV.processAdditionalBaseDamageFromItem', async (event) => {
    let processor = new effects.PrimaryBaseDamageBuff(event.actor);
    await processor.process(event);
    processor = new effects.AbilityBaseDamageBuff(event.actor);
    await processor.process(event);
  });

  Hooks.on('FFXIV.DamageDiceReroll', (event) => {
    const processor = new effects.DamageDiceReroll(event.actor);
    processor.process(event);
  });

  Hooks.on('FFXIV.EnableCombatTurnSlot', async (event) => {
    game.system.log.o('[EFFECTS] EnableCombatTurnSlot hook triggered:', event);
    const processor = new effects.EnableCombatTurnSlot(event.actor);
    await processor.process(event);
  });

  Hooks.on('FFXIV.TransferEffectToAllies', async (event) => {
    const processor = new effects.TransferEffectToAllies(event.actor);
    await processor.process(event);
  });
  
  Hooks.on('FFXIV.TransferEffectToAlliesDelete', async (event) => {
    const processor = new effects.TransferEffectToAllies(event.actor);
    await processor.delete(event);
  });

  Hooks.on('FFXIV.DamageOverTime', async (event) => {
    const processor = new effects.DamageOverTime(event.actor);
    await processor.process(event);
  });

  Hooks.on('FFXIV.ProcTrigger', async (event) => {
    const processor = new effects.ProcTrigger(event.actor);
    await processor.process(event);
  });

  // Add hook for damage-based duration effects
  Hooks.on('FFXIV.onDamage', async (event) => {
    const processor = new effects.DurationManager(event.actor);
    await processor.onDamage(event);
  });

  // Add hook for ability-use-based duration effects
  Hooks.on('FFXIV.onAbilityUse', async (event) => {
    console.log("[FFXIV] | [EFFECTS PROCESSOR] Handling onAbilityUse hook", {
      event,
      itemName: event.item?.name,
      isNewAbilityUse: event.isNewAbilityUse
    });
    const processor = new effects.DurationManager(event.actor);
    await processor.onAbilityUse(event);
  });
}