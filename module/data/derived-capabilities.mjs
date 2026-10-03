export const BASIC_SKILL_ATTRIBUTES = Object.freeze([
  "agility", "dexterity", "perception", "cynicism", "mechanicalTalent"
]);

/** Paranoia 2E table supplied for this step. Zero is an ungenerated attribute. */
export function basicSkillForAttribute(value) {
  if (!isGeneratedAttribute(value)) return null;
  return [3, 6, 10, 14, 17, 20].findIndex(maximum => value <= maximum);
}

export function isGeneratedAttribute(value) {
  return Number.isInteger(value) && value >= 1 && value <= 20;
}

export function carryingCapacityForStrength(value) {
  if (!isGeneratedAttribute(value)) return null;
  return 25 + Math.max(0, value - 12) * 5;
}

/** The same table applies to Strength damage bonus and Endurance stamina bonus. */
export function bonusForAttribute(value) {
  if (!isGeneratedAttribute(value)) return null;
  return value <= 13 ? 0 : value <= 18 ? 1 : 2;
}
