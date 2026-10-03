import {tr,trHTML} from "../i18n/index.mjs";
import {SYSTEM_ID as NS, PHASES,COMBAT_TURN_SECONDS} from "./config.mjs";
import {weaponSkill, modifiersForAttack, phaseAfter, validateDeclaration, assertAttackAllowed,actionSnapshot} from "./rules.mjs";
import {stateOf, isNPC, declarationOf, attackState, canDeclare, npcRecords,snapshotOf,movementState} from "./state.mjs";
import {readCheck, rollCheck, postRolls} from "../rolls/service.mjs";
import {assertCanAct,blockedReason} from "../health/rules.mjs";
import {expireCombatStuns} from "../health/service.mjs";
import {resolveAttackDamage,resolveBurstDamage} from "./damage.mjs";
import {effectivePowerHealth,powerModifier} from "../powers/rules.mjs";
import {integratedSelection,attackSlot,allAttacksResolved} from "../robots/combat.mjs";

import {vehicleOperators,vehicleRoller,operatorAlreadyFired} from "../vehicles/combat.mjs";
import {enabled} from "./optional/settings.mjs";
import {RANGE_LABELS,malfunctions} from "./optional/rules.mjs";
import {optionalPreview,validateOptionalDeclaration,resolveHandling,recordShot,distanceMeters,specialActions} from "./optional/runtime.mjs";
import {executeWeaponRepair} from "./optional/repairs.mjs";

const render = (name,data) => foundry.applications.handlebars.renderTemplate(`systems/${NS}/templates/combat/${name}.hbs`,data);
export {render as renderCombat};
export function attackPreview(combat, combatant, options, user=game.user) {
  const snapshot=["resolution","surpriseResolution"].includes(stateOf(combat).phase)?snapshotOf(combat,combatant):null;
  const health=snapshot?.health??effectivePowerHealth(combatant.actor);
  assertCanAct({system:{health}},{override:!!options.override,user});
  const weapon = combatant.actor.items.get(options.weaponId);
  if (!weapon || weapon.type !== "weapon") throw Error(tr("Selecciona un arma del atacante."));
  const skill = weaponSkill(weapon.system.skill);
  const target = combat.combatants.get(options.targetId);
  if(options.targetId&&(!target?.actor||target.id===combatant.id||(!user.isGM&&target.hidden&&!target.actor.testUserPermission(user,"OWNER"))))throw Error(tr("Objetivo no válido."));
  const area = weapon.system.area || weapon.system.weaponCategory === "campaign";
  if (area && !target?.actor && !String(options.impactPoint ?? "").trim()) throw Error(tr("Selecciona un objetivo de referencia o indica el punto de impacto. El DJ resolverá el área manualmente."));
  if (!area && (!target?.actor || target.id === combatant.id || (!user.isGM && target.hidden && !target.actor.testUserPermission(user,"OWNER")))) throw Error(tr("Selecciona un objetivo válido del encuentro."));
  const declaration=snapshot??declarationOf(combat,combatant);
  const operator=vehicleRoller(combatant.actor,declaration,weapon.id);
  const {baseValue,name:skillName} = readCheck(operator.actor,"skill",skill);
  const rollHealth=operator.health??health;
  const storedModifier = combatant.getFlag(NS,"gmModifier") ?? 0;
  if (!user.isGM && Number(options.gmModifier ?? storedModifier) !== storedModifier) throw Error(tr("El modificador del DJ solo puede cambiarlo el DJ."));
  const defending=!area&&!!(snapshotOf(combat,target)??declarationOf(combat,target))?.defending;
  const gmModifier=(user.isGM?Number(options.gmModifier??storedModifier):storedModifier)+powerModifier(operator.actor,"skill",skill);
  const optional=optionalPreview({baseValue,weapon,c:combatant,target,declaration,targetDeclaration:snapshotOf(combat,target)??declarationOf(combat,target),options,user,health:rollHealth,defending,gmModifier});
  return {weapon, skill, skillName, operator, target:target?.actor?target:null, area,healthSnapshot:operator.health??snapshot?.health??null,
    ...modifiersForAttack({baseValue, skill, category:weapon.system.weaponCategory, pointBlank:options.pointBlank === true,
      healthStatus:rollHealth.status,healthKind:rollHealth.kind,healthOverride:!!options.override&&user.isGM, defending:!area && !!(snapshotOf(combat,target)??declarationOf(combat,target))?.defending,
      gmModifier}),...(optional?{...optional,optional:true}:{})};
}

async function clearTurn(combat) {
  const updates = combat.combatants.map(c => ({_id:c.id,flags:{[NS]:{
    declaration:new foundry.data.operators.ForcedDeletion(),attack:new foundry.data.operators.ForcedDeletion(),movement:new foundry.data.operators.ForcedDeletion(),gmModifier:new foundry.data.operators.ForcedDeletion(),otherAction:new foundry.data.operators.ForcedDeletion()
  }}}));
  if (updates.length) await combat.updateEmbeddedDocuments("Combatant",updates);
  const ids = npcRecords(combat).map(m=>m.id);
  if (ids.length) await foundry.documents.ChatMessage.deleteDocuments(ids);
}

async function changePhase(combat, operation, options) {
  const state = stateOf(combat);
  if(state.phase==="surpriseResolution"&&operation==="next"){
    const missing=pendingPhaseWork(combat);
    if(missing.count&&!options.force&&!await foundry.applications.api.DialogV2.confirm({window:{title:tr("Terminar Sorpresa")},content:trHTML`<p>${missing.count} ataques pendientes. ¿Continuar por decisión del DJ?</p>`,yes:{label:tr("Continuar")},no:{label:tr("Cancelar")}}))return null;
    await clearTurn(combat);
    return combat.update({round:1,turn:null,[`flags.${NS}.state`]:{...state,phase:"npcDecision",snapshotRound:null,snapshots:[],eligible:[],unlocked:false,surprise:{...state.surprise,resolved:true}}},{worldTime:{delta:COMBAT_TURN_SECONDS}});
  }
  if (operation === "unlock") return combat.setFlag(NS,"state",{...state,unlocked:!state.unlocked});
  let next = operation === "start" ? {round:1,phase:"npcDecision"} : operation === "reset" ? {round:combat.round,phase:"npcDecision"} : phaseAfter(combat.round,state.phase,operation === "previous" ? -1 : 1);
  if (operation === "next" && !options.force) {
    const missing = pendingPhaseWork(combat);
    if (missing.count && !await foundry.applications.api.DialogV2.confirm({window:{title:tr("Avanzar fase")},content:trHTML`<p>${missing.count} participantes tienen ${missing.label}. ¿Continuar?</p>`,yes:{label:tr("Continuar")},no:{label:tr("Cancelar")}})) return null;
  }
  let snapshots=state.snapshots??[];
  // Rewinding never destroys simultaneous entitlement or grants a second attack.
  if(next.phase==="resolution"&&!state.snapshotRound){
    snapshots=combat.combatants.map(c=>actionSnapshot(c,declarationOf(combat,c))).filter(Boolean);
  }
  if (next.round !== combat.round || operation === "start") await clearTurn(combat);
  const newRound=next.round!==combat.round||operation==="start";
  if(newRound)snapshots=[];
  const timeDelta=operation==="next"&&next.round>combat.round?COMBAT_TURN_SECONDS:0;
  const result=await combat.update({round:next.round,turn:null,[`flags.${NS}.state`]:{...state,phase:next.phase,unlocked:false,
    snapshots,snapshotRound:newRound?null:next.phase==="resolution"?next.round:state.snapshotRound??null,
    eligible:snapshots.filter(s=>s.action==="attack").map(s=>s.id)}},{worldTime:{delta:timeDelta}});
  await expireCombatStuns(combat);
  return result;
}

export function pendingPhaseWork(combat){
  const phase=stateOf(combat).phase;
  const pending=combat.combatants.filter(c=>{
    if(phase==="playerDecision")return !isNPC(c)&&c.actor&&!c.defeated&&!blockedReason(effectivePowerHealth(c.actor))&&!declarationOf(combat,c);
    if(["resolution","surpriseResolution"].includes(phase))return snapshotOf(combat,c)?.action==="attack"&&!allAttacksResolved(attackState(combat,c),snapshotOf(combat,c))||Object.hasOwn(specialActions(),snapshotOf(combat,c)?.action??"")&&c.getFlag(NS,"otherAction")?.round!==combat.round;
    if(phase==="movement")return !!declarationOf(combat,c)&&!blockedReason(effectivePowerHealth(c.actor))&&!movementState(combat,c)?.resolved;
    return false;
  });
  return {count:pending.length,label:phase==="playerDecision"?tr("declaraciones pendientes"):phase==="resolution"?tr("ataques pendientes"):tr("movimientos pendientes")};
}

async function saveDeclaration(combat, c, data, user) {
  assertCanAct(c.actor,{override:!!data.healthOverride,user});
  if (!canDeclare(combat,c,user)) throw Error(tr("Las declaraciones están bloqueadas o no controlas este personaje."));
  const declaration = {...validateDeclaration(data,user.isGM),round:combat.round};
  validateOptionalDeclaration(c.actor,c,declaration,user);
  const surprise=stateOf(combat).surprise;
  if(enabled("surprise")&&stateOf(combat).phase==="surpriseResolution"&&!surprise?.surprisingIds?.includes(c.id)&&!(declaration.action==="evade"||declaration.action==="move"&&declaration.defending)&&!declaration.healthOverride)throw Error(tr("El lado sorprendido solo puede defenderse durante Sorpresa."));
  if(declaration.burst){
    const weapon=c.actor.items.get(declaration.weaponId);if(!weapon?.system.burstCapable||declaration.targetIds.length<1||declaration.targetIds.length>weapon.system.burstMaxTargets)throw Error(tr("Ráfaga u objetivos no válidos."));
    for(const id of declaration.targetIds)if(id===c.id||!combat.combatants.get(id)?.actor)throw Error(tr("Objetivo de ráfaga no válido."));declaration.targetId=declaration.targetIds[0];
  }
  const integrated=integratedSelection(c.actor,data.integratedWeaponIds??[]);
  if(integrated.length){if(declaration.action!=="attack")throw Error(tr("La salva integrada requiere acción Atacar."));declaration.integratedWeaponIds=integrated;declaration.weaponId=integrated[0];}
  if(c.actor.type==="vehicle"&&declaration.action==="attack")declaration.weaponOperators=await vehicleOperators(c.actor,integrated,data.weaponOperators,!!data.healthOverride&&user.isGM);
  if(declaration.action==="attack"&&!declaration.weaponId)throw Error(tr("Selecciona un arma propia para declarar el ataque."));
  if (declaration.weaponId && c.actor.items.get(declaration.weaponId)?.type !== "weapon") throw Error(tr("Arma no válida."));
  if (declaration.targetId && !combat.combatants.has(declaration.targetId)) throw Error(tr("Objetivo no válido."));
  if (user.isGM) await c.setFlag(NS,"gmModifier",modifiersForAttack({baseValue:0,skill:"dexterity.laserWeapons",gmModifier:data.gmModifier ?? 0}).modifiers.gmModifier);
  if (isNPC(c)) {
    const records=npcRecords(combat).filter(m=>m.getFlag(NS,"npcDeclaration").combatantId===c.id);
    await foundry.documents.ChatMessage.create({content:tr("Declaración de PNJ (solo DJ)"),whisper:game.users.filter(u=>u.isGM).map(u=>u.id),flags:{[NS]:{npcDeclaration:{...declaration,combatId:combat.id,combatantId:c.id}}}},{notify:false});
    if(records.length) await foundry.documents.ChatMessage.deleteDocuments(records.map(m=>m.id));
  } else await c.setFlag(NS,"declaration",declaration);
  if (stateOf(combat).snapshotRound||stateOf(combat).phase==="surpriseResolution") {
    const state=stateOf(combat),snapshots=(state.snapshots??[]).filter(s=>s.id!==c.id);
    const snapshot=actionSnapshot(c,declaration);if(snapshot)snapshots.push(snapshot);
    await combat.setFlag(NS,"state",{...state,snapshotRound:combat.round,snapshots,eligible:snapshots.filter(s=>s.action==="attack").map(s=>s.id)});
  }
  return {saved:true};
}

async function attack(combat,c,options,user) {
  const state=stateOf(combat), snapshot=snapshotOf(combat,c),declaration=snapshot??declarationOf(combat,c), aggregate=attackState(combat,c);
  const slot=attackSlot(c.actor,declaration,options.weaponId),multi=slot!=="single",prior=multi?aggregate?.weapons?.[slot]:aggregate;
  if (options.override && !user.isGM) throw Error(tr("La excepción requiere al DJ."));
  assertAttackAllowed({phase:enabled("surprise")&&state.phase==="surpriseResolution"?"resolution":state.phase,declaration,resolved:!!prior?.resolved,eligible:!!snapshot,override:user.isGM && options.override});
  if (prior?.pending) throw Error(tr("Ya hay un ataque en curso. El DJ debe comprobar su resultado antes de desbloquearlo."));
  if(declaration?.burst)return burstAttack(combat,c,options,user,{state,snapshot,declaration,aggregate,slot,multi,prior});
  const preview=attackPreview(combat,c,options,user);
  if(!(c.actor.type==="robot"&&multi)&&!preview.operator.brain&&operatorAlreadyFired(combat,preview.operator.actor)&&!options.override)throw Error(tr("Este artillero ya ha disparado un arma este turno."));
  if (!user.isGM && ((!multi&&declaration.weaponId !== preview.weapon.id) || declaration.targetId !== (preview.target?.id??""))) throw Error(tr("El arma y objetivo deben coincidir con la declaración. Solicita al DJ un cambio."));
  const reserve=async value=>multi?c.update({[`flags.${NS}.attack.round`]:combat.round,[`flags.${NS}.attack.weapons.${slot}`]:value}):c.setFlag(NS,"attack",{round:combat.round,...value});
  await reserve({pending:true,resolved:false,operatorUuid:preview.operator.actor.uuid});
  let rolled=false;
  try {
    const result=await rollCheck({actor:preview.operator.actor,type:"skill",key:preview.skill,modifier:preview.situationalModifier-powerModifier(preview.operator.actor,"skill",preview.skill),healthOverride:!!options.override&&user.isGM,healthSnapshot:preview.healthSnapshot,createMessage:false});
    rolled=true;
    const shot=await recordShot(preview.weapon,result.dieResult,{override:!!options.override&&user.isGM,ignoreMalfunction:!!options.ignoreMalfunction&&user.isGM});
    // Public handoff contains identifiers and roll data only, never Actor system data.
    const handoff={combatId:combat.id,round:combat.round,combatantId:c.id,attacker:c.actor.uuid,target:preview.target?.actor.uuid ?? null,
      targetToken:preview.target?.token?.uuid ?? null,weaponId:preview.weapon.id,weapon:preview.weapon.uuid,weaponCategory:preview.weapon.system.weaponCategory,
      damageNumber:preview.weapon.system.damageNumber,damageNotation:preview.weapon.system.damageNotation,area:preview.area,
      impactPoint:preview.area ? String(options.impactPoint??"").trim().slice(0,200) : null,
      targetCloneNumber:preview.target?.actor.system.cloneNumber,attackerCloneNumber:c.actor.system.cloneNumber,
      skill:preview.skill,baseValue:preview.baseValue,modifiers:preview.modifiers,attackRoll:result.dieResult,attackTarget:result.finalTarget,
      hit:result.success&&shot.shot!=="cancel",specialResult:result.specialResult,specialLabel:result.specialResult?result.label:"",damagePending:result.success&&shot.shot!=="cancel",optional:preview.optional,malfunction:shot.malfunction,optionalNotes:shot.notes.join(" · "),
      attackerName:c.actor.name,targetName:preview.target?.name??String(options.impactPoint??""),weaponName:preview.weapon.name,skillName:result.name,
      experimental:preview.weapon.system.experimental,range:preview.weapon.system.range,damageStatus:preview.area?tr("Área: resolución manual del DJ"):preview.weapon.system.damageNumber==null?tr("ND no disponible"):tr("Pendiente de daño")};
    const content=await render("attack-chat",{...handoff,attackerName:c.actor.name,targetName:preview.target?.name ?? handoff.impactPoint,
      weaponName:preview.weapon.name,skillName:result.name,outcome:result.success?tr("IMPACTO"):tr("FALLO"),specialLabel:result.specialResult ? result.label : ""});
    const mode=Object.hasOwn(CONFIG.ChatMessage.modes,options.messageMode)?options.messageMode:game.settings.get("core","messageMode");
    handoff.messageMode=mode;
    const message=await postRolls(c.actor,[result.roll],content,mode,{[NS]:{attack:handoff}});
    await reserve({pending:false,resolved:true,operatorUuid:preview.operator.actor.uuid,messageId:message.id,result: {hit:result.success}});
    if(result.success&&shot.shot==="resolve")await resolveAttackDamage(message,{automatic:true});
    return {messageId:message.id,...message.getFlag(NS,"attack")};
  } catch(error) {
    // Never enable an automatic reroll after dice have been evaluated or chat may have been posted.
    if(!rolled) await reserve({pending:false,resolved:false});
    throw error;
  }
}

async function burstAttack(combat,c,options,user,{snapshot,declaration,aggregate,slot,multi,prior}){
  if(!enabled("burstFire"))throw Error(tr("Las ráfagas están desactivadas."));
  const ids=declaration.targetIds,weapon=c.actor.items.get(options.weaponId);
  if(!weapon?.system.burstCapable||!ids?.length||ids.length>Math.min(3,weapon.system.burstMaxTargets))throw Error(tr("Ráfaga no válida."));
  if(!user.isGM&&options.weaponId!==declaration.weaponId&&!multi)throw Error(tr("Usa el arma declarada."));
  const targets=ids.map(id=>combat.combatants.get(id));if(targets.some(t=>!t?.actor||t.id===c.id))throw Error(tr("Objetivo de ráfaga no válido."));
  for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){
    const distance=distanceMeters(targets[i].token,targets[j].token);
    if(distance!=null&&distance>weapon.system.burstMaxTargetSeparationMeters&&!options.override)throw Error(tr("Los objetivos de la ráfaga deben estar a 5 m o menos entre sí."));
    if(distance==null&&!(user.isGM&&(options.confirmBurstSeparation||options.override)))throw Error(tr("Distancia entre objetivos no verificable: el DJ debe confirmar la separación de la ráfaga."));
  }
  const previews=targets.map(t=>attackPreview(combat,c,{...options,...options.targetCircumstances?.[t.id],targetId:t.id,burstCount:ids.length},user));
  if(!(c.actor.type==="robot"&&multi)&&!previews[0].operator.brain&&operatorAlreadyFired(combat,previews[0].operator.actor)&&!options.override)throw Error(tr("Este artillero ya ha disparado este turno."));
  const reserve=value=>multi?c.update({[`flags.${NS}.attack.round`]:combat.round,[`flags.${NS}.attack.weapons.${slot}`]:value}):c.setFlag(NS,"attack",{round:combat.round,...value});
  if(weapon.system.ammoCurrent!=null&&enabled("ammunition")&&weapon.system.burstAmmoCost!=null&&weapon.system.ammoCurrent<weapon.system.burstAmmoCost&&!options.override)throw Error(tr("Munición insuficiente para la ráfaga."));
  await reserve({pending:true,resolved:false,operatorUuid:previews[0].operator.actor.uuid});let rolled=false;
  try{
    const rolls=[];for(const preview of previews){rolls.push(await rollCheck({actor:preview.operator.actor,type:"skill",key:preview.skill,modifier:preview.situationalModifier-powerModifier(preview.operator.actor,"skill",preview.skill),healthOverride:!!options.override&&user.isGM,healthSnapshot:preview.healthSnapshot,createMessage:false}));rolled=true;}
    const die=rolls.find(r=>enabled("malfunctions")&&malfunctions(weapon.system,r.dieResult))?.dieResult??rolls[0].dieResult;
    const shot=await recordShot(weapon,die,{burst:true,override:!!options.override&&user.isGM,ignoreMalfunction:!!options.ignoreMalfunction&&user.isGM});
    const mode=Object.hasOwn(CONFIG.ChatMessage.modes,options.messageMode)?options.messageMode:game.settings.get("core","messageMode");
    const data={attackerName:c.actor.name,weaponName:weapon.name,baseValue:previews[0].baseValue,burstSkill:previews[0].burstSkill,targetCount:ids.length,weapon:weapon.uuid,malfunction:shot.malfunction,notes:shot.notes.join(" · "),shots:previews.map((p,i)=>({combatId:combat.id,round:combat.round,combatantId:c.id,attacker:c.actor.uuid,target:p.target.actor.uuid,targetToken:p.target.token?.uuid??null,area:p.area,impactPoint:options.impactPoint??null,targetCloneNumber:p.target.actor.system.cloneNumber,targetName:p.target.name,weapon:weapon.uuid,weaponId:weapon.id,weaponCategory:weapon.system.weaponCategory,weaponName:weapon.name,damageNumber:weapon.system.damageNumber,attackRoll:rolls[i].dieResult,attackTarget:rolls[i].finalTarget,hit:rolls[i].success&&!(shot.shot==="cancel"&&malfunctions(weapon.system,rolls[i].dieResult)),damagePending:rolls[i].success&&!(shot.shot==="cancel"&&malfunctions(weapon.system,rolls[i].dieResult)),damageStatus:shot.shot==="manual"?tr("Avería: adjudicar disparo y daño"):tr("Pendiente"),messageMode:mode,modifiers:p.modifiers}))};
    const message=await postRolls(c.actor,rolls.map(r=>r.roll),await render("burst-chat",data),mode,{[NS]:{burstAttack:data}});
    await reserve({pending:false,resolved:true,messageId:message.id,operatorUuid:previews[0].operator.actor.uuid});
    if(shot.shot==="resolve")for(let i=0;i<data.shots.length;i++)if(data.shots[i].hit)await resolveBurstDamage(message,i,{automatic:true});
    return {messageId:message.id,burst:true};
  }catch(error){if(!rolled)await reserve({pending:false,resolved:false});throw error;}
}

/** Called only by the elected active GM; requester identity comes from Foundry's document event. */
export async function executeCombatRequest(request,user) {
  if(!game.user.isGM) throw Error(tr("Se necesita un DJ conectado."));
  if(request.operation==="weaponRepair")return executeWeaponRepair(await fromUuid(request.options?.weaponUuid),request.options,user);
  if(request.operation==="damage"){
    if(!user.isGM)throw Error(tr("Solo el DJ puede adjudicar el daño."));
    const message=game.messages.get(request.options?.messageId);
    return resolveAttackDamage(message,request.options);
  }
  const combat=game.combats.get(request.combatId);
  if(!combat) throw Error(tr("El encuentro ya no existe."));
  const {operation,options={}}=request;
  if (request.round !== combat.round || request.phase !== stateOf(combat).phase) throw Error(tr("La fase ha cambiado. Abre de nuevo el diálogo."));
  if(operation==="surprise"){
    if(!user.isGM||!enabled("surprise")||combat.round>1||stateOf(combat).snapshotRound||stateOf(combat).surprise?.resolved)throw Error(tr("La sorpresa requiere al DJ y se establece antes de la secuencia normal."));
    const ids=[...new Set(options.surprisingIds??[])];if(!ids.length||ids.some(id=>!combat.combatants.get(id)?.actor))throw Error(tr("Selecciona el lado que sorprende."));
    await clearTurn(combat);return combat.update({round:1,turn:null,[`flags.${NS}.state`]:{phase:"surpriseResolution",unlocked:false,snapshots:[],eligible:[],surprise:{surprisingIds:ids,surprisedIds:combat.combatants.filter(c=>!ids.includes(c.id)).map(c=>c.id),resolved:false}}});
  }
  if (["start","next","previous","reset","unlock"].includes(operation)) {
    if(!user.isGM) throw Error(tr("Solo el DJ puede cambiar la fase."));
    return changePhase(combat,operation,options);
  }
  const c=combat.combatants.get(request.combatantId);
  if(!c?.actor || (!user.isGM && (!c.actor.testUserPermission(user,"OWNER") || isNPC(c)))) throw Error(tr("No controlas este participante."));
  if(operation==="declare")return saveDeclaration(combat,c,options,user);
  if(operation==="handling"){
    if(!["resolution","surpriseResolution"].includes(stateOf(combat).phase)&&!(user.isGM&&options.override))throw Error(tr("El manejo del arma se completa en Resolución."));
    if(!snapshotOf(combat,c)&&!(user.isGM&&options.override))throw Error(tr("No hay acción válida en el estado inicial de Resolución."));
    return resolveHandling(combat,c,{override:user.isGM&&options.override});
  }
  if(operation==="setReady"){
    if(!user.isGM||!enabled("weaponHandling")||(combat.round>0&&!options.override))throw Error(tr("La preparación directa requiere al DJ antes del combate o una excepción explícita."));
    const ids=options.weaponIds??[];if(ids.some(id=>c.actor.items.get(id)?.type!=="weapon"))throw Error(tr("Arma no válida."));return c.setFlag(NS,"weaponReady",ids);
  }
  if(operation==="preview") {
    if(!user.isGM && !["resolution","surpriseResolution"].includes(stateOf(combat).phase))throw Error(tr("La vista del ataque está disponible durante Resolución."));
    const p=attackPreview(combat,c,{...options,...options.targetCircumstances?.[options.targetId]},user);
    return {baseValue:p.baseValue,burstSkill:p.burstSkill??p.baseValue,finalTarget:p.finalTarget,modifiers:p.modifiers,area:p.area,skillName:p.skillName,range:enabled("range")?trHTML`${RANGE_LABELS[p.band]??p.band} · máximo ${p.weapon.system.maxRangeMeters??tr("sin verificar")} m${p.distance!=null?trHTML` · distancia ${p.distance} m`:""}`:p.weapon.system.range,experimental:p.weapon.system.experimental};
  }
  if(operation==="attack")return attack(combat,c,options,user);
  if(operation==="markAttack"&&user.isGM){
    const ids=snapshotOf(combat,c)?.integratedWeaponIds??[];
    await c.setFlag(NS,"attack",{round:combat.round,pending:false,resolved:true,manual:true,...(ids.length?{weapons:Object.fromEntries(ids.map(id=>[id,{resolved:true,pending:false,manual:true}]))}:{})});return {resolved:true};
  }
  if(operation==="movement"){
    if(stateOf(combat).phase!=="movement")throw Error(tr("El movimiento se completa en su fase."));
    assertCanAct(c.actor,{override:user.isGM&&options.override,user});
    await c.setFlag(NS,"movement",{round:combat.round,resolved:true});return {resolved:true};
  }
  if(operation==="release" && user.isGM){await c.unsetFlag(NS,"attack");return {released:true};}
  throw Error(tr("Operación de combate no válida."));
}

export async function cleanupCombat(combat) {
  if(!game.user.isGM)return;
  const records=npcRecords(combat);
  if(records.length)await foundry.documents.ChatMessage.deleteDocuments(records.map(m=>m.id));
}
