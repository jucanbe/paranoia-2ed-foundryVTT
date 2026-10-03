import {SYSTEM_ID as NS} from "./config.mjs";
export const stateOf = combat => combat?.getFlag(NS,"state") ?? {phase:"npcDecision", unlocked:false, eligible:[]};
export const isNPC = combatant => combatant.actor?.type==="npc" || !combatant.actor?.hasPlayerOwner;
export const snapshotOf=(combat,c)=>stateOf(combat).snapshots?.find(s=>s.id===c?.id&&s.cloneNumber===c.actor?.system.cloneNumber)??null;
export const movementState=(combat,c)=>c.getFlag(NS,"movement")?.round===combat.round?c.getFlag(NS,"movement"):null;
export function declarationOf(combat, combatant) {
  if (!combatant) return null;
  if (isNPC(combatant)) {
    if (!game.user.isGM) return null;
    return game.messages.contents.findLast(m => {
      const d = m.getFlag(NS,"npcDeclaration");
      return m.author?.isGM && d?.combatId === combat.id && d.combatantId === combatant.id && d.round === combat.round;
    })?.getFlag(NS,"npcDeclaration") ?? null;
  }
  const declaration = combatant.getFlag(NS,"declaration");
  return declaration?.round === combat.round ? declaration : null;
}
export function attackState(combat, combatant) {
  const state = combatant.getFlag(NS,"attack");
  return state?.round === combat.round ? state : null;
}
export function canDeclare(combat, combatant, user=game.user) {
  if (!combat?.round || !combatant?.actor) return false;
  if (user.isGM) return true;
  const state = stateOf(combat);
  return !isNPC(combatant) && combatant.actor.testUserPermission(user,"OWNER") && (["playerDecision","surpriseResolution"].includes(state.phase) || state.unlocked);
}
export function npcRecords(combat) {
  return game.messages.filter(m => m.author?.isGM && m.getFlag(NS,"npcDeclaration")?.combatId === combat.id);
}
