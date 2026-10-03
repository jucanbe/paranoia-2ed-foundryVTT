import {tr,trHTML} from "../i18n/index.mjs";
import {getDefinition} from "../societies/service.mjs";
import {development,improvementPlan,skillKey,integer} from "./rules.mjs";
import {requestDevelopment} from "./requests.mjs";
const queues=new Map();
function citizen(actor){if(!["character","npc"].includes(actor?.type))throw Error(tr("Robots y vehículos no usan PD de ciudadano."));}
export const isEnabled=actor=>actor?.type==="character"||(actor?.type==="npc"&&actor.system.developmentEnabled===true);
export function canView(actor,user=game.user){return !!user?.isGM||(actor?.type==="character"&&actor.testUserPermission(user,"OWNER"));}
function owner(actor,user=game.user){citizen(actor);if(!canView(actor,user))throw Error(tr("No tienes permiso para desarrollar este ciudadano."));}
function gm(actor){citizen(actor);if(!game.user.isGM)throw Error(tr("Solo el DJ puede conceder, corregir o restringir PD."));if(game.users.activeGM?.id!==game.user.id)throw Error(tr("El DJ coordinador debe aplicar este cambio."));}
export function getAvailable(actor){owner(actor);return development(actor.system.development).available;}
export function getHistory(actor){owner(actor);return structuredClone(development(actor.system.development).history);}
export function societyMetadata(actor){
  const member=actor.system.secretSociety;
  if(member?.status!=="active")return {};
  return getDefinition(member.custom?.worldKey||member.societyKey)?.development??{};
}
export function preview(actor,rows,options={}){
  owner(actor);if(!isEnabled(actor))throw Error(tr("Seguimiento de desarrollo desactivado."));
  if(!game.user.isGM&&(options.overrideRestrictions||rows.some(r=>r.overrideCost!==undefined)))throw Error(tr("Solo el DJ puede modificar costes o restricciones."));
  return improvementPlan(actor,rows,societyMetadata(actor),options);
}
export function canImprove(actor,key,increase=1){try{preview(actor,[{skillKey:key,increase}]);return true;}catch{return false;}}
const stamp=actor=>JSON.stringify({development:actor.system.development,skills:actor.system.skills,enabled:actor.system.developmentEnabled,society:actor.system.secretSociety});
const meta=(kind,user=game.user)=>({id:foundry.utils.randomID(),kind,timestamp:Date.now(),worldTime:game.time.worldTime,userId:user.id});
function reason(options){if(!String(options.reason??"").trim())throw Error(tr("Indica el motivo."));return String(options.reason).trim();}
function enqueue(actor,callback){
  const result=(queues.get(actor.uuid)??Promise.resolve()).catch(()=>{}).then(callback);queues.set(actor.uuid,result);return result;
}
async function save(actor,next,skillRows=[],expected){
  gm(actor);
  const system=foundry.utils.mergeObject(actor.system.toObject(),{development:next},{inplace:false});
  const changes={"system.development":next};
  for(const row of skillRows){const [group,key]=row.skillKey.split(".");system.skills[group][key].value=row.newValue;changes[`system.skills.${row.skillKey}.value`]=row.newValue;}
  new CONFIG.Actor.dataModels[actor.type](system,{strict:true});
  if(expected!==stamp(actor))throw Error(tr("El ciudadano cambió durante la preparación. Revisa y repite."));
  if(!await actor.update(changes))throw Error(tr("No se guardó el desarrollo."));
  Hooks.callAll("paranoiaDevelopmentChanged",actor);return next;
}
export function prepareAward(actor,amount,options={}){
  gm(actor);if(!isEnabled(actor))throw Error(tr("Activa el desarrollo del PNJ antes de conceder PD."));integer(amount);reason(options);
  const current=development(actor.system.development);integer(current.available+amount);integer(current.lifetimeEarned+amount);
  let eligibleSkills;
  if(options.restriction==="used")eligibleSkills=development(actor.system.development).usage.filter(v=>v.count>0).map(v=>v.skillKey);
  if(options.restriction==="choose")eligibleSkills=[...new Set((options.eligibleSkills??[]).map(skillKey))];
  if(options.restriction&&!['keep','all','used','choose'].includes(options.restriction))throw Error(tr("Restricción desconocida."));
  if(eligibleSkills)eligibleSkills=eligibleSkills.map(skillKey);
  return {actorUuid:actor.uuid,amount,options:{reason:reason(options),notes:String(options.notes??""),missionReference:String(options.missionReference??""),
    awardId:options.awardId??foundry.utils.randomID(),restriction:eligibleSkills?"choose":options.restriction??"keep",eligibleSkills:eligibleSkills??[],resetUsage:!!options.resetUsage,notification:options.notification??"none"}};
}
export function award(actor,amount,options={}){
  gm(actor);const task=prepareAward(actor,amount,options);
  return applyPreparedAward(task);
}
export async function applyPreparedAward(task){
  const actor=await fromUuid(task.actorUuid);gm(actor);
  return enqueue(actor,async()=>{
    const expected=stamp(actor),next=development(actor.system.development),o=task.options;
    const previous=next.history.find(h=>h.kind==="award"&&h.awardId===o.awardId);
    if(previous)return {duplicate:true,entry:previous};
    const checked=prepareAward(actor,task.amount,o); // Revalidate before the single Actor write.
    const amount=checked.amount;next.available=integer(next.available+amount);next.lifetimeEarned=integer(next.lifetimeEarned+amount);
    if(o.restriction==="all"){next.restricted=false;next.eligibleSkills=[];}
    if(o.restriction==="choose"){next.restricted=true;next.eligibleSkills=checked.options.eligibleSkills;}
    if(o.resetUsage)next.usage=[];
    const entry={...meta("award"),amount,reason:o.reason,notes:o.notes,missionReference:o.missionReference,awardId:o.awardId};next.history.push(entry);
    await save(actor,next,[],expected);
    if(o.notification==="owner"||o.notification==="public"){
      const esc=foundry.utils.escapeHTML;
      // Optional receipts contain only amount, never reasons or comments.
      try{await foundry.documents.ChatMessage.create({content:trHTML`<p>${esc(actor.name)}: Has recibido ${amount} Puntos de Desarrollo. PD pendientes: ${next.available}.</p>`,whisper:o.notification==="public"?[]:game.users.filter(u=>u.isGM||actor.testUserPermission(u,"OWNER")).map(u=>u.id)});}catch(error){ui.notifications.warn(trHTML`PD guardados; no se pudo enviar el aviso: ${error.message}`);}
    }
    return {entry,available:next.available};
  });
}
export async function awardBatch(rows,options={}){
  // Validate the complete batch first. Separate Actors are resumable through stable award IDs.
  const tasks=rows.map(r=>prepareAward(r.actor,r.amount,{...options,...r.options}));
  if(new Set(tasks.map(t=>t.actorUuid)).size!==tasks.length)throw Error(tr("Ciudadano duplicado."));
  const results=[];for(const task of tasks)results.push(await applyPreparedAward(task));return results;
}
export function spend(actor,key,increase,options={}){return spendBatch(actor,[{skillKey:key,increase}],options);}
export function spendBatch(actor,rows,options={}){
  owner(actor);
  if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)return requestDevelopment(actor,rows,options);
  return executeSpend(actor,rows,options,game.user);
}
export function executeSpend(actor,rows,options={},user=game.user){
  gm(actor);owner(actor,user);
  if(!user.isGM&&(options.overrideRestrictions||rows.some(r=>r.overrideCost!==undefined)))throw Error(tr("Solo el DJ puede modificar costes o restricciones."));
  return enqueue(actor,async()=>{
    owner(actor,user);
    const expected=stamp(actor),next=development(actor.system.development);
    if(options.requestId&&next.history.some(h=>h.requestId===options.requestId))return {duplicate:true};
    if(!isEnabled(actor))throw Error(tr("Seguimiento de desarrollo desactivado."));
    const plan=improvementPlan(actor,rows,societyMetadata(actor),options);if(!plan.rows.length)throw Error(tr("Selecciona alguna mejora."));
    next.available=plan.remaining;next.lifetimeSpent=integer(next.lifetimeSpent+plan.totalCost);
    const entry={...meta("expenditure",user),rows:plan.rows,totalCost:plan.totalCost,reason:String(options.reason??tr("Mejora posterior a la aventura")),missionReference:String(options.missionReference??""),requestId:options.requestId??""};
    next.history.push(entry);await save(actor,next,plan.rows,expected);return {entry,...plan};
  });
}
export function correct(actor,delta,options={}){
  gm(actor);if(!Number.isSafeInteger(delta))throw Error(tr("Corrección: se requiere un entero."));reason(options);
  return enqueue(actor,async()=>{const expected=stamp(actor),next=development(actor.system.development);next.available=integer(next.available+delta);
    next.history.push({...meta("correction"),amount:delta,reason:reason(options),notes:String(options.notes??"")});await save(actor,next,[],expected);return next;});
}
export function refund(actor,expenditureId,options={}){
  gm(actor);reason(options);
  return enqueue(actor,async()=>{
    const expected=stamp(actor),next=development(actor.system.development),entry=next.history.find(h=>h.id===expenditureId&&h.kind==="expenditure");
    if(!entry||next.history.some(h=>h.kind==="refund"&&h.expenditureId===expenditureId))throw Error(tr("Mejora desconocida o ya revertida."));
    for(const row of entry.rows){const [group,key]=row.skillKey.split(".");if(actor.system.skills[group][key].value!==row.newValue)throw Error(tr("La habilidad cambió después. Revierte primero las mejoras posteriores."));}
    const rows=entry.rows.map(r=>({...r,newValue:r.oldValue}));next.available=integer(next.available+entry.totalCost);next.lifetimeRefunded=integer(next.lifetimeRefunded+entry.totalCost);
    next.history.push({...meta("refund"),amount:entry.totalCost,expenditureId,reason:reason(options)});await save(actor,next,rows,expected);return next;
  });
}
export function restrictSkills(actor,eligibleSkills,restricted=true,options={}){
  gm(actor);const keys=[...new Set(eligibleSkills.map(skillKey))];reason(options);
  return enqueue(actor,async()=>{const expected=stamp(actor),next=development(actor.system.development);next.restricted=!!restricted;next.eligibleSkills=keys;
    next.history.push({...meta("restriction"),reason:reason(options),eligibleSkills:keys,restricted:!!restricted});await save(actor,next,[],expected);return next;});
}
export function resetUsage(actor,options={}){
  gm(actor);return enqueue(actor,async()=>{const expected=stamp(actor),next=development(actor.system.development);next.usage=[];
    next.history.push({...meta("usageReset"),reason:options.reason||tr("Nueva aventura")});await save(actor,next,[],expected);return next;});
}
export function recordSkillUse(actor,key){
  owner(actor);key=skillKey(key);if(!isEnabled(actor))return;
  return enqueue(actor,async()=>{owner(actor);const next=development(actor.system.development);let row=next.usage.find(r=>r.skillKey===key);if(!row){row={skillKey:key,count:0};next.usage.push(row);}row.count=integer(row.count+1,tr("Usos"));
    if(!await actor.update({"system.development.usage":next.usage}))throw Error(tr("No se registró el uso de habilidad."));});
}
export async function enableTracking(actor,enabled){gm(actor);if(actor.type!=="npc")throw Error(tr("El desarrollo de personajes está siempre activado."));return actor.update({"system.developmentEnabled":!!enabled});}
export const DevelopmentService=Object.freeze({getAvailable,getHistory,isEnabled,canView,preview,canImprove,award,awardBatch,spend,spendBatch,refund,correct,restrictSkills,recordSkillUse,resetUsage,enableTracking});
