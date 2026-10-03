import {localizedRecord,tr,trHTML} from "../i18n/index.mjs";
import {effectivePowerHealth} from "../powers/rules.mjs";
import {ROBOT_STATES,robotModifier,robotBlocked} from "../robots/rules.mjs";
import {vehicleBlocked} from "../vehicles/rules.mjs";
export const HEALTH_STATES=Object.freeze(localizedRecord({healthy:"Sano",stunned:"Aturdido",wounded:"Herido",incapacitated:"Incapacitado",dead:"Muerto",vaporized:"Vaporizado"}));
export const DAMAGE_RESULTS=Object.freeze(localizedRecord({noEffect:"Sin efecto",stunned:"Aturdido",wounded:"Herido",incapacitated:"Incapacitado",dead:"Muerto",vaporized:"Vaporizado"}));
export const WOUND_MODIFIER=-4;
const severity=["healthy","stunned","wounded","incapacitated","dead","vaporized"];
export function healthModifier(health,key=""){return health?.kind==="vehicle"?0:Object.hasOwn(ROBOT_STATES,health?.status??"")?robotModifier(health,key):health?.status==="wounded"?WOUND_MODIFIER:0;}
export function blockedReason(health){
  if(health?.kind==="vehicle")return vehicleBlocked(health);
  if(health?.status==="vaporized")return tr("Está vaporizado y no puede actuar.");
  if(Object.hasOwn(ROBOT_STATES,health?.status??""))return robotBlocked(health);
  if(["incapacitated","dead","vaporized"].includes(health?.status))return trHTML`El personaje está ${HEALTH_STATES[health.status].toLowerCase()}.`;
  if(health?.stunned||health?.status==="stunned")return tr("El personaje está aturdido y no puede actuar.");
  return "";
}
export function assertCanAct(actor,{override=false,user=globalThis.game?.user}={}){
  if(override&&!user?.isGM)throw Error(tr("La excepción de salud requiere al DJ."));
  const reason=blockedReason(effectivePowerHealth(actor));
  if(reason&&!override)throw Error(reason);
}
export function nextHealthStatus(current,result){
  if(!Object.hasOwn(HEALTH_STATES,current)||!Object.hasOwn(DAMAGE_RESULTS,result))throw Error(tr("Estado o resultado de salud no válido."));
  if(result==="noEffect")return current;
  if(current==="vaporized"||result==="vaporized")return "vaporized";
  if(current==="dead")return "dead";
  if(result==="wounded"&&current==="wounded")return "incapacitated";
  if(result==="wounded"&&current==="incapacitated")return "dead";
  return severity.indexOf(result)>severity.indexOf(current)?result:current;
}
export function stunExpired(health,combat){return !!health.stunned&&health.stunCombatId===combat?.id&&Number.isInteger(health.stunnedUntilRound)&&combat.round>=health.stunnedUntilRound;}
export function untreatedDue(health,now){return health.status==="wounded"&&!health.treated&&health.woundedAt!=null&&now-health.woundedAt>=86400;}
export function hourlyDue(health,now){const reference=health.lastHourlyCheckAt??health.incapacitatedAt;return health.status==="incapacitated"&&reference!=null&&now-reference>=3600;}

/** Pure health transitions. Time is Foundry world time, never wall-clock time. */
export function transitionHealth(health,result,{now=0,combat=null}={}){
  const next={...health,status:nextHealthStatus(health.status,result)};
  if(result==="noEffect")return next;
  if(next.status==="wounded"&&health.status!=="wounded")Object.assign(next,{woundedAt:now,treated:false,treatedAt:null});
  if(next.status==="incapacitated"&&health.status!=="incapacitated")Object.assign(next,{incapacitatedAt:now,lastHourlyCheckAt:null});
  if(["incapacitated","dead","vaporized"].includes(next.status))Object.assign(next,clearStun(next));
  else if(result==="stunned"||result==="wounded")Object.assign(next,{stunned:true,stunCombatId:combat?.id??"",stunnedAtRound:combat?.round??null,stunnedUntilRound:combat?combat.round+2:null});
  if(next.status==="vaporized")next.equipmentDestroyed=true;
  return next;
}
export function clearStun(health){return {...health,status:health.status==="stunned"?"healthy":health.status==="shortCircuit"?"operational":health.status,stunned:false,stunCombatId:"",stunnedAtRound:null,stunnedUntilRound:null};}
export function treatedHealth(health,now){
  if(!["incapacitated","wounded"].includes(health.status))throw Error(tr("El tratamiento permite Incapacitado → Herido o Herido → Sano; no resucita."));
  return {...clearStun(health),status:health.status==="incapacitated"?"wounded":"healthy",treated:true,treatedAt:now,woundedAt:health.status==="incapacitated"?now:null,incapacitatedAt:null,lastHourlyCheckAt:null};
}
export function migrateHealth(health={}){
  const aliases={sano:"healthy",aturdido:"stunned",herido:"wounded",incapacitado:"incapacitated",muerto:"dead",vaporizado:"vaporized"};
  const old=String(health.status??"").trim(), key=old.toLowerCase();
  const status=Object.hasOwn(HEALTH_STATES,key)?key:aliases[key]??"healthy";
  if(old&&status==="healthy"&&key!=="healthy"&&key!=="sano")health.notes=[health.notes,trHTML`Estado anterior: ${old}`].filter(Boolean).join("\n");
  health.status=status;
  if(status==="stunned")health.stunned=true;
  return health;
}
