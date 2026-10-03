import {tr,trHTML,localizedRecord} from "../i18n/index.mjs";
import {isRulesActor} from "../actors/types.mjs";
import {identifyPower,POWER_RESULTS} from "./registry.mjs";
import {POWER_NS as NS,pointsFor,spendPoints,recoverPoints,powerResult,effectivePowerHealth,regenerationAllowed} from "./rules.mjs";
import {rollCheck} from "../rolls/service.mjs";
import {calculateTarget,DIFFICULTIES} from "../rolls/rules.mjs";
import {assertCanAct} from "../health/rules.mjs";
import {applyHealthResult,applyTreatment} from "../health/service.mjs";
import {snapshotOf,stateOf} from "../combat/state.mjs";
import {trackPowerEffect,endPowerEffect} from "./effects.mjs";

/** Original power remains on the legacy path. Learned powers share its Attribute/PM pool. */
export function availablePowers(actor){
  const keys=[identifyPower(actor.system.mutantPower.name)?.key,...(actor.system.mutantPower.learned??[]).map(p=>p.key)];
  return [...new Set(keys.filter(Boolean))].map(identifyPower).filter(Boolean);
}
export function ownedPower(actor,key){
  return key?availablePowers(actor).find(p=>p.key===key)??null:identifyPower(actor.system.mutantPower.name);
}
export function psionicTrainingLevels(actor){
  const membership=actor.system.secretSociety;
  if(membership?.societyKey!=="psionics")return [];
  const learned=actor.system.mutantPower.learned??[];
  return [...new Set(membership.psionicLevels??[])].filter(level=>!learned.some(p=>p.source==="psionics"&&p.societyLevel===level));
}
const learningQueues=new Map();
export function learnPsionicPower(actor,key,level){
  requirePowerOwner(actor);if(!game.user.isGM)throw Error(tr("Solo el DJ puede elegir el nuevo poder psiónico."));
  const result=(learningQueues.get(actor.uuid)??Promise.resolve()).catch(()=>{}).then(async()=>{
    if(!Number.isSafeInteger(level)||!psionicTrainingLevels(actor).includes(level))throw Error(tr("Este nivel no tiene instrucción pendiente o ya concedió un poder."));
    const power=identifyPower(key);if(!power)throw Error(tr("Elige un poder del registro."));
    if(availablePowers(actor).some(p=>p.key===power.key))throw Error(tr("El personaje ya posee ese poder; elige uno nuevo."));
    const previous=JSON.stringify(actor.system.mutantPower.learned??[]);
    const learned=[...(actor.system.mutantPower.learned??[]),{id:foundry.utils.randomID(),key:power.key,source:"psionics",societyLevel:level,membershipId:actor.system.secretSociety.id,learnedAt:Date.now()}];
    new CONFIG.Actor.dataModels[actor.type]({...actor.system.toObject(),mutantPower:{...actor.system.mutantPower.toObject?.()??actor.system.toObject().mutantPower,learned}},{strict:true});
    if(previous!==JSON.stringify(actor.system.mutantPower.learned??[])||!psionicTrainingLevels(actor).includes(level))throw Error(tr("Los poderes cambiaron; revisa la instrucción."));
    if(!await actor.update({"system.mutantPower.learned":learned}))throw Error(tr("No se pudo guardar el poder aprendido."));
    return power;
  });learningQueues.set(actor.uuid,result);return result;
}

export const renderPower=(name,data)=>foundry.applications.handlebars.renderTemplate(`systems/${NS}/templates/powers/${name}.hbs`,{...data,...(data.power?{power:localizedRecord(data.power)}:{})});
export function requirePowerOwner(actor,user=game.user){if(!isRulesActor(actor)||(!user.isGM&&(actor.type==="npc"||!actor.testUserPermission(user,"OWNER"))))throw Error(tr("No tienes permiso para gestionar este poder."));}
export function privateRecipients(actor){return game.users.filter(u=>u.isGM||(actor.type!=="npc"&&actor.testUserPermission(u,"OWNER"))).map(u=>u.id);}
export async function privatePowerChat(actor,content,rolls=[],flags={}){
  const dice=(await Promise.all(rolls.map(r=>r.render()))).join("");
  return foundry.documents.ChatMessage.create({speaker:foundry.documents.ChatMessage.getSpeaker({actor}),content:content+dice,
    whisper:privateRecipients(actor),rolls,flags:{[NS]:flags}},{notify:false});
}
export function powerCombatContext(actor){
  const combat=game.combats.find(c=>c.round>0&&c.combatants.some(p=>p.actor?.uuid===actor.uuid));
  const participant=combat?.combatants.find(p=>p.actor?.uuid===actor.uuid);
  return {combat,participant,snapshot:combat?snapshotOf(combat,participant):null};
}
export function validatePowerUse(actor,options={},expected={}){
  const power=ownedPower(actor,options.powerKey??expected.powerKey);
  if(!power)throw Error(tr("El DJ debe identificar este poder en el registro antes de usarlo."));
  if(expected.cloneNumber!=null&&expected.cloneNumber!==actor.system.cloneNumber)throw Error(tr("La solicitud pertenece a un clon anterior."));
  if(expected.powerKey&&expected.powerKey!==power.key)throw Error(tr("El poder cambió. Crea una nueva solicitud."));
  const {combat,participant,snapshot}=powerCombatContext(actor);
  if(combat&&!options.override){
    if(expected.round!=null&&(expected.round!==combat.round||expected.combatId!==combat.id))throw Error(tr("La solicitud pertenece a otro turno."));
    if(stateOf(combat).phase!=="resolution"||snapshot?.action!=="other")throw Error(tr("Declara una acción «Otra» y espera a Resolución. Los detalles del poder se envían en privado."));
    if(participant.getFlag(NS,"otherAction")?.round===combat.round)throw Error(tr("La acción de este turno ya fue comprometida."));
  }
  const health=snapshot?.health??effectivePowerHealth(actor);
  const regeneration=power.key==="regeneration"&&regenerationAllowed(health);
  if(!regeneration)assertCanAct({system:{health}},{override:!!options.override});
  // Even a generic GM override cannot turn Regeneration into resurrection.
  if(power.key==="regeneration"&&["dead","vaporized"].includes(health.status))throw Error(tr("Regeneración no revive muertos ni vaporizados."));
  calculateTarget(actor.system.attributes.mutantPower.value,options.difficulty??"normal",options.modifier??0);
  const points=pointsFor(actor.system),after=spendPoints(points,options.cost,!!options.override);
  if(!String(options.intent??"").trim())throw Error(tr("Describe el efecto deseado."));
  for(const key of ["approxWeightKg","distanceMeters"])if(options[key]!=null&&(!Number.isFinite(options[key])||options[key]<0))throw Error(tr("Peso y distancia deben ser números no negativos."));
  return {power,points,after,combat,participant,health,regeneration};
}

/** Called by the elected GM coordinator only, after explicit cost/modifier approval. */
export async function commitPowerUse(actor,options,expected,requestId){
  if(!game.user.isGM)throw Error(tr("Se requiere aprobación del DJ."));
  const context=validatePowerUse(actor,options,expected),{power,points,after,combat,participant,health,regeneration}=context;
  // Reserve before dice. A processing request is never retried automatically after failure.
  if(combat)await participant.setFlag(NS,"otherAction",{round:combat.round,committed:true});
  if(!await actor.update({"system.mutantPower.points":after})&&points.value!==after.value)throw Error(tr("No se pudo guardar el gasto de PM."));
  const roll=await rollCheck({actor,type:"attribute",key:"mutantPower",difficulty:options.difficulty??"normal",modifier:options.modifier??0,
    createMessage:false,healthSnapshot:health,healthOverride:!!options.override||(regeneration&&health.status==="incapacitated")});
  const resultClass=options.resultOverride&&Object.hasOwn(POWER_RESULTS,options.resultOverride)?options.resultOverride:powerResult(roll);
  const result={requestId,actorUuid:actor.uuid,cloneNumber:actor.system.cloneNumber,powerKey:power.key,powerName:power.label,
    actorName:actor.name,pointsBefore:points.value,pointsAfter:after.value,max:after.max,cost:options.cost,
    attribute:roll.baseValue,difficulty:roll.difficulty,difficultyLabel:DIFFICULTIES[roll.difficulty].label,
    modifier:roll.situationalModifier,finalTarget:roll.finalTarget,dieResult:roll.dieResult,resultClass,outcome:POWER_RESULTS[resultClass],
    effect:power.results[resultClass],intent:String(options.intent).slice(0,2000),target:String(options.target??"").slice(0,300),
    notes:String(options.notes??"").slice(0,2000),approxWeightKg:options.approxWeightKg??null,distanceMeters:options.distanceMeters??null,
    gmOverride:!!options.override,resultOverridden:!!options.resultOverride,operations:[]};
  const message=await privatePowerChat(actor,await renderPower("result",result),[roll.roll],{powerResult:result});
  return {messageId:message.id,result};
}
export async function recoverPower(actor,hours){
  const before=pointsFor(actor.system),after=recoverPoints(before,hours);
  if(after.value!==before.value||actor.system.mutantPower.points?.max==null)await actor.update({"system.mutantPower.points":after});
  await privatePowerChat(actor,trHTML`<p>Descanso tranquilo e ininterrumpido: ${hours} h. PM: ${before.value} → ${after.value} / ${after.max}.</p>`);
  return after;
}

/** Explicit GM adjudication, never inferred health, destination, duration or magnitude. */
export async function adjudicatePower(message,options){
  if(!game.user.isGM||!message?.author?.isGM)throw Error(tr("Solo el DJ puede adjudicar resultados válidos."));
  const record=message.getFlag(NS,"powerResult"),actor=await fromUuid(record?.actorUuid??"");
  if(!actor||actor.system.cloneNumber!==record.cloneNumber)throw Error(tr("Este resultado corresponde a otro cuerpo."));
  const power=identifyPower(record.powerKey),action=options.action;
  const target=options.targetUuid?await fromUuid(options.targetUuid):actor;
  const targetActor=target?.documentName==="Token"?target.actor:target;
  if(["heal","stun","resist","health"].includes(action)&&!isRulesActor(targetActor))throw Error(tr("Selecciona un Actor personaje válido."));
  const key=`${action}:${targetActor?.uuid??options.targetUuid??actor.uuid}`;
  if(record.operations?.includes(key))throw Error(tr("Esta adjudicación ya fue aplicada."));
  const success=["success","criticalSuccess"].includes(record.resultClass);
  if(action==="heal"){
    if(power.key!=="regeneration"||!success||targetActor.uuid!==actor.uuid)throw Error(tr("La recuperación exige Regeneración exitosa sobre el propio cuerpo."));
    // HealthService owns the transition. Normal successes require the GM to wait the adjudicated hours/days.
    await applyTreatment(actor,"",{announce:false});
  }else if(action==="stun"){
    if(!["electroshock","mentalBlast"].includes(power.key)||!success)throw Error(tr("El poder no autoriza este aturdimiento."));
    if(power.key==="mentalBlast"){
      if(targetActor.uuid===actor.uuid)throw Error(tr("El Rayo mental excluye al usuario; un efecto adverso se adjudica por separado."));
      const resistance=record.resistances?.find(r=>r.actorUuid===targetActor.uuid);
      if(!resistance||resistance.success||resistance.cloneNumber!==targetActor.system.cloneNumber)throw Error(tr("Resuelve primero una Resistencia fallida de este objetivo."));
    }
    await applyHealthResult(targetActor,"stunned",{announce:false,damageId:`power:${message.id}:${targetActor.uuid}`});
  }else if(action==="resist"){
    if(!power.resistance||!success)throw Error(tr("Este resultado no dispone de resistencia."));
    if(power.key==="mentalBlast"&&targetActor.uuid===actor.uuid)throw Error(tr("El Rayo mental excluye al usuario."));
    const roll=await rollCheck({actor:targetActor,type:"attribute",key:power.resistance,modifier:options.modifier??0,createMessage:false});
    const resistances=[...(record.resistances??[]),{actorUuid:targetActor.uuid,success:roll.success,cloneNumber:targetActor.system.cloneNumber}];
    await message.update({[`flags.${NS}.powerResult.resistances`]:resistances},{notify:false});
    const escape=foundry.utils.escapeHTML;
    await privatePowerChat(actor,trHTML`<p>${escape(targetActor.name)} · Resistencia (${escape(roll.name)}): ${roll.dieResult} / ${roll.finalTarget} — ${escape(roll.label)}</p>`,[roll.roll]);
  }else if(action==="effect"||action==="manualEffect"){
    if(!success&&action!=="manualEffect")throw Error(tr("Para efectos adversos usa una adjudicación manual del DJ."));
    await trackPowerEffect(actor,power,{...options,manual:action==="manualEffect",sourceId:message.id,targetUuids:options.targetUuid?[options.targetUuid]:[]});
  }else if(action==="result"){
    if(!Object.hasOwn(POWER_RESULTS,options.resultClass))throw Error(tr("Resultado no válido."));
    const revised={...record,resultClass:options.resultClass,outcome:POWER_RESULTS[options.resultClass],effect:power.results[options.resultClass],resultOverridden:true};
    const dice=(await Promise.all(message.rolls.map(r=>r.render()))).join("");
    await message.update({content:await renderPower("result",revised)+dice,[`flags.${NS}.powerResult`]:revised},{notify:false});
    return {applied:true}; // Editing a label does not reroll, spend, or replay any previous effect.
  }else if(action==="health"){
    await applyHealthResult(targetActor,options.healthResult,{announce:false,manual:true,damageId:`power:${message.id}:manual:${targetActor.uuid}`});
  }else if(action==="teleport"){
    if(power.key!=="teleportation"||!options.confirmed)throw Error(tr("El traslado exige confirmación explícita del DJ."));
    const token=await fromUuid(options.tokenUuid??"");
    if(token?.documentName!=="Token"||token.actor?.uuid!==actor.uuid)throw Error(tr("Selecciona el Token de este personaje."));
    if(!Number.isFinite(options.x)||!Number.isFinite(options.y)||options.x<0||options.y<0)throw Error(tr("Coordenadas de destino no válidas."));
    await token.update({x:options.x,y:options.y});
  }else if(action==="public"){
    const text=String(options.observable??"").trim();if(!text)throw Error(tr("Escribe solo la consecuencia observable."));
    await foundry.documents.ChatMessage.create({content:`<p>${foundry.utils.escapeHTML(text)}</p>`});
  }else throw Error(tr("Adjudicación no válida."));
  await message.update({[`flags.${NS}.powerResult.operations`]:[...(record.operations??[]),key]},{notify:false});
  return {applied:true};
}
export {endPowerEffect};
