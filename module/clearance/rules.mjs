import {localizedRecord,tr} from "../i18n/index.mjs";
import {CLEARANCE_CODES} from "../actors/identity.mjs";
export const PROMOTION_REQUIREMENTS=Object.freeze(localizedRecord({
  red:{type:"special",description:"Denunciar a su mejor amigo de la infancia."},
  orange:{type:"successfulMissions",count:1},yellow:{type:"successfulMissions",count:1},
  green:{type:"successfulMissions",count:2},blue:{type:"successfulMissions",count:2},
  indigo:{type:"successfulMissions",count:3},violet:{type:"successfulMissions",count:3},
  ultraviolet:{type:"specialGM",description:"Requisito especial / decisión del Máster"}
}));
export function clearanceIndex(key){return Object.keys(CLEARANCE_CODES).indexOf(key);}
export function adjacent(key,step){return Object.keys(CLEARANCE_CODES)[clearanceIndex(key)+step]??null;}
export function progress(value={}){
  return {successfulMissions:Number.isSafeInteger(value.successfulMissions)&&value.successfulMissions>=0?value.successfulMissions:0,
    requirementSatisfied:value.requirementSatisfied===true,countedMissionIds:[...new Set((value.countedMissionIds??[]).filter(v=>typeof v==="string"&&v.trim()))]};
}
export function requirement(key,value){
  const target=adjacent(key,1),rule=PROMOTION_REQUIREMENTS[target],p=progress(value);
  return {target,...rule,completed:p.successfulMissions,satisfied:!!rule&&(rule.type==="successfulMissions"?p.successfulMissions>=rule.count:p.requirementSatisfied)};
}
export function missionProgress(value,{missionId,result,validSurvivor,countForPromotion,declaredTraitor,override=false,reason=""}){
  const p=progress(value);
  missionId=typeof missionId==="string"?missionId.trim():"";
  if(!missionId)throw Error(tr("Indica una referencia de misión única."));
  if(override&&!String(reason).trim())throw Error(tr("La excepción requiere un motivo del DJ."));
  if(result!=="success"||!countForPromotion||(!override&&(!validSurvivor||declaredTraitor)))return {progress:p,counted:false};
  if(p.countedMissionIds.includes(missionId)&&!override)return {progress:p,counted:false};
  if(!Number.isSafeInteger(p.successfulMissions+1))throw Error(tr("El contador de misiones supera el máximo seguro."));
  p.successfulMissions++;if(!p.countedMissionIds.includes(missionId))p.countedMissionIds.push(missionId);
  return {progress:p,counted:true};
}
