import {tr,trHTML} from "../i18n/index.mjs";
import {readClearanceLedger,readRecord,transaction,requireGM,actorKey} from "../treason/ledger.mjs";
import {adjacent,clearanceIndex,progress,requirement,missionProgress} from "./rules.mjs";
import {LABELS} from "../sheets/labels.mjs";
import {prepareAward,applyPreparedAward} from "../development/service.mjs";
import {prepareMissionCredits,applyMissionCredits} from "../credits/service.mjs";
const NS="paranoia-2-edition";
const ledger=body=>body.clearance??={actions:{},reports:{}};
const snapshot=actor=>({securityClearance:actor.system.securityClearance,securityProgress:progress(actor.system.securityProgress),clearanceProgressionEnabled:!!actor.system.clearanceProgressionEnabled});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function citizen(actor){actorKey(actor);}
export const isEnabled=actor=>actor.type==="character"||(actor.type==="npc"&&actor.system.clearanceProgressionEnabled===true);
export function getCurrent(actor){citizen(actor);return actor.system.securityClearance;}
export const getNext=actor=>adjacent(getCurrent(actor),1);
export const getPrevious=actor=>adjacent(getCurrent(actor),-1);
export function getPromotionRequirements(actor){
  citizen(actor);
  if(!game.user.isGM&&(!actor.testUserPermission(game.user,"OWNER")||!game.settings.get(NS,"showPromotionProgressToPlayers")))return null;
  const r=requirement(getCurrent(actor),actor.system.securityProgress);
  const declared=game.user.isGM?readRecord(actor).declaredTraitor:null;
  return {...r,enabled:isEnabled(actor),eligible:game.user.isGM&&isEnabled(actor)&&r.satisfied&&!declared,
    blocked:game.user.isGM?(declared?tr("No elegible: traidor declarado"):""):""};
}
export const canPromote=actor=>!!getPromotionRequirements(actor)?.eligible;
export function getHistory(actor){requireGM();citizen(actor);return Object.values(readClearanceLedger().actions).filter(a=>a.actorUuid===actor.uuid);}
function event(actor,after,options){
  if(!String(options.reason??"").trim())throw Error(tr("Indica el motivo."));
  return {id:foundry.utils.randomID(),actorUuid:actor.uuid,before:snapshot(actor),after,
    previousClearance:getCurrent(actor),newClearance:after.securityClearance,type:options.type??"manual",reason:String(options.reason),
    missionReference:String(options.missionReference??""),notes:String(options.notes??""),timestamp:Date.now(),worldTime:game.time.worldTime,userId:game.user.id,status:"pending",previousName:actor.name};
}
function checkPending(body,actor){if(Object.values(ledger(body).actions).some(a=>a.actorUuid===actor.uuid&&a.status==="pending"))throw Error(tr("Hay un cambio pendiente: reanúdalo desde el historial antes de continuar."));}
/** Journal first, then Actor, then acknowledgement. Failed writes remain recoverable; no lost history. */
export async function resumeAction(id){
  requireGM();let a=readClearanceLedger().actions[id];if(!a)throw Error(tr("Cambio desconocido."));
  if(game.users.activeGM?.id!==game.user.id)throw Error(tr("El DJ coordinador debe aplicar este cambio."));
  if(a.status==="completed")return a;
  const actor=await fromUuid(a.actorUuid);citizen(actor);
  const current=snapshot(actor);
  if(!same(current,a.after)){
    if(!same(current,a.before))throw Error(tr("El ciudadano cambió desde la operación pendiente. Revisa sus datos antes de reanudar."));
    const updated=await actor.update({system:a.after});
    if(!updated||!same(snapshot(actor),a.after))throw Error(tr("No se pudo guardar el cambio; permanece pendiente en el historial."));
  }
  await transaction(body=>{ledger(body).actions[id].status="completed";});
  Hooks.callAll("paranoiaClearanceChanged",actor);
  return {...a,status:"completed"};
}
async function commit(actor,after,options){
  requireGM();citizen(actor);const a=event(actor,after,options);
  await transaction(body=>{checkPending(body,actor);ledger(body).actions[a.id]=a;});
  await resumeAction(a.id);
  if(options.announce&&a.previousClearance!==a.newClearance){
    const esc=foundry.utils.escapeHTML;
    await foundry.documents.ChatMessage.create({content:trHTML`<p><strong>ATENCIÓN, CIUDADANO.</strong></p><p>${esc(a.previousName)}: nuevo Nivel de Seguridad ${esc(LABELS.clearances[a.newClearance])}.</p><p>Nueva designación: ${esc(actor.name)}</p>`});
  }
  return actor;
}
export async function setClearance(actor,key,options={}){
  requireGM();citizen(actor);if(clearanceIndex(key)<0)throw Error(tr("Nivel de seguridad desconocido."));
  if(key===getCurrent(actor))throw Error(tr("El ciudadano ya tiene ese nivel."));
  const after=snapshot(actor);after.securityClearance=key;
  if(!options.preserveProgress)after.securityProgress={...after.securityProgress,successfulMissions:0,requirementSatisfied:false};
  return commit(actor,after,options);
}
export async function promote(actor,options={}){
  requireGM();if(!getNext(actor))throw Error(tr("Ultravioleta es el nivel máximo."));
  if(!isEnabled(actor))throw Error(tr("Activa el seguimiento de ascensos del PNJ."));
  if(!canPromote(actor)&&!options.override)throw Error(getPromotionRequirements(actor).blocked||tr("Requisito de ascenso pendiente."));
  return setClearance(actor,getNext(actor),{...options,type:"promotion"});
}
export async function demote(actor,options={}){
  const target=options.target??getPrevious(actor);
  if(!target||clearanceIndex(target)>=clearanceIndex(getCurrent(actor)))throw Error(tr("Selecciona un nivel inferior."));
  if(clearanceIndex(getCurrent(actor))-clearanceIndex(target)>1&&!options.confirmMultiLevel)throw Error(tr("Confirma expresamente la degradación de varios niveles."));
  return setClearance(actor,target,{...options,type:"demotion"});
}
export async function correctProgress(actor,{successfulMissions,requirementSatisfied,...options}){
  requireGM();if(!Number.isSafeInteger(successfulMissions)||successfulMissions<0)throw Error(tr("Número de misiones no válido."));
  const after=snapshot(actor);after.securityProgress={...after.securityProgress,successfulMissions,requirementSatisfied:!!requirementSatisfied};
  return commit(actor,after,{...options,type:"progressCorrection"});
}
export async function enableTracking(actor,enabled,options={}){
  if(actor.type!=="npc")throw Error(tr("El seguimiento de personajes está siempre activado."));
  return commit(actor,{...snapshot(actor),clearanceProgressionEnabled:!!enabled},{...options,type:"tracking"});
}
export async function recordSuccessfulMission(actor,missionIdOrOptions,extra={}){
  const options=typeof missionIdOrOptions==="string"?{...extra,missionId:missionIdOrOptions}:missionIdOrOptions;
  requireGM();if(!isEnabled(actor)||!getNext(actor))return {counted:false};
  const result=missionProgress(actor.system.securityProgress,{...options,result:"success",countForPromotion:options.countForPromotion??true,declaredTraitor:readRecord(actor).declaredTraitor});
  if(result.counted)await commit(actor,{...snapshot(actor),securityProgress:result.progress},{...options,reason:options.reason||tr("Éxito de misión"),missionReference:options.missionId,type:"missionProgress"});
  return {...result,requirements:getPromotionRequirements(actor)};
}
/** Called inside the existing atomic PT transaction. Actor progress is a durable, resumable outbox. */
export function stageMissionReport(body,rows,{missionId},records){
  if(!String(missionId??"").trim())throw Error(tr("Indica una referencia de misión única."));
  const l=ledger(body),fingerprint=JSON.stringify(rows.map(({actor,...row})=>({actorUuid:actor.uuid,...row})));
  if(Object.hasOwn(l.reports,missionId)){
    if(l.reports[missionId].fingerprint!==fingerprint)throw Error(tr("La referencia ya pertenece a otro informe. Usa la misma referencia solo para reanudarlo."));
    return {...l.reports[missionId],alreadyApplied:l.reports[missionId].actionIds.every(id=>l.actions[id].status==="completed")};
  }
  const report={missionId,fingerprint,actionIds:[],developmentTasks:[],creditTasks:[],results:[]};
  rows.forEach((row,i)=>{
    const {actor}=row;checkPending(body,actor);
    if(row.creditReward!==undefined||row.creditFine!==undefined)report.creditTasks.push(prepareMissionCredits(actor,{reward:row.creditReward??0,fine:row.creditFine??0,reason:row.creditReason??"",missionReportId:missionId}));
    if(row.developmentAward!==undefined)report.developmentTasks.push(prepareAward(actor,row.developmentAward,{reason:row.developmentReason||tr("Desarrollo tras la aventura"),missionReference:missionId,
      awardId:`report:${missionId}`,restriction:row.developmentRestriction??"keep",eligibleSkills:row.developmentEligibleSkills??[],resetUsage:!!row.resetSkillUsage,notification:"none"}));
    if(!["success","failure","none","custom"].includes(row.result))throw Error(tr("Resultado de misión desconocido."));
    const result=isEnabled(actor)&&getNext(actor)?missionProgress(actor.system.securityProgress,{...row,missionId,declaredTraitor:records[i].declaredTraitor}):{counted:false};
    if(result.counted){const a=event(actor,{...snapshot(actor),securityProgress:result.progress},{...row,type:"missionProgress",missionReference:missionId,reason:row.reason||tr("Éxito de misión")});l.actions[a.id]=a;report.actionIds.push(a.id);}
    report.results.push({actorUuid:actor.uuid,counted:result.counted});
  });
  Object.defineProperty(l.reports,missionId,{value:report,enumerable:true,writable:true,configurable:true});return report;
}
export async function resumeMissionReport(missionId){
  const reports=readClearanceLedger().reports,report=Object.hasOwn(reports,missionId)?reports[missionId]:null;if(!report)throw Error(tr("Informe desconocido."));
  for(const id of report.actionIds)await resumeAction(id);
  for(const task of report.developmentTasks??[])await applyPreparedAward(task);
  for(const task of report.creditTasks??[])await applyMissionCredits(task);
  return report.results.map(row=>{const task=report.developmentTasks?.find(t=>t.actorUuid===row.actorUuid),credits=report.creditTasks?.find(t=>t.actorUuid===row.actorUuid);return {...row,...(task?{developmentAward:task.amount}:{}),...(credits?{creditReward:credits.reward,creditFine:credits.fine}:{})};});
}
export function getMissionReport(missionId){const reports=readClearanceLedger().reports;return Object.hasOwn(reports,missionId)?reports[missionId]:null;}
export const SecurityClearanceService=Object.freeze({getCurrent,getNext,getPrevious,getPromotionRequirements,canPromote,promote,demote,setClearance,correctProgress,recordSuccessfulMission,getHistory,resumeAction,resumeMissionReport,isEnabled,enableTracking});
