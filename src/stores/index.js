import { writable } from 'svelte/store';

//- tracks all current game targets (along with mapped metadata)
export const mappedGameTargets = writable(false);  

// Store for tracking token movement
const tokenMovement = new Map();
export const getTokenMovement = (tokenId) => tokenMovement.get(tokenId) || 0;
export const addTokenMovement = (tokenId, distance) => {
    const current = getTokenMovement(tokenId);
    tokenMovement.set(tokenId, current + distance);
};
export const resetTokenMovement = (tokenId) => {
    tokenMovement.set(tokenId, 0);
};

