import {staticMarkup} from "../i18n/index.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import {fieldsDialog,escape} from "./ui.mjs";
import {SKILLS,VEHICLE_STATES} from "./fields.mjs";
import {DIFFICULTIES} from "../rolls/rules.mjs";
import {DAMAGE_RESULTS} from "../health/rules.mjs";
import {maneuver,repair,confirmRepair,recordAccident,resolveOccupant,occupants,referencedActor,vehicleGM} from "./service.mjs";
import {chooseDamageResult} from "../damage/dialogs.mjs";
import {DamageService} from "../damage/service.mjs";
import {isMechanicalActor} from "../actors/types.mjs";
const difficulties=Object.fromEntries(Object.entries(DIFFICULTIES).map(([k,v])=>[k,v.label]));
const actors=()=>({"":tr("Seleccionar"),...Object.fromEntries(game.actors.filter(a=>isMechanicalActor(a)&&a.type!=="vehicle").map(a=>[a.uuid,a.name]))});
export async function maneuverDialog(actor){
  vehicleGM(actor);const crew=await occupants(actor),driver=crew.find(p=>p.role==="driver"&&p.actor);
  const response=await fieldsDialog(trHTML`Maniobra · ${actor.name}`,[["driver",tr("Piloto"),"text",{"":tr("Automático / cerebro"),...Object.fromEntries(crew.filter(c=>c.actor).map(c=>[c.actorUuid,c.actor.name]))}],["key",tr("Habilidad"),"text",SKILLS],["description",tr("Maniobra"),"area"],["routine",tr("Rutinaria: éxito sin tirada (DJ)"),"check"],["difficulty",tr("Dificultad"),"text",difficulties],["modifier",tr("Modificador adicional"),"number"],["override",tr("Excepción del DJ: estado / control"),"check"]],{driver:driver?.actorUuid,key:actor.system.vehicle.handlingSkill,routine:true,difficulty:"normal",modifier:0},
    {intro:trHTML`<p>Modificador del vehículo: ${actor.system.vehicle.maneuverModifier}. No se presupone penalización por daño. Un fallo no causa accidente automáticamente.</p>`,confirm:tr("Resolver")});
  if(!response)return;const v=response.values,r=await maneuver(actor,{...v,driver:await referencedActor(v.driver),modifier:v.modifier??0});
  if(!r.success){const choice=await fieldsDialog(tr("Consecuencia · decisión del DJ"),[["type",tr("Resultado"),"text",{failure:tr("Fallo simple"),lossOfControl:tr("Pérdida de control"),collision:tr("Colisión"),accident:tr("Accidente"),custom:tr("Otro")}],["notes",tr("Descripción"),"area"]],{type:"failure"});
    if(choice){await actor.update({"system.vehicle.damageNotes":[actor.system.vehicle.damageNotes,choice.values.notes].filter(Boolean).join("\n")});if(["collision","accident"].includes(choice.values.type))await accidentDialog(actor,choice.values);}}
}
export async function repairDialog(actor){
  vehicleGM(actor);const response=await fieldsDialog(trHTML`Reparar · ${actor.name}`,[["repairer",tr("Reparador"),"text",actors()],["key",tr("Habilidad"),"text",SKILLS],["difficulty",tr("Dificultad elegida por el DJ"),"text",{"":tr("Seleccionar"),...difficulties}],["divisor",tr("Alternativa de la fuente para daño grave"),"text",{1:tr("Usar dificultad"),2:tr("Habilidad ÷2"),3:tr("Habilidad ÷3")}],["modifier",tr("Modificador"),"number"],["systemIndex",tr("Sistema a reparar"),"text",{"":tr("Daño general"),...Object.fromEntries(actor.system.vehicle.systems.map((s,i)=>[i,s.name]))}]],{modifier:0,divisor:"1"},{intro:staticMarkup("<p>Sin tiempo ni dificultad universales. El DJ confirma el efecto después de la tirada.</p>"),confirm:tr("Tirar reparación")});
  if(!response)return;const v=response.values,result=await repair(actor,{...v,repairer:await referencedActor(v.repairer),divisor:Number(v.divisor),modifier:v.modifier??0,systemIndex:v.systemIndex===""?null:Number(v.systemIndex)});
  const decision=await fieldsDialog(trHTML`Reparación · ${result.roll.label}`,[["status",tr("Estado tras reparación (DJ)"),"text",Object.fromEntries(Object.entries(VEHICLE_STATES).filter(([k])=>!["destroyed","vaporized"].includes(k)))]],{status:result.expected},{intro:staticMarkup("<p>La tirada no cambia automáticamente el vehículo. Confirma solo el resultado que corresponda.</p>"),confirm:tr("Aplicar reparación")});
  if(decision)await confirmRepair(actor,result.expected,decision.values.status,result.systemIndex);
}
export async function accidentDialog(actor,initial={}){
  vehicleGM(actor);let message=game.messages.get(actor.system.vehicle.lastAccident);
  if(!message||!actor.system.vehicle.accidentPending){const setup=await fieldsDialog(tr("Accidente de vehículo"),[["type",tr("Tipo / severidad")],["notes",tr("Velocidad, impacto y circunstancias"),"area"]],initial,{intro:actor.system.health.status==="vaporized"?staticMarkup("<p>La fuente indica columna 19 para ocupantes. Anexo B no disponible: no se presupone resultado.</p>"):staticMarkup("<p>Anexo B no disponible: el DJ elige ND / columna y resultado para cada ocupante.</p>"),confirm:tr("Registrar accidente")});if(!setup)return;message=await recordAccident(actor,setup.values);}
  while(true){
    const record=message.getFlag("paranoia-2-edition","vehicleAccident"),pending=record.occupants.map((p,i)=>({...p,index:i})).filter(p=>!p.resolved);
    if(!pending.length){await actor.update({"system.vehicle.accidentPending":false});return;}
    const response=await fieldsDialog(tr("Resolver ocupante · accidente"),[["index",tr("Ocupante"),"text",Object.fromEntries(pending.map(p=>[p.index,`${p.name}${p.successfulEscape?" · escape logrado: escoger columna menos grave":""}`]))],["exclude",tr("Excluir del accidente (DJ: no estaba presente / referencia eliminada)"),"check"],["escapeAttribute",tr("Intentar escapar primero (opcional)"),"text",{"":tr("No tirar escape"),strength:tr("Fuerza"),dexterity:tr("Destreza"),agility:tr("Agilidad"),endurance:tr("Resistencia"),mutantPower:tr("Poder Mutante")}],["escapeDifficulty",tr("Dificultad de escape"),"text",difficulties],["escapeModifier",tr("Modificador de escape"),"number"],["baseDamageNumber",tr("ND elegido (sin fórmula supuesta)"),"number"],["column",tr("Columna elegida por el DJ")],["manualResult",tr("Resultado manual (para columnas no disponibles)"),"text",{"":tr("Tirar / consultar tabla disponible"),...DAMAGE_RESULTS}]],{index:String(pending[0].index),escapeDifficulty:"normal",escapeModifier:0,column:record.sourceColumn??""},{intro:staticMarkup("<p>Armadura y Aguante no se aplican automáticamente al accidente. Escape primero; después el DJ escoge la columna menos grave. Cerrar conserva las resoluciones pendientes.</p>"),confirm:tr("Resolver")});
    if(!response)return;const v=response.values,index=Number(v.index),entry=record.occupants[index];
    if(entry.damageMessageId&&!entry.resolved){const prior=game.messages.get(entry.damageMessageId);if(prior){const damage=await DamageService.fromMessage(prior);await chooseDamageResult(damage);if(damage.applied){record.occupants[index].resolved=true;await message.setFlag("paranoia-2-edition","vehicleAccident",record);}continue;}}
    const result=await resolveOccupant(message,index,{...v,escapeModifier:v.escapeModifier??0});
    if(!result.escapeOnly&&!result.applied){await chooseDamageResult(result);if(result.applied){const updated=foundry.utils.deepClone(message.getFlag("paranoia-2-edition","vehicleAccident"));updated.occupants[index].resolved=true;await message.setFlag("paranoia-2-edition","vehicleAccident",updated);}}
  }
}
