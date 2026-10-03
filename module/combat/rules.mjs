import {tr} from "../i18n/index.mjs";
import {LABELS} from "../sheets/labels.mjs";
import {calculateTarget,calculateHealthTarget} from "../rolls/rules.mjs";
import {healthModifier,blockedReason} from "../health/rules.mjs";
import {ACTIONS, MOVEMENT, PHASES, ATTACK_MODIFIERS} from "./config.mjs";
import {normalizeWeaponCategory} from "../items/config.mjs";
import {effectivePowerHealth} from "../powers/rules.mjs";
import {specialActions} from "./optional/runtime.mjs";
import {enabled} from "./optional/settings.mjs";
import {mechanicalWounds} from "./optional/rules.mjs";

export function weaponSkill(key) {
  if (typeof key !== "string") throw Error(tr("Configura la habilidad del arma."));
  const paths = ["agility", "dexterity"].flatMap(group => Object.keys(LABELS.skillNames[group]).map(skill => `${group}.${skill}`));
  const path = paths.find(path => path === key || path.split(".")[1] === key);
  if (!path) throw Error(tr("El arma necesita una clave de habilidad de combate válida (p. ej. dexterity.laserWeapons)."));
  return path;
}
export function modifiersForAttack({baseValue, skill, category, pointBlank = false, healthStatus = "", healthKind = "", defending = false, gmModifier = 0,healthOverride=false}) {
  const melee = normalizeWeaponCategory(category) === "melee" || (skill.startsWith("agility.") && skill !== "agility.grenade");
  const modifiers = {
    pointBlank: pointBlank && !melee ? ATTACK_MODIFIERS.pointBlank : 0,
    wounded: healthOverride?0:healthModifier({status:healthStatus,kind:healthKind},skill),
    defenderEvading: defending ? ATTACK_MODIFIERS.defenderEvading : 0,
    gmModifier: calculateTarget(0, "normal", gmModifier).situationalModifier
  };
  const situational=modifiers.pointBlank+modifiers.defenderEvading+modifiers.gmModifier;
  return {...calculateHealthTarget(baseValue,"normal",situational,{status:healthStatus,kind:healthKind},healthOverride,skill), modifiers, melee};
}
export function phaseAfter(round, phase, direction = 1) {
  const phases = Object.keys(PHASES), index = phases.indexOf(phase);
  if (index < 0) throw Error(tr("Fase desconocida."));
  if (direction < 0) return {round, phase: phases[Math.max(0,index-1)]};
  return index === phases.length-1 ? {round: round+1, phase: phases[0]} : {round, phase: phases[index+1]};
}
export function validateDeclaration(data, isGM = false) {
  if (!Object.hasOwn({...ACTIONS,...specialActions(),...(enabled("burstFire")?{burst:tr("Ráfaga")}:{})},data.action) || !Object.hasOwn(MOVEMENT,data.movement)) throw Error(tr("Declaración no válida."));
  if (MOVEMENT[data.movement].gmOnly && !isGM) throw Error(tr("Zoom requiere autorización del DJ."));
  const override=isGM&&data.healthOverride===true;
  if(["attack","burst"].includes(data.action)&&MOVEMENT[data.movement].preventsAttack&&!override)throw Error(tr("Sprint impide atacar. Cambia acción o movimiento, o solicita una excepción del DJ."));
  return {action:data.action==="burst"?"attack":data.action,...(data.action==="burst"?{burst:true,targetIds:[...new Set(data.targetIds??[])]}:{}),movement:data.movement, defending:data.action === "evade" || data.defending === true,
    healthOverride:override,text:String(data.text ?? "").slice(0,500), weaponId:String(data.weaponId ?? ""), targetId:String(data.targetId ?? "")};
}
/** No later damage can erase this turn's valid declaration. No secret prose is published. */
export function actionSnapshot(combatant,declaration){
  if(!combatant.actor||!declaration)return null;
  if((blockedReason(effectivePowerHealth(combatant.actor))||combatant.defeated)&&!declaration.healthOverride)return null;
  if(declaration.action==="attack"&&MOVEMENT[declaration.movement]?.preventsAttack&&!declaration.healthOverride)return null;
  let weaponOperators=declaration.weaponOperators,integratedIds=declaration.integratedWeaponIds;
  if(weaponOperators){
    weaponOperators=Object.fromEntries(Object.entries(weaponOperators).map(([id,record])=>{
      const doc=globalThis.fromUuidSync?.(record.actorUuid),operator=doc?.documentName==="Actor"?doc:doc?.actor;
      const h=operator?effectivePowerHealth(operator):record.health;
      const eligible=(!globalThis.fromUuidSync||!!operator)&&(!operator||operator.system.cloneNumber===record.cloneNumber)&&(!blockedReason(h)||declaration.healthOverride);
      return [id,{...record,eligible,health:declaration.healthOverride?{status:"healthy",stunned:false}:{status:h.status,stunned:!!h.stunned,...(h.kind?{kind:h.kind}:{})}}];
    }));
    integratedIds=(integratedIds??[]).filter(id=>weaponOperators[id]?.eligible);
    if(declaration.action==="attack"&&!integratedIds.length)return null;
  }
  return {id:combatant.id,cloneNumber:combatant.actor.system.cloneNumber,
    ...(weaponOperators?{weaponOperators}:{}),
    health:declaration.healthOverride?{status:"healthy",stunned:false}:{status:effectivePowerHealth(combatant.actor).status,stunned:false,...(enabled("hitLocation")?{wounds:mechanicalWounds(combatant.actor.system.health.wounds)}:{}),...(combatant.actor.type==="vehicle"?{kind:"vehicle"}:{})},
    action:declaration.action,weaponId:declaration.weaponId,targetId:declaration.targetId,
    ...(declaration.burst?{burst:true,targetIds:[...declaration.targetIds]}:{}),
    ...(integratedIds?.length?{integratedWeaponIds:[...integratedIds]}:{}),
    movement:declaration.movement,defending:declaration.defending,healthOverride:!!declaration.healthOverride};
}
export function assertAttackAllowed({phase, declaration, resolved, eligible, override}) {
  if (override) return;
  if (phase !== "resolution") throw Error(tr("Los ataques se resuelven en la fase Resolución."));
  if (!eligible || declaration?.action !== "attack") throw Error(tr("No hay un ataque declarado para este turno."));
  if (resolved) throw Error(tr("Ya se ha resuelto un ataque este turno."));
  if (MOVEMENT[declaration.movement]?.preventsAttack&&!declaration.healthOverride) throw Error(tr("Sprint impide atacar este turno. El DJ puede autorizar una excepción."));
}
