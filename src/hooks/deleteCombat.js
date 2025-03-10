/**
 * Hook that runs when combat is deleted
 * @return {void}
 */
export default function deleteCombat() {
  Hooks.on("deleteCombat", async (combat) => {
    await combat.resetCombatantAbilities();
  });
  
}