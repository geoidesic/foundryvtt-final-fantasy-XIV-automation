import { mappedGameTargets } from '~/src/stores';

/**
 * Hook that runs when a token is targeted
 * @return {void}
 */
export default function targetToken() {

  /**
   * Used by chat messages to react to targeting changes.
   */
  Hooks.on("targetToken", (User, Token) => {

    const targets =
      game.user.targets
        // strip out this target if it is flagged as for untargeting, return all others
        .filter((target) => {
          if (Token._id === target._id && target == false) return false;
          return true;
        })
        // map the targets to the format needed for the store
        .map((target) => {
          return {
            avatar: target.document.texture.src,
            actorUuid: target.actor.uuid, // map the token actor (not the linked actor)
            clickedByUserId: User._id,
            tokenUuid: target.document.uuid
          }
        })
    mappedGameTargets.set(targets);

  });
}