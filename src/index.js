import '~/src/styles/Main.sass';

import FFACombat from './extensions/combat.js'
import FFXIVActor from './extensions/actor.js'
import RollGuards from "~/src/helpers/rolls/RollGuards";
import EffectManager from "~/src/helpers/rolls/handlers/EffectManager";
import RollCalcActor from "~/src/helpers/rolls/RollCalcActor";
import hooks from "~/src/hooks";
import { getTokenMovement, addTokenMovement } from '~/src/stores';


//- debug hooks
// CONFIG.debug.hooks = true;

//- Foundry Class Extensions
CONFIG.Combat.documentClass = FFACombat
CONFIG.Actor.documentClass = FFXIVActor

//- Override the standard FFXIVroll guards with an extension for automation
CONFIG.FFXIV.RollGuards = RollGuards;
CONFIG.FFXIV.EffectManager = EffectManager;
CONFIG.FFXIV.RollCalcActor = RollCalcActor;

//- Foundry game Hooks
hooks.init();
hooks.ready();
hooks.combatStart(); //- combat start sound; reset combatant slots
hooks.preCreateCombatant();
hooks.preDeleteChatMessage();
hooks.preUpdateToken();
hooks.updateCombat();
hooks.deleteCombat();


let totalDistance = 0;

function handleMouseDown(event) {
  const tool = game.activeTool;
  if (tool != 'select') return;
  if ((navigator.userAgent.indexOf('Mac') > 0 && event.metaKey) || (event.ctrlKey)) {
    if (canvas.controls.ruler.segments?.length) {
      const path = canvas.grid.measurePath(canvas.controls.ruler.segments);
      totalDistance = parseInt(path.distance);
    }
  }
}

Hooks.on('preUpdateToken', async (tokenDocument, update, options, userId) => {
  console.log('preUpdateToken', tokenDocument, update, options);
  
  // Handle undo
  if (options.isUndo) {
    const currentMovement = getTokenMovement(tokenDocument.id);
    // Get the last ruler segment distance
    const lastSegmentDistance = canvas.controls.ruler?.totalDistance || 0;
    
    if (currentMovement > 0) {
      // Subtract the last movement from our tracking
      addTokenMovement(tokenDocument.id, -Math.abs(lastSegmentDistance));
      console.log('Undo movement:', {
        tokenId: tokenDocument.id,
        subtractedDistance: lastSegmentDistance,
        newTotal: getTokenMovement(tokenDocument.id)
      });
    }
    return;
  }

  // Check if the movement was triggered by arrow keys and CTRL key
  if (!arrowKeysPressed) {
    // Movement is likely from CTRL+drag+space
    const availableMovement = tokenDocument.actor.system.attributes.secondary.spd.val;
    const currentMovement = getTokenMovement(tokenDocument.id);

    // Check if it's this token's turn in combat
    if (game.combat?.started) {
      const currentCombatant = game.combat.combatant;
      const isCurrentTurn = currentCombatant?.token?.id === tokenDocument.id;
      
      if (!isCurrentTurn) {
        ui.notifications.warn("You can only move on your turn.");
        delete update.x;
        delete update.y;
        return;
      }
    }

    // Use Foundry's ruler distance
    const measureDistance = canvas.controls.ruler?.totalDistance || 0;

    console.log('Movement Check:', {
      tokenId: tokenDocument.id,
      measureDistance,
      currentMovement,
      availableMovement,
      update
    });

    if (measureDistance === 0) return;

    console.log('Detailed Movement Check:', {
      tokenId: tokenDocument.id,
      measureDistance: Number(measureDistance),
      currentMovement: Number(currentMovement),
      availableMovement: Number(availableMovement),
      wouldBeTotal: Number(currentMovement) + Number(measureDistance),
      update
    });

    if (game.combat?.started && Number(currentMovement) + Number(measureDistance) > Number(availableMovement)) {
      const remainingMovement = Math.max(0, Number(availableMovement) - Number(currentMovement));
      ui.notifications.warn(`You don't have sufficient movement for that distance. You can still move ${remainingMovement} grid squares.`);
      delete update.x;
      delete update.y;
    } else if (game.combat?.started) {
      // Track the movement
      addTokenMovement(tokenDocument.id, Number(measureDistance));
      console.log('After adding movement:', {
        tokenId: tokenDocument.id,
        addedDistance: Number(measureDistance),
        newTotal: Number(getTokenMovement(tokenDocument.id))
      });
    }
  } else {
    // Disable arrow key movement
    console.log('Disable arrow keys movement');
    delete update.x;
    delete update.y;
  }
});

let arrowKeysPressed = false;

document.addEventListener('keydown', (event) => {
  if (!game.combat?.started) return;
  console.log('keyup event', event.key);
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'a' || event.key === 'd') {
    arrowKeysPressed = true;
  } else if (event.code === 'Space') {
    const tool = game.activeTool;
    if (tool != 'select') return;
    if (canvas.controls.ruler.segments?.length) {
      const path = canvas.grid.measurePath(canvas.controls.ruler.segments);
      totalDistance = parseInt(path.distance);
    }
    console.log('keyup space totalDistance', totalDistance);
  }
});

document.addEventListener('mouseup', (event) => {
  arrowKeysPressed = false;
});

document.addEventListener('keyup', (event) => {
  if (!game.combat?.started) return;
  console.log('keyup event', event.key);
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'a' || event.key === 'd') {
    arrowKeysPressed = false;
  }
});
