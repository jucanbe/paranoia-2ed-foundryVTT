import { LABELS } from "./labels.mjs";
import { BASIC_SKILL_ATTRIBUTES } from "../data/derived-capabilities.mjs";

/** Shared presentation only; all calculations belong to the DataModel. */
export function capabilityRows(system) {
  const row = (label, value, key) => {
    const available = Number.isFinite(value);
    let display = available ? String(value) : "—";
    if (available && key === "carryingCapacity") display += " kg";
    if (available && key === "damageBonus" && value > 0) display = `+${value}`;
    return {label, value: display, pending: !available};
  };
  return [
    ...["carryingCapacity", "damageBonus", "stamina"].map(key => row(LABELS[key], system[key], key)),
    ...BASIC_SKILL_ATTRIBUTES.map(key => row(`${LABELS.basicSkill} ${LABELS.attributeNames[key]}`, system.basicSkills?.[key]))
  ];
}
