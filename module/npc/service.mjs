import {tr} from "../i18n/index.mjs";
import {generationOptions,generateProfile,selectNPCEquipment,uniqueNPCIdentity} from "./generation.mjs";
import {ItemCatalog,CATALOG_NAMESPACE} from "../items/catalog.mjs";
import {POWER_NS} from "../powers/rules.mjs";
import {rollCreationD20} from "../creation/dice.mjs";
const requireGM=()=>{if(!game.user.isGM)throw Error(tr("Solo el DJ puede generar PNJ."));};
const cosmeticIndex=length=>Math.floor(Math.random()*length); // Cosmetics only; Attribute dice always use Foundry Roll.
function equipmentCopies(rows){
  let armorEquipped=false;
  return rows.map(({item,assigned})=>{
    const copy=item.toObject();delete copy.folder;delete copy.ownership;delete copy._stats;
    copy._id=foundry.utils.randomID();copy.system.assigned=assigned;copy.system.quantity=1;
    copy.flags??={};copy.flags[CATALOG_NAMESPACE]={...copy.flags[CATALOG_NAMESPACE],catalogSource:item.uuid};
    if(copy.type==="armor"){copy.system.equipped=!armorEquipped;armorEquipped=true;}
    return copy;
  });
}
const committed=new WeakSet(),committing=new WeakSet();
export class NPCGenerator {
  static async preview(input={}){
    requireGM();const options=generationOptions(input);
    const entries=options.basicEquipment||options.randomEquipment?await ItemCatalog.entries():[];
    const defaults=new CONFIG.Actor.dataModels.npc().toObject();
    const used=new Set(game.actors.map(a=>a.name.toLocaleUpperCase()));
    const sources=[];let shared;
    for(let i=0;i<options.quantity;i++){
      const profile=options.sameProfile&&shared?structuredClone(shared):{
        system:await generateProfile(defaults,options,rollCreationD20),items:equipmentCopies(await selectNPCEquipment(entries,options,async length=>(await new foundry.dice.Roll(`1d${length}`).evaluate()).total-1))};
      if(options.sameProfile&&!shared)shared=structuredClone(profile);
      const system=profile.system,items=profile.items;
      // Fresh embedded IDs even for identical group profiles.
      for(const item of items)item._id=foundry.utils.randomID();
      system.npc.activeWeaponId=items.find(i=>i.type==="weapon")?._id??"";
      const name=uniqueNPCIdentity(system,options,used,cosmeticIndex);
      const source={name,type:"npc",system,items,ownership:{default:0},prototypeToken:{name,actorLink:false,disposition:options.disposition}};
      new CONFIG.Actor.dataModels.npc(system,{strict:true});
      for(const item of items)new CONFIG.Item.documentClass(item,{strict:true});
      sources.push(source);
    }
    return {options,sources};
  }
  static async create(draft){
    requireGM();if(committed.has(draft)||committing.has(draft))throw Error(tr("Este grupo ya se está creando o fue creado."));
    generationOptions(draft.options);committing.add(draft);
    try{
      if(draft.sources.length!==draft.options.quantity)throw Error(tr("El borrador del grupo cambió."));
      const used=new Set(game.actors.map(a=>a.name.toLocaleUpperCase()));
      const sources=structuredClone(draft.sources);
      for(const source of sources){
        if(source.type!=="npc")throw Error(tr("El borrador no es de PNJ."));
        if(used.has(source.name.toLocaleUpperCase()))source.name=uniqueNPCIdentity(source.system,{name:source.system.identity.useCitizenId?source.system.identity.name:source.name,sector:source.system.identity.sector},used,cosmeticIndex);
        else used.add(source.name.toLocaleUpperCase());
        source.prototypeToken.name=source.name;source.ownership={default:0};
        new CONFIG.Actor.dataModels.npc(source.system,{strict:true});
      }
      // Validate and resolve every pack entry before the single document batch. No World Items or chat spam.
      const actors=await foundry.documents.Actor.createDocuments(sources);
      committed.add(draft);return actors;
    }finally{committing.delete(draft);}
  }
  static async generate(options={}){return this.create(await this.preview(options));}
}
export async function duplicateNPC(actor){
  requireGM();if(actor.type!=="npc")throw Error(tr("Selecciona un PNJ."));
  const system=actor.system.toObject(),used=new Set(game.actors.map(a=>a.name.toLocaleUpperCase()));
  const name=uniqueNPCIdentity(system,{name:system.identity.useCitizenId?system.identity.name:actor.name,sector:system.identity.sector},used,cosmeticIndex);
  const effects=actor.toObject().effects.filter(e=>!e.flags?.[POWER_NS]?.powerEffect);
  // Native document cloning creates independent embedded Items; copied IDs are scoped to the new parent.
  const copy=actor.clone({name,system,effects,prototypeToken:{name,actorLink:false}},{save:false});
  // Native clone merges overrides; explicitly replace ownership so a duplicate does not inherit player grants.
  copy.updateSource({ownership:{default:0}},{recursive:false});
  return foundry.documents.Actor.create(copy.toObject());
}
