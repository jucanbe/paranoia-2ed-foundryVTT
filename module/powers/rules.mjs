import {tr} from "../i18n/index.mjs";
export const POWER_NS="paranoia-2-edition";
export function initialPoints(attribute){const max=Number.isInteger(attribute)&&attribute>=0?attribute:0;return {value:max,max};}
export function pointsFor(system){
  const stored=system.mutantPower?.points,initial=initialPoints(system.attributes?.mutantPower?.value);
  const max=stored?.max??initial.max,value=stored?.value??max;
  if(!Number.isSafeInteger(max)||max<0||!Number.isSafeInteger(value)||value<0||value>max)throw Error(tr("Revisa los PM actuales y máximos."));
  return {value,max};
}
export function spendPoints(points,cost,override=false){
  if(!Number.isInteger(cost)||cost<1||cost>5)throw Error(tr("El coste debe ser de 1 a 5 PM."));
  if(!override&&points.value===0)throw Error(tr("No quedan Puntos de Poder Mutante."));
  if(!override&&points.value<cost)throw Error(tr("No hay suficientes PM para este coste."));
  return {...points,value:Math.max(0,points.value-cost)};
}
export function recoverPoints(points,hours){
  if(!Number.isInteger(hours)||hours<0||!Number.isSafeInteger(hours))throw Error(tr("Introduce horas completas de sueño tranquilo e ininterrumpido."));
  return {...points,value:Math.min(points.max,points.value+hours)};
}
export function powerResult(roll){return roll.specialResult==="spectacular"?"criticalSuccess":roll.specialResult==="critical"?"criticalFailure":roll.success?"success":"failure";}
export function managedEffects(actor){return [...(actor?.effects??[])].filter(e=>!e.disabled&&e.flags?.[POWER_NS]?.powerEffect);}
export function fatigueLevel(actor){return Math.max(0,...managedEffects(actor).map(e=>e.flags[POWER_NS].powerEffect.fatigue??0));}
/** A transient view, not a replacement Health state or persistent injury. */
export function effectivePowerHealth(actor){
  const health={...actor?.system?.health},fatigue=fatigueLevel(actor);
  if(["dead","vaporized","incapacitated"].includes(health.status))return health;
  if(fatigue>=2)health.status="incapacitated";
  else if(fatigue&&["healthy","stunned"].includes(health.status))health.status="wounded";
  return health;
}
export function powerModifier(actor,type,key){
  return managedEffects(actor).reduce((sum,e)=>sum+(e.flags[POWER_NS].powerEffect.modifiers??[])
    .filter(m=>m.type===type&&m.key===key).reduce((total,m)=>total+m.value,0),0);
}
export function effectExpired(effect,now,combat){
  if(effect.endsAt!=null&&now>=effect.endsAt)return true;
  return !!(effect.combatId&&effect.combatId===combat?.id&&effect.endsRound!=null&&combat.round>=effect.endsRound);
}
export function regenerationAllowed(health){return ["wounded","incapacitated"].includes(health?.status)&&!health.stunned;}
