/** Actor types supported by the shared organic-character rules (not robots/vehicles). */
export const RULES_ACTOR_TYPES=Object.freeze(["character","npc"]);
export const isMechanicalActor=actor=>[...RULES_ACTOR_TYPES,"robot","vehicle"].includes(actor?.type);
export const isRulesActor=actor=>RULES_ACTOR_TYPES.includes(actor?.type);
