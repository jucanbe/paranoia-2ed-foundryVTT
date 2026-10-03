import {trHTML,tr} from "../i18n/index.mjs";
import {ItemCatalog,STARTER_IDS,CATALOG_NAMESPACE,catalogId} from "../items/catalog.mjs";
import {purchaseSummary} from "./purchases.mjs";
import {creationLedger} from "../credits/rules.mjs";
const COMMITTING=new Set();

/** Build the complete inventory before the single Actor document transaction. */
export function creationInventory(actor,entries,purchases){
  const sources=actor.items.map(item=>item.toObject());
  const copy=(item,assigned)=>{
    const source=item.toObject();
    source._id=foundry.utils.randomID();
    delete source.folder;delete source.ownership;delete source._stats;
    source.system.assigned=assigned;
    source.flags??={};source.flags[CATALOG_NAMESPACE]={...source.flags[CATALOG_NAMESPACE],catalogSource:item.uuid};
    return source;
  };
  for(const id of STARTER_IDS){
    const item=entries.find(i=>catalogId(i)===id);
    if(!item)throw new Error(trHTML`Equipo inicial no disponible: ${id}`);
    const existing=sources.find(i=>catalogId(i)===id&&i.system.assigned);
    if(existing){existing.system.quantity=Math.max(1,existing.system.quantity??1);continue;}
    const source=copy(item,true);source.system.quantity=1;sources.push(source);
  }
  for(const row of purchases.rows){
    // Keep customized/older possessions separate; combine each draft selection into one new stack.
    const source=copy(row.item,false);
    source.system.quantity=source.system.priceUnit==="meter"?1:row.quantity;
    if(source.system.priceUnit==="meter")source.system.length=row.quantity;
    sources.push(source);
  }
  return sources;
}

/** No document is written until every lookup, budget and schema has validated. */
export async function commitCreation(actor,session,initialSource){
  if(session.committed)return;
  if(COMMITTING.has(actor.uuid))throw new Error(tr("Ya se está guardando este personaje."));
  COMMITTING.add(actor.uuid);
  try{
    const entries=await ItemCatalog.entries();
    if(actor.system.creation?.complete&&session.data.securityClearance!==actor.system.securityClearance)
      throw new Error(tr("El personaje ya existe. Cambia su Nivel de Seguridad mediante los controles de ascenso del DJ antes de recrearlo."));
    const purchases=purchaseSummary(session.purchases,entries,session.data.securityClearance,game.user.isGM&&session.purchaseOverride);
    const system=foundry.utils.mergeObject(actor.system.toObject(),{...session.finalSystemChanges(),credits:purchases.remaining},{inplace:false});
    system.creditLedger=creationLedger(actor,purchases,{id:foundry.utils.randomID(),userId:game.user.id,timestamp:Date.now(),worldTime:game.time.worldTime});
    const items=creationInventory(actor,entries,purchases);
    new CONFIG.Actor.dataModels.character(system,{strict:true});
    for(const item of items)new CONFIG.Item.documentClass(item,{parent:actor,strict:true});
    if(!actor.isOwner||!actor.canUserModify(game.user,"update"))throw new Error(tr("No tienes permiso para modificar este personaje."));
    if(JSON.stringify(actor.toObject())!==initialSource)throw new Error(tr("El personaje cambió mientras el asistente estaba abierto. Cierra y vuelve a abrir el asistente para conservar esos cambios."));
    // Foundry's parent update writes the embedded hierarchy in the same database batch.
    // Keep every existing embedded document; do not create equipment in separate requests.
    const updated=await actor.update({system,items},{diff:false,recursive:false,paranoiaCharacterCreation:true});
    if(!updated)throw new Error(tr("No se pudo guardar el personaje."));
    session.committed=true;
  }finally{COMMITTING.delete(actor.uuid);}
}
