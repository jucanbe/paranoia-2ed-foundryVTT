import {staticMarkup} from "../i18n/index.mjs";
import {tr,trHTML,localizedRecord} from "../i18n/index.mjs";
import {isRulesActor} from "../actors/types.mjs";
import {POWER_REGISTRY,POWER_RESULTS,identifyPower} from "./registry.mjs";
import {POWER_NS as NS,pointsFor,managedEffects} from "./rules.mjs";
import {DIFFICULTIES} from "../rolls/rules.mjs";
import {DAMAGE_RESULTS} from "../health/rules.mjs";
import {LABELS} from "../sheets/labels.mjs";
import {availablePowers,ownedPower,requirePowerOwner,renderPower} from "./service.mjs";
import {requestPower,processPowerRequest} from "./requests.mjs";

const opened=new Set();
async function dialog(title,content,label,submit,render){
  let pending;
  return foundry.applications.api.DialogV2.wait({window:{title},position:{width:520},classes:["p2-power-dialog"],content,
    buttons:[{action:"submit",label,default:true,callback:(_event,button)=>pending??=Promise.resolve().then(()=>submit(button.form)).catch(error=>{ui.notifications.error(error.message);return null;})},
      {action:"cancel",label:tr("Cancelar"),callback:()=>null}],render});
}
const value=(form,key,fallback="")=>form.elements[key]?.value??fallback;
function useOptions(form){
  const options=Object.fromEntries(["powerKey","intent","target","difficulty","notes","resultOverride"].map(key=>[key,value(form,key)]));
  for(const key of ["modifier","cost"])options[key]=Number(value(form,key));
  for(const key of ["approxWeightKg","distanceMeters"])options[key]=value(form,key)===""?null:Number(value(form,key));
  options.override=game.user.isGM&&!!form.elements.override?.checked;
  return options;
}
export async function openPowerUse(actor,requestMessage=null,selectedKey=null){
  requirePowerOwner(actor);
  if(opened.has(actor.uuid))return;
  opened.add(actor.uuid);
  try{
    if(requestMessage&&game.user.id!==game.users.activeGM?.id)throw Error(tr("La aprobación debe hacerla el DJ coordinador activo."));
    const requested=requestMessage?.getFlag(NS,"powerRequest");
    const power=ownedPower(actor,requested?.powerKey??selectedKey);
    if(!power)throw Error(tr("Selecciona un poder reconocido del registro."));
    const options={cost:1,modifier:0,difficulty:"normal",approxWeightKg:power.baselineWeightKg??null,...requested?.options,powerKey:power.key};
    const content=await renderPower("use",{actorName:actor.name,power:localizedRecord(power),points:pointsFor(actor.system),attribute:actor.system.attributes.mutantPower.value,
      range:power.targetType==="self"?tr("Personal"):power.rangeMeters==null?tr("Según el DJ"):power.rangeMeters===0?tr("Contacto físico"):`${power.rangeMeters} m`,options,isGM:game.user.isGM,
      telekinesis:power.key==="telekinesis",results:Object.entries(POWER_RESULTS).map(([key,label])=>({key,label})),
      difficulties:Object.entries(DIFFICULTIES).map(([key,data])=>({key,...data,selected:key===options.difficulty}))});
    return await dialog(tr("Usar Poder Mutante"),content,game.user.isGM?tr("Aprobar y tirar"):tr("Solicitar al DJ"),form=>{
      const data=useOptions(form);
      return requestMessage?processPowerRequest(requestMessage,data):requestPower(actor,"use",data);
    });
  }finally{opened.delete(actor.uuid);}
}
export async function openPowerAdjudication(message){
  if(!game.user.isGM)throw Error(tr("Solo el DJ puede adjudicar."));
  const record=message.getFlag(NS,"powerResult"),actor=await fromUuid(record.actorUuid),power=localizedRecord(POWER_REGISTRY[record.powerKey]);
  const tokens=game.scenes.contents.flatMap(s=>s.tokens.filter(t=>t.actor?.uuid===actor.uuid).map(t=>({uuid:t.uuid,name:`${s.name}: ${t.name}`})));
  const actors=new Map(game.actors.filter(a=>isRulesActor(a)).map(a=>[a.uuid,{uuid:a.uuid,name:a.name}]));
  for(const c of game.combats)for(const p of c.combatants)if(isRulesActor(p.actor))actors.set(p.actor.uuid,{uuid:p.actor.uuid,name:p.actor.name});
  const content=await renderPower("adjudicate",{power,outcome:record.outcome,actors:[...actors.values()],tokens,
    regeneration:power.key==="regeneration",resistance:!!power.resistance,stun:["mentalBlast","electroshock"].includes(power.key),
    teleportation:power.key==="teleportation",adrenaline:power.key==="adrenalineControl",empathy:power.key==="empathy",
    minute:["energyField","adrenalineControl"].includes(power.key),duration:["energyField","adrenalineControl"].includes(power.key)?1:0,
    results:Object.entries(POWER_RESULTS).map(([key,label])=>({key,label})),healthResults:Object.entries(DAMAGE_RESULTS).map(([key,label])=>({key,label}))});
  return dialog(tr("Adjudicar Poder Mutante"),content,tr("Confirmar adjudicación"),form=>{
    const options=Object.fromEntries(["action","targetUuid","durationType","notes","healthResult","tokenUuid","observable","resultClass"].map(key=>[key,value(form,key)]));
    for(const key of ["duration","strength","agility","agilitySkills","modifier","x","y"])options[key]=Number(value(form,key,"0"));
    options.confirmed=!!form.elements.confirmed?.checked;options.messageId=message.id;
    return requestPower(actor,"adjudicate",options);
  },(_event,app)=>{
    const form=app.element.querySelector("form"),update=()=>{for(const el of form.querySelectorAll("[data-power-field]"))el.hidden=!el.dataset.powerField.split(" ").includes(form.elements.action.value);};
    form.elements.action.addEventListener("change",update);update();
  });
}
export async function powerAction(_event,button){
  try{
    requirePowerOwner(this.actor);
    const action=button.dataset.powerAction;
    if(action==="use")return await openPowerUse(this.actor,null,button.dataset.powerKey);
    if(action==="recover")return await dialog(tr("Recuperar PM por descanso"),staticMarkup('<label>Horas completas de sueño tranquilo e ininterrumpido<input name="hours" type="number" step="1" min="0" value="1" required></label><p>No elimina por sí solo agotamiento: el DJ confirma el descanso suficiente aparte.</p>'),tr("Recuperar"),form=>requestPower(this.actor,"recover",{hours:Number(value(form,"hours"))}));
    if(action==="end"){
      const rested=button.dataset.fatigue==="true";
      if(await foundry.applications.api.DialogV2.confirm({window:{title:tr("Terminar efecto")},content:rested?staticMarkup("<p>¿Confirmas descanso suficiente para eliminar el agotamiento temporal?</p>"):staticMarkup("<p>¿Terminar el efecto? Se aplicará el agotamiento posterior si corresponde.</p>")}))return await requestPower(this.actor,"endEffect",{effectId:button.dataset.effectId,rested});
    }
  }catch(error){ui.notifications.error(error.message);}
}
export function powerView(actor){return {points:pointsFor(actor.system),choices:Object.values(POWER_REGISTRY).map(p=>({label:p.label})),
  learned:availablePowers(actor).filter(p=>p.key!==identifyPower(actor.system.mutantPower.name)?.key).map(p=>({key:p.key,label:p.label})),
  effects:managedEffects(actor).map(e=>{const data=e.flags[NS].powerEffect;return {id:e.id,label:POWER_REGISTRY[data.powerKey]?.label??tr("Efecto"),notes:data.notes,
    modifiers:(data.modifiers??[]).filter(m=>m.value).map(m=>`${m.type==="attribute"?LABELS.attributeNames[m.key]:LABELS.skillNames[m.key.split(".")[0]]?.[m.key.split(".")[1]]} +${m.value}`).join(" · "),
    fatigue:!!data.fatigue,duration:data.fatigue?trHTML`Agotamiento temporal: ${data.fatigue>=2?tr("Incapacitado"):tr("Herido (−4)")}`:data.endsRound!=null?trHTML`Hasta turno ${data.endsRound}`:data.endsAt!=null?trHTML`Hasta tiempo del mundo ${data.endsAt} s`:tr("Hasta decisión del DJ")};})};}
export function registerPowerChat(){
  Hooks.on("renderChatMessageHTML",(message,html)=>{
    for(const [selector,handler] of [["[data-power-review]",async()=>openPowerUse(await fromUuid(message.getFlag(NS,"powerRequest").actorUuid),message)],
      ["[data-power-adjudicate]",()=>openPowerAdjudication(message)]])for(const button of html.querySelectorAll(selector)){
      if(!game.user.isGM){button.remove();continue;}
      button.addEventListener("click",async()=>{button.disabled=true;try{await handler();}catch(error){ui.notifications.error(error.message);}finally{button.disabled=false;}});
    }
  });
}
