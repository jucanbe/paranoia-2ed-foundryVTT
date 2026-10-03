import {tr,trHTML} from "../i18n/index.mjs";
import {repairedRobot,ROBOT_STATES,validateMemory} from "./rules.mjs";
import {withHealthLock,writeHealth} from "../health/service.mjs";
import {rollCheck} from "../rolls/service.mjs";
export const robotGM=actor=>{if(!game.user.isGM||actor.type!=="robot")throw Error(tr("Se requiere un robot y permiso del DJ."));};
export async function repairRobot(actor,{repairer,key,difficulty,modifier=0,apply=false,expected=actor.system.health.status}){
  robotGM(actor);repairedRobot(actor.system.toObject().health);
  const roll=await rollCheck({actor:repairer,type:"skill",key,difficulty,modifier});
  if(apply)throw Error(tr("Confirma el resultado de reparación con el DJ después de la tirada."));
  return {roll,expected};
}
export async function confirmRepair(actor,expected){robotGM(actor);return withHealthLock(actor,async()=>{
  if(actor.system.health.status!==expected)throw Error(tr("El estado del robot cambió; revisa la reparación."));
  return writeHealth(actor,repairedRobot(actor.system.toObject().health));
});}
export async function changeRobotState(actor,status){robotGM(actor);if(!Object.hasOwn(ROBOT_STATES,status))throw Error(tr("Estado no válido."));return withHealthLock(actor,()=>writeHealth(actor,{...actor.system.toObject().health,status,stunned:status==="shortCircuit",stunCombatId:"",stunnedUntilRound:null,salvageAvailable:status!=="vaporized"}));}
export async function swapCard(actor,fromId,toId){
  robotGM(actor);const old=actor.items.get(fromId),next=actor.items.get(toId);
  if(next?.type!=="robotProgram"||next.system.storageMode!=="card"||old?.id===next.id)throw Error(tr("Selecciona otra tarjeta."));
  if(old&&(old.type!=="robotProgram"||old.system.storageMode!=="card"))throw Error(tr("El programa saliente no es una tarjeta."));
  const combat=game.combats.find(c=>c.round>0&&c.combatants.some(p=>p.actor?.uuid===actor.uuid));
  const items=actor.items.map(i=>({...i.toObject(),system:{...i.toObject().system,...(i.id===fromId?{active:false}:i.id===toId?{active:true}:{})}}));
  validateMemory(items,actor.system.robot.memory.capacity);
  if(combat&&actor.system.robot.type==="robomechanic"){
    if(actor.system.robot.cardSwap.toId)throw Error(tr("Ya hay un cambio de tarjeta pendiente."));
    if(old)await old.update({"system.active":false});
    await actor.update({"system.robot.cardSwap":{fromId:fromId??"",toId,combatId:combat.id,startedRound:combat.round,readyRound:combat.round+3}});
    return {pending:true};
  }
  await actor.updateEmbeddedDocuments("Item",[...(old?[{_id:old.id,"system.active":false}]:[]),{_id:next.id,"system.active":true}]);
  return {pending:false};
}
export async function finishCardSwap(actor){
  robotGM(actor);const swap=actor.system.robot.cardSwap,combat=game.combats.get(swap.combatId);
  if(!swap.toId)throw Error(tr("No hay cambio pendiente."));
  if(combat&&combat.round<swap.readyRound)throw Error(trHTML`Cambio disponible en el turno ${swap.readyRound}.`);
  const card=actor.items.get(swap.toId);if(!card)throw Error(tr("La tarjeta ya no existe."));
  await card.update({"system.active":true});
  await actor.update({"system.robot.cardSwap":{fromId:"",toId:"",combatId:"",startedRound:null,readyRound:null}});
}
export async function cancelCardSwap(actor){robotGM(actor);await actor.update({"system.robot.cardSwap":{fromId:"",toId:"",combatId:"",startedRound:null,readyRound:null}});}
