import {tr,trHTML} from "../i18n/index.mjs";
import {isTerminal,validateReplacement,archiveClone,revisionSource} from "./rules.mjs";
import {withHealthLock,requireGM} from "../health/service.mjs";
import {ItemCatalog} from "../items/catalog.mjs";
import {creationInventory} from "../creation/commit.mjs";
import {powerForRoll} from "../creation/config.mjs";
import {requestClone} from "./requests.mjs";
import {pointsFor,POWER_NS} from "../powers/rules.mjs";
import {isRulesActor} from "../actors/types.mjs";
import {identifyPower} from "../powers/registry.mjs";

// An optimistic fingerprint also rejects unrelated edits made while a dialog is open.
export async function cloneRevision(actor){
  const bytes=new TextEncoder().encode(JSON.stringify(revisionSource(actor.toObject())));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
}
export class CloneService {
  static canActivate(actor){return !!(game.user.isGM&&isRulesActor(actor)&&isTerminal(actor.system.health));}
  static archiveCurrentClone(actor,metadata){return archiveClone(actor.toObject(),metadata,{worldTime:game.time.worldTime});}
  static async prepareReplacement(actor,options){
    requireGM(actor);
    if(!isRulesActor(actor))throw Error(tr("Los robots no usan clones ciudadanos."));
    validateReplacement(actor.system,options);
    const source=actor.toObject();
    const system=structuredClone(source.system);
    if(actor.type==="character"){
      const record=this.archiveCurrentClone(actor,options);
      system.clones??={history:[]};system.clones.history.push(record);
    }else if(!system.identity.useCitizenId)throw Error(tr("Activa el identificador ciudadano para crear el siguiente clon de este PNJ."));
    system.cloneNumber++;
    // Schema defaults reset every physical field, including future health metadata.
    system.health=new CONFIG.Actor.dataModels[actor.type]().toObject().health;
    system.credits=options.credits;
    if(options.power==="manual")system.mutantPower.name=options.powerName.trim();
    if(options.power==="random")system.mutantPower.name=powerForRoll((await new foundry.dice.Roll("1d20").evaluate()).total);
    if(actor.type==="npc")system.mutantPower.key=identifyPower(system.mutantPower.name)?.key??"";
    const points=pointsFor(system);system.mutantPower.points={max:points.max,value:points.max};
    let items=source.items;
    if(options.inventory==="none")items=[];
    if(options.inventory==="standard")items=creationInventory({items:[]},await ItemCatalog.entries(),{rows:[]});
    if(actor.type==="npc"&&!items.some(i=>i._id===system.npc.activeWeaponId&&i.type==="weapon"))
      system.npc.activeWeaponId=items.find(i=>i.type==="weapon")?._id??"";
    // Health is not mirrored by system ActiveEffects: preserve all unrelated effects.
    const changes={system};
    if(source.effects?.some(e=>e.flags?.[POWER_NS]?.powerEffect))changes.effects=source.effects.filter(e=>!e.flags?.[POWER_NS]?.powerEffect);
    if(options.inventory!=="keep")changes.items=items;
    new CONFIG.Actor.dataModels[actor.type](system,{strict:true});
    for(const item of items)new CONFIG.Item.documentClass(item,{parent:actor,strict:true});
    return {changes,previousName:source.name};
  }
  static async activateNextClone(actor,options={}){
    requireGM(actor);
    return requestClone(actor,{inventory:"standard",power:"keep",credits:actor.system.credits,...options,
      expected:options.expected??await cloneRevision(actor)});
  }
}

/** Only the active GM executes transitions; shared health lock orders competing damage. */
export async function executeClone(actor,options,user){
  if(!user?.isGM||game.user.id!==game.users.activeGM?.id)throw Error(tr("La activación requiere al DJ coordinador."));
  return withHealthLock(actor,async()=>{
    const revision=await cloneRevision(actor);
    if(options.expected!==revision)throw Error(tr("El personaje cambió. Revisa su estado y abre de nuevo la activación."));
    const {changes,previousName}=await CloneService.prepareReplacement(actor,options);
    if(await cloneRevision(actor)!==revision)throw Error(tr("El personaje cambió durante la preparación. No se activó el clon."));
    // One parent update stores history, fresh body and the exact embedded inventory together.
    // recursive:false replaces the embedded arrays rather than merging old physical Items.
    const updated=await actor.update(changes,{diff:false,recursive:false});
    if(!updated)throw Error(tr("No se pudo activar el clon."));
    const name=actor.name;
    if(!options.silent){
      const escape=foundry.utils.escapeHTML;
      try{await foundry.documents.ChatMessage.create({speaker:{actor:actor.id,alias:name},
        content:trHTML`<section><strong>NUEVO CLON ACTIVADO</strong><p>${escape(previousName)} ha sido reemplazado por: <strong>${escape(name)}</strong></p><p>Estado: Sano</p></section>`});}
      catch(error){console.error(error);ui.notifications.warn(tr("Clon activado; no se pudo publicar el aviso. No repitas la activación."));}
    }
    return {name,cloneNumber:actor.system.cloneNumber};
  });
}
