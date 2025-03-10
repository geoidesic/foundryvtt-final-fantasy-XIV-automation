console.log("[FFXIVA] | [EFFECTS PROCESSOR] onAbilityUse call stack:", {
  stack: new Error().stack,
  event,
  itemName: event.item?.name
}); 