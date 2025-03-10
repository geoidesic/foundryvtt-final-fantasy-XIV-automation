// Class for general global variables.

export const MODULE_ID = 'foundryvtt-final-fantasy-XIV-automation';
export const MODULE_TITLE = 'Final Fantasy XIV Automation';
export const MODULE_CODE = 'FFXIVA';
export const LOG_PREFIX = 'FFXIV [Automation] |';
export const MYSTERY_MAN = 'icons/svg/mystery-man.svg';
export const NONE_ICON = 'icons/svg/cancel.svg';
export const SYSTEM_ID = 'foundryvtt-final-fantasy';
export const SYSTEM_CODE = 'FFXIV';


export const ACTIVE_EFFECT_MODES = {
  CUSTOM: 0,
  MULTIPLY: 1,
  ADD: 2,
  OVERRIDE: 3,
  DOWNGRADE: 4,
  UPGRADE: 5
};

export const activeEffectModes = [
  { value: ACTIVE_EFFECT_MODES.CUSTOM, label: "custom" },
  { value: ACTIVE_EFFECT_MODES.MULTIPLY, label: "multiply" },
  { value: ACTIVE_EFFECT_MODES.ADD, label: "add" },
  { value: ACTIVE_EFFECT_MODES.OVERRIDE, label: "override" },
  { value: ACTIVE_EFFECT_MODES.DOWNGRADE, label: "downgrade" },
  { value: ACTIVE_EFFECT_MODES.UPGRADE, label: "upgrade" }
];