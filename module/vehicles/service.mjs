import {tr,trHTML} from "../i18n/index.mjs";
import {rollCheck,readCheck,postRolls} from "../rolls/service.mjs";
import {assertCanAct} from "../health/rules.mjs";
import {DamageService} from "../damage/service.mjs";
import {VEHICLE_STATES,controlAvailable,currentMovement} from "./rules.mjs";
import {calculateTarget} from "../rolls/rules.mjs";
export function vehicleGM(actor){if(!game.user.isGM||actor?.type!=="vehicle")throw Error(tr("Se requiere un vehículo y permiso del DJ."));}
export async function referencedActor(uuid){try{const doc=uuid?await fromUuid(uuid):null;return doc?.documentName==="Actor"?doc:doc?.actor??null;}catch{return null;}}
export async function occupants(actor){return Promise.all(actor.system.vehicle.crew.map(async(row,index)=>({...row,index,actor:await referencedActor(row.actorUuid)})));}
const esc=s=>foundry.utils.escapeHTML(String(s??""));
export async function maneuver(actor,{driver=null,key=actor.system.vehicle.handlingSkill,description="",routine=false,difficulty="normal",modifier=0,override=false}={}){
  vehicleGM(actor);assertCanAct(actor,{override});const v=actor.system.vehicle;
  if(!controlAvailable(v)&&!override)throw Error(tr("Configura un modo de control disponible."));
  if(v.control.currentMode==="manual"&&!driver)throw Error(tr("Selecciona el piloto."));
  if(driver)assertCanAct(driver,{override});
  if(routine){await postRolls(actor,[],trHTML`<p><strong>${esc(actor.name)}</strong> · Maniobra rutinaria autorizada por el DJ: ${esc(description)}. Sin tirada.</p>`,game.settings.get("core","messageMode"));return {routine:true,success:true};}
  if(v.control.currentMode==="autopilot"&&!driver)throw Error(tr("El piloto automático no tiene puntuaciones inventadas; selecciona un operador o adjudica una maniobra rutinaria."));
  const roller=v.control.currentMode==="electronicBrain"?actor:driver;
  const flat=calculateTarget(0,"normal",modifier).situationalModifier+v.maneuverModifier;
  const roll=await rollCheck({actor:roller,type:"skill",key,difficulty,modifier:flat,healthOverride:override,healthReason:trHTML`Maniobra: ${actor.name} · ${description}`});
  return {routine:false,roll,success:roll.success};
}
export async function repair(actor,{repairer,key,difficulty,modifier=0,divisor=1,systemIndex=null}={}){
  vehicleGM(actor);if(["destroyed","vaporized"].includes(actor.system.health.status))throw Error(tr("La reparación ordinaria no reconstruye vehículos destruidos."));
  if(![1,2,3].includes(divisor))throw Error(tr("Divisor de reparación no válido."));
  const base=readCheck(repairer,"skill",key).baseValue;
  // /3 is an explicitly selected source repair option, not a new global difficulty.
  const adjustment=divisor===1?0:Math.floor(base/divisor)-base;
  const roll=await rollCheck({actor:repairer,type:"skill",key,difficulty:divisor===1?difficulty:"normal",modifier:calculateTarget(0,"normal",modifier).situationalModifier+adjustment,healthReason:divisor===1?tr("Reparación de vehículo"):trHTML`Reparación de vehículo: habilidad ÷${divisor} (DJ)`});
  return {roll,expected:actor.system.health.status,systemIndex};
}
export async function confirmRepair(actor,expected,status,systemIndex=null){
  vehicleGM(actor);if(actor.system.health.status!==expected)throw Error(tr("El daño cambió; revisa la reparación."));
  if(!Object.hasOwn(VEHICLE_STATES,status)||["destroyed","vaporized"].includes(expected))throw Error(tr("Reparación no válida."));
  const update={"system.health.status":status};
  if(systemIndex!=null){const systems=actor.system.toObject().vehicle.systems;if(!systems[systemIndex])throw Error(tr("El sistema ya no existe."));systems[systemIndex].status="operational";update["system.vehicle.systems"]=systems;}
  return actor.update(update);
}
/** An accident is an audit plus individually adjudicated DamageService resolutions. No Annex B arithmetic. */
export async function recordAccident(actor,{type,notes=""}={}){
  vehicleGM(actor);const people=await occupants(actor),v=actor.system.vehicle;
  const record={id:foundry.utils.randomID(),vehicleUuid:actor.uuid,type,notes,movement:currentMovement(v),speed:v.movement.currentSpeed,
    occupants:people.map(p=>({uuid:p.actorUuid,name:p.actor?.name??tr("Referencia no disponible"),successfulEscape:false,resolved:false})),sourceColumn:actor.system.health.status==="vaporized"?19:null};
  const message=await postRolls(actor,[],trHTML`<p><strong>Accidente: ${esc(actor.name)}</strong> · ${esc(type)}</p><p>${esc(notes)}</p><p>Anexo B no disponible: el DJ debe seleccionar el ND / columna y resultado de cada ocupante.${record.sourceColumn===19?" Vaporización: la fuente indica columna 19.":""}</p>`,"gm",{"paranoia-2-edition":{vehicleAccident:record}});
  await actor.update({"system.vehicle.lastAccident":message.id,"system.vehicle.accidentPending":true});return message;
}
const accidentLocks=new Set();
export async function resolveOccupant(message,index,{baseDamageNumber=null,column="",manualResult="",escapeAttribute="",escapeDifficulty="normal",escapeModifier=0,exclude=false}={}){
  if(!game.user.isGM)throw Error(tr("Solo el DJ resuelve accidentes."));const lock=message.id;if(accidentLocks.has(lock))throw Error(tr("Resolución en curso."));accidentLocks.add(lock);
  try{
    const record=foundry.utils.deepClone(message.getFlag("paranoia-2-edition","vehicleAccident")),entry=record?.occupants[index];if(!entry||entry.resolved)throw Error(tr("Ocupante ya resuelto o no válido."));
    if(exclude){entry.resolved=true;entry.excludedByGM=true;await message.setFlag("paranoia-2-edition","vehicleAccident",record);return {applied:true,excluded:true};}
    if(entry.damageMessageId){const prior=game.messages.get(entry.damageMessageId);if(prior)return DamageService.fromMessage(prior);throw Error(tr("Falta la tarjeta de daño anterior; revisa el registro antes de repetir."));}
    const target=await referencedActor(entry.uuid);if(!target)throw Error(tr("La referencia del ocupante ya no existe."));
    if(escapeAttribute&&!entry.escapeAttempted){const check=await rollCheck({actor:target,type:"attribute",key:escapeAttribute,difficulty:escapeDifficulty,modifier:escapeModifier});entry.escapeAttempted=true;entry.successfulEscape=check.success;await message.setFlag("paranoia-2-edition","vehicleAccident",record);
      // The GM must choose the reduced column AFTER seeing the escape result.
      return {escapeOnly:true,successfulEscape:check.success};}
    const damage=await DamageService.resolveDamage({target,baseDamageNumber,applyArmor:false,applyStrength:false,applyStamina:false,manualOnly:!!manualResult,manualResult:manualResult||undefined,apply:false,sourceAttackId:`${record.id}-${index}`,messageMode:"gm"});
    entry.column=String(column);entry.baseDamageNumber=baseDamageNumber;
    if(manualResult||damage.automaticResult){if(!damage.applied)await DamageService.applyResolution(damage);entry.resolved=true;}
    entry.damageMessageId=damage.message?.id??"";await message.setFlag("paranoia-2-edition","vehicleAccident",record);return damage;
  }finally{accidentLocks.delete(lock);}
}
