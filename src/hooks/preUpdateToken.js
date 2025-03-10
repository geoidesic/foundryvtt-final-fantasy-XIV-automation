/**
 * Hook that runs before a token is updated
 * @return {void}
 */
export default function preUpdateToken() {
  Hooks.on('preUpdateToken', async (tokenDocument, update) => {
    // prevent movement while focused
    const actor = game.actors.get(tokenDocument.actorId);
    if (actor.statuses.has('focus') && (update.x || update.y)) {
      delete update.x;
      delete update.y;
      ui.notifications.warn(game.i18n.localize("FFXIVA.Errors.CannotMoveWhileFocused"))
    }
  
    //- indicate that the actor has moved
    if (update.x || update.y) {
      actor.update({ system: { hasMoved: true } });
    }
  });
  

}