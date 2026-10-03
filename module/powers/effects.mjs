import {tr} from "../i18n/index.mjs";
import {POWER_NS as NS,managedEffects,fatigueLevel,effectExpired} from "./rules.mjs";
import {LABELS} from "../sheets/labels.mjs";

export async function trackPowerEffect(actor,power,options={}){
  if(!game.user.isGM)throw Error(tr("Solo el DJ puede aplicar efectos."));
  const {durationType="gm",duration=0,notes="",sourceId="",targetUuids=[]}=options;
  if(!["turns","minutes","permanent","gm","instantaneous"].includes(durationType)||!Number.isSafeInteger(duration)||duration<0)throw Error(tr("Duración no válida."));
  if(["turns","minutes"].includes(durationType)&&duration<1)throw Error(tr("Indica una duración positiva."));
  if(managedEffects(actor).some(e=>sourceId&&e.flags[NS].powerEffect.sourceId===sourceId))throw Error(tr("Este uso ya tiene un efecto activo."));
  if(managedEffects(actor).some(e=>e.flags[NS].powerEffect.powerKey===power.key&&!e.flags[NS].powerEffect.fatigue))throw Error(tr("Termina primero el efecto anterior de este poder; no se acumulan bonificaciones idénticas."));
  const combat=game.combats.find(c=>c.round>0&&c.combatants.some(p=>p.actor?.uuid===actor.uuid));
  const modifiers={};
  if(power.key==="adrenalineControl"&&!options.manual){
    for(const key of ["strength","agility"]){
      const bonus=Number(options[key]??0);
      if(!Number.isSafeInteger(bonus)||bonus<0)throw Error(tr("El incremento lo fija el DJ con un entero no negativo."));
      modifiers[`attribute:${key}`]=bonus;
    }
    // Dependent learned skills are adjusted only by an explicit GM amount, not a guessed formula.
    const bonus=Number(options.agilitySkills??0);
    if(!Number.isSafeInteger(bonus)||bonus<0)throw Error(tr("Incremento de habilidades no válido."));
    for(const key of Object.keys(LABELS.skillNames.agility))modifiers[`skill:agility.${key}`]=bonus;
  }
  if(power.key==="empathy"&&!options.manual)for(const key of Object.keys(LABELS.skillNames.cynicism))modifiers[`skill:cynicism.${key}`]=5;
  const now=game.time.worldTime;
  const data={powerKey:power.key,sourceActor:actor.uuid,sourceClone:actor.system.cloneNumber,sourceId,targetUuids,
    startTime:now,startRound:combat?.round??null,combatId:combat?.id??"",durationType,duration,notes:String(notes).slice(0,2000),
    // Dot-bearing skill paths must be VALUES, never object keys (Foundry expands dotted keys).
    modifiers:Object.entries(modifiers).map(([path,value])=>({type:path.split(":")[0],key:path.split(":")[1],value})),
    endsAt:durationType==="minutes"?now+duration*60:durationType==="turns"?now+duration*5:null,
    endsRound:durationType==="turns"&&combat?combat.round+duration:null,
    fatigueAfter:!options.manual&&["adrenalineControl","energyField"].includes(power.key)?(power.key==="adrenalineControl"&&fatigueLevel(actor)>0?2:1):0};
  return actor.createEmbeddedDocuments("ActiveEffect",[{name:tr("Estado temporal privado"),img:"icons/svg/aura.svg",transfer:false,showIcon:0,
    flags:{[NS]:{powerEffect:data}},start:{time:now},
    duration:{value:durationType==="minutes"?duration*60:null,units:"seconds",expiry:null}}]);
}
export async function endPowerEffect(actor,id,{rested=false}={}){
  if(!game.user.isGM)throw Error(tr("Solo el DJ puede terminar efectos."));
  const effect=actor.effects.get(id),data=effect?.flags?.[NS]?.powerEffect;
  if(!data)throw Error(tr("Efecto no válido."));
  if(data.fatigueAfter&&!rested&&data.sourceClone===actor.system.cloneNumber){
    const existing=managedEffects(actor).find(e=>e.flags[NS].powerEffect.fatigue);
    const fatigue=Math.max(data.fatigueAfter,fatigueLevel(actor));
    if(existing)await existing.update({[`flags.${NS}.powerEffect.fatigue`]:fatigue});
    else await actor.createEmbeddedDocuments("ActiveEffect",[{name:tr("Agotamiento temporal"),img:"icons/svg/sleep.svg",transfer:false,showIcon:0,
      flags:{[NS]:{powerEffect:{powerKey:data.powerKey,sourceActor:actor.uuid,sourceClone:actor.system.cloneNumber,
        startTime:game.time.worldTime,startRound:null,durationType:"gm",notes:tr("Hasta descanso suficiente confirmado por el DJ."),fatigue}}}}]);
  }
  await actor.deleteEmbeddedDocuments("ActiveEffect",[id]);
}
let expiryQueue=Promise.resolve();
export function expirePowerEffects(){
  if(game.user?.id!==game.users.activeGM?.id)return;
  expiryQueue=expiryQueue.catch(()=>{}).then(async()=>{
    const actors=new Map(game.actors.map(a=>[a.uuid,a]));
    for(const c of game.combats)for(const p of c.combatants)if(p.actor)actors.set(p.actor.uuid,p.actor);
    for(const actor of actors.values())for(const effect of managedEffects(actor)){
      const data=effect.flags[NS].powerEffect;
      if(effectExpired(data,game.time.worldTime,game.combats.get(data.combatId)))await endPowerEffect(actor,effect.id);
    }
  }).catch(error=>console.error("paranoia-2-edition | Power expiry",error));
  return expiryQueue;
}
