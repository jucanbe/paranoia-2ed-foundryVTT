import {tr} from "../i18n/index.mjs";
import {assertHumanSalvo,controlAvailable} from "./rules.mjs";
import {referencedActor} from "./service.mjs";
import {effectivePowerHealth} from "../powers/rules.mjs";
import {assertCanAct} from "../health/rules.mjs";
/** Resolve crew once at declaration; snapshot the operator as well as the hull. */
export async function vehicleOperators(actor,ids,selected={},override=false){
  if(actor.type!=="vehicle")return {};
  if(!ids.length)throw Error(tr("Selecciona armas integradas y su artillero / cerebro electrónico."));
  const choices=Object.fromEntries(ids.map(id=>[id,selected[id]??""]));assertHumanSalvo(choices);
  const result={};for(const [id,choice] of Object.entries(choices)){
    let operator;
    if(choice==="electronicBrain"){
      if(!controlAvailable(actor.system.vehicle,"electronicBrain"))throw Error(tr("No hay cerebro electrónico disponible."));operator=actor;
    }else{
      if(!actor.system.vehicle.crew.some(c=>c.actorUuid===choice&&["gunner","driver","commander","other"].includes(c.role)))throw Error(tr("El artillero debe figurar en la tripulación."));
      operator=await referencedActor(choice);if(!operator||!["character","npc","robot"].includes(operator.type))throw Error(tr("Artillero no disponible."));
    }
    assertCanAct(operator,{override});const h=effectivePowerHealth(operator);result[id]={actorUuid:operator.uuid,brain:operator===actor,cloneNumber:operator.system.cloneNumber,health:override?{status:"healthy",stunned:false}:{status:h.status,stunned:!!h.stunned,...(operator.type==="vehicle"?{kind:"vehicle"}:{})}};
  }assertHumanSalvo(Object.fromEntries(Object.entries(result).map(([id,record])=>[id,record.brain?"electronicBrain":record.actorUuid])));return result;
}
export function vehicleRoller(actor,declaration,weaponId){
  if(actor.type!=="vehicle")return {actor,health:null};
  const record=declaration?.weaponOperators?.[weaponId];if(!record)throw Error(tr("Declara primero el operador de esta arma."));
  let doc;try{doc=fromUuidSync(record.actorUuid);}catch{/* Invalid/deleted crew reference follows the normal unavailable-operator path. */}
  const operator=doc?.documentName==="Actor"?doc:doc?.actor;
  if(!operator||operator.system.cloneNumber!==record.cloneNumber)throw Error(tr("El artillero ya no está disponible o ha cambiado de clon."));
  return {actor:operator,health:record.health,brain:record.brain};
}
export function operatorAlreadyFired(combat,actor){
  return combat.combatants.some(c=>{const state=c.getFlag("paranoia-2-edition","attack");if(state?.round!==combat.round)return false;
    return [state,...Object.values(state.weapons??{})].some(s=>(s.resolved||s.pending)&&s.operatorUuid===actor.uuid);});
}
