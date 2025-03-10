/**
 * Hook that runs when a combatant is updated
 * @return {void}
 */
export default function updateCombatant() {

/**
 * Handle combat tracker sorting and visual grouping
 */
Hooks.on("updateCombatant", async (combatant, updateData) => {


  const combat = combatant.parent;
  if (!combat) {
    return;
  }

  // Get and sort all combatants
  const turns = combat.turns;


  // Sort the turns array
  turns.sort((a, b) => {
    const aIsNPC = a.actor?.type === "NPC";
    const bIsNPC = b.actor?.type === "NPC";

    // First sort by PC/NPC status
    if (aIsNPC !== bIsNPC) return aIsNPC ? 1 : -1;

    // Then sort by initiative within each group
    const ia = Number.isNumeric(a.initiative) ? a.initiative : -9999;
    const ib = Number.isNumeric(b.initiative) ? b.initiative : -9999;
    return ib - ia;
  });


  // Find the first NPC index
  const firstNPCIndex = turns.findIndex(t => t.actor?.type === "NPC");

  // Update the turn order in the combat document
  await combat.update({ turns: turns });

  // Add visual grouping via CSS
  if (firstNPCIndex > 0 && firstNPCIndex < turns.length) {
    const tracker = ui.combat;
    if (!tracker) {
      return;
    }

    const combatants = tracker.element.find('.combatant');

    combatants.each((index, element) => {
      const $element = $(element);


      // Remove existing border classes
      $element.removeClass('npc-group-start pc-group-end');

      // Add appropriate border class
      if (index === firstNPCIndex) {
        $element.addClass('npc-group-start');
      } else if (index === firstNPCIndex - 1) {
        $element.addClass('pc-group-end');
      }
    });
  }

});

}