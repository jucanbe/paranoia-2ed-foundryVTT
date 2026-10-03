import {tr,trHTML} from "../i18n/index.mjs";
import {isMechanicalActor as isRulesActor} from "../actors/types.mjs";
import {robotTransition,ROBOT_STATES,ROBOT_RESULTS} from "../robots/rules.mjs";
import {vehicleTransition,VEHICLE_STATES,VEHICLE_RESULTS} from "../vehicles/rules.mjs";
import {HEALTH_STATES,DAMAGE_RESULTS,transitionHealth,clearStun,treatedHealth,untreatedDue,hourlyDue,stunExpired} from "./rules.mjs";
import {rollCheck,postRolls} from "../rolls/service.mjs";
import {enabled} from "../combat/optional/settings.mjs";
import {LOCATIONS} from "../combat/optional/rules.mjs";
import {healedWounds} from "../combat/optional/rules.mjs";
const locks=new Map();
export function requireGM(actor){if(!game.user.isGM||!isRulesActor(actor))throw Error(tr("Esta operación requiere al DJ y un Actor de tipo personaje."));}
export async function withHealthLock(actor,task){
  requireGM(actor);
  const previous=locks.get(actor.uuid)??Promise.resolve();
  const operation=previous.catch(()=>{}).then(task);locks.set(actor.uuid,operation);
  try{return await operation;}finally{if(locks.get(actor.uuid)===operation)locks.delete(actor.uuid);}
}
function combatFor(actor){return game.combats.find(c=>c.round>0&&c.combatants.some(p=>p.actor?.uuid===actor.uuid));}
export function healthContext(actor){return {now:game.time.worldTime,combat:combatFor(actor)};}
export async function writeHealth(actor,health){
  requireGM(actor);
  if(health.status==="healthy"&&health.wounds)health.wounds=healedWounds(health.wounds);
  const result=await actor.update({"system.health":health});
  if(!result)throw Error(tr("No se pudo guardar el estado de salud."));
  return result;
}
export async function healthChat(actor,text){
  const escape=foundry.utils.escapeHTML;
  return postRolls(actor,[],`<section class="p2-roll-card"><strong>${escape(actor.name)}</strong><p>${escape(text)}</p></section>`,game.settings.get("core","messageMode"));
}
export async function applyHealthResult(actor,result,{announce=true,damageId="",manual=false}={}){
  return withHealthLock(actor,async()=>{
    if(damageId&&actor.system.health.lastDamageId===damageId)return actor.system.health;
    const next=(actor.type==="vehicle"?vehicleTransition:actor.type==="robot"?robotTransition:transitionHealth)(actor.system.toObject().health,result,healthContext(actor));
    if(damageId)next.lastDamageId=damageId;
    if(result!=="noEffect"||damageId)await writeHealth(actor,next);
    if(actor.type==="vehicle"&&result!=="noEffect"){
      const warning=next.status==="vaporized"?tr("Vehículo vaporizado: ocupantes según columna 19; adjudicación manual, sin muerte automática."):next.status==="destroyed"?tr("Vehículo destruido: resuelve el accidente de sus ocupantes."):actor.system.vehicle.airDamageWarning&&actor.system.vehicle.movement.currentMode==="air"?tr("Daño en vuelo: posible rotura de hélice. El DJ decide si provoca accidente."):"";
      if(warning){await actor.update({"system.vehicle.accidentPending":true,...(!actor.system.vehicle.accidentPending?{"system.vehicle.lastAccident":""}:{})});ui.notifications.warn(warning,{permanent:true});}
      if(announce)await healthChat(actor,`${VEHICLE_RESULTS[result]} → ${VEHICLE_STATES[next.status]}`);
    }else if(announce)await healthChat(actor,actor.type==="robot"?`${ROBOT_RESULTS[result]} → ${ROBOT_STATES[next.status]}`:`${manual?"Resultado determinado por el GM. ":""}${DAMAGE_RESULTS[result]} → ${HEALTH_STATES[next.status]}${next.stunned?" · Aturdimiento temporal":""}${next.status==="wounded"?" · −4 a Atributos y Habilidades":""}`);
    return next;
  });
}
export async function recoverStun(actor){return withHealthLock(actor,async()=>{
  // Phase advancement and native Combat updates may request the same expiry together.
  if(!actor.system.health.stunned&&actor.system.health.status!=="stunned")return actor.system.health;
  const next=clearStun(actor.system.toObject().health);await writeHealth(actor,next);return next;
});}
export async function applyTreatment(actor,notes="",{announce=true}={}){return withHealthLock(actor,async()=>{
  const next=treatedHealth(actor.system.toObject().health,game.time.worldTime);
  if(notes)next.treatmentNotes=[next.treatmentNotes,notes].filter(Boolean).join("\n");
  await writeHealth(actor,next);if(announce)await healthChat(actor,trHTML`Tratamiento autorizado por el DJ → ${HEALTH_STATES[next.status]}`);return next;
});}
export async function markTreated(actor,notes=""){return withHealthLock(actor,async()=>{
  const next={...actor.system.toObject().health,treated:true,treatedAt:game.time.worldTime};
  if(notes)next.treatmentNotes=[next.treatmentNotes,notes].filter(Boolean).join("\n");
  await writeHealth(actor,next);return next;
});}
export async function setHealthStatus(actor,status){return withHealthLock(actor,async()=>{
  if(!Object.hasOwn(HEALTH_STATES,status))throw Error(tr("Estado no válido."));
  // Explicit GM override, including correcting a terminal state; not a resurrection rule.
  const prior=actor.system.toObject().health;
  const baseline={...clearStun(prior),status:"healthy",woundedAt:null,incapacitatedAt:null,lastHourlyCheckAt:null,treated:false,treatedAt:null,equipmentDestroyed:false};
  const next=status==="healthy"?baseline:transitionHealth(baseline,status,healthContext(actor));
  await writeHealth(actor,next);return next;
});}
export async function checkUntreated(actor){
  return withHealthLock(actor,async()=>{
    if(!untreatedDue(actor.system.health,game.time.worldTime))throw Error(tr("No ha transcurrido un día de tiempo del mundo sin tratamiento, o falta la fecha de la herida."));
    const next=transitionHealth(actor.system.toObject().health,"incapacitated",healthContext(actor));
    await writeHealth(actor,next);await healthChat(actor,tr("Un día sin tratamiento: Incapacitado."));return next;
  });
}
export async function hourlySurvival(actor){
  return withHealthLock(actor,async()=>{
    if(actor.system.health.status!=="incapacitated")throw Error(tr("La tirada horaria requiere estar incapacitado."));
    const result=await rollCheck({actor,type:"attribute",key:"endurance",healthOverride:true,healthReason:tr("Supervivencia horaria (DJ)")});
    await writeHealth(actor,{...actor.system.toObject().health,lastHourlyCheckAt:game.time.worldTime});
    return result; // Caller offers death on failure; never a background roll.
  });
}
export async function expireCombatStuns(combat){
  if(game.user.id!==game.users.activeGM?.id)return;
  const actors=new Map(combat.combatants.filter(c=>isRulesActor(c.actor)).map(c=>[c.actor.uuid,c.actor]));
  for(const actor of actors.values())if(stunExpired(actor.system.health,combat))await recoverStun(actor);
}
export function healthView(actor){
  const h=actor.system.health, now=game.time.worldTime, combat=game.combats.get(h.stunCombatId);
  return {localizationEnabled:enabled("hitLocation")&&["character","npc"].includes(actor.type),localizedWounds:enabled("hitLocation")?(h.wounds??[]).map(w=>({...w,label:LOCATIONS[w.location]??w.location,sideLabel:({left:tr("Izquierdo"),right:tr("Derecho"),unspecified:tr("Sin especificar")})[w.side],consequenceLabel:({narrative:tr("Consecuencia narrativa"),blind:tr("Ceguera"),deaf:tr("Sordera"),incapacitated:tr("Incapacitación"),cognitive:tr("Deterioro cognitivo permanente"),custom:tr("Efecto permanente personalizado")})[w.consequence],restriction:({arm:tr("Brazo inutilizado: no agarrar, cargar ni manipular con ese brazo."),leg:tr("Solo Marcha / cojear: sin carrera, sprint ni bicicleta."),chest:tr("Sin desplazamiento; puede disparar o usar habilidades con −4."),abdomen:tr("Sin desplazamiento; puede disparar o usar habilidades con −4.")})[w.location]??tr("Consecuencia decidida por el DJ.")})):[],label:HEALTH_STATES[h.status],stunned:h.stunned||h.status==="stunned",
    stunText:h.stunCombatId&&combat&&h.stunnedUntilRound!=null?trHTML`Hasta el inicio del turno ${h.stunnedUntilRound} (actual: ${combat.round}).`:tr("Sin reloj de combate; recuperación manual del DJ."),
    woundText:h.status==="wounded"?(h.treated?tr("Tratamiento recibido."):h.woundedAt==null?tr("Sin fecha de herida: requiere revisión del DJ."):untreatedDue(h,now)?tr("Un día sin tratamiento: revisión pendiente."):trHTML`Sin tratamiento: ${Math.max(0,Math.ceil((86400-(now-h.woundedAt))/3600))} h hasta la revisión.`):"",
    hourlyText:h.status==="incapacitated"?(h.incapacitatedAt==null&&h.lastHourlyCheckAt==null?tr("Sin fecha de incapacitación: revisión manual."):hourlyDue(h,now)?tr("Tirada horaria pendiente."):tr("Próxima revisión: una hora desde la última comprobación/incapacitación.")):"",
    incapacitated:h.status==="incapacitated",canTreat:["wounded","incapacitated"].includes(h.status)};
}
