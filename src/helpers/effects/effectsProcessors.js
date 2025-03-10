console.log("[FFXIV] | [EFFECTS PROCESSOR] onAbilityUse call stack:", {
  stack: new Error().stack,
  event,
  itemName: event.item?.name
}); 