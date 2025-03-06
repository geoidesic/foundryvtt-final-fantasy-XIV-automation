import { writable, get, derived } from 'svelte/store';;
export const myStore = writable(false); 

// Function to reset all stores
export function resetStores() {
  myStore.set(false);
}