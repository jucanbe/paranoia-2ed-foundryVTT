import {localizedRecord,tr} from "../i18n/index.mjs";
import {buildCitizenId} from "../actors/identity.mjs";
export const INVENTORY_POLICIES=Object.freeze(localizedRecord({standard:"Equipo estándar de Esclarecedor",none:"Sin equipo",keep:"Conservar equipo actual (anulación del GM)"}));
export const POWER_POLICIES=Object.freeze(localizedRecord({keep:"Mantener el mismo",manual:"Cambiar manualmente",random:"Generar de nuevo"}));
export const isTerminal=health=>["dead","vaporized"].includes(health.status);
/** Embedded document timestamps may be filled on only one V14 client until reload. */
export function revisionSource(value){
  if(Array.isArray(value))return value.map(revisionSource);
  if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).filter(k=>k!=="_stats").sort().map(k=>[k,revisionSource(value[k])]));
  return value;
}
export function validateReplacement(system,options){
  if(!Number.isSafeInteger(system.cloneNumber)||system.cloneNumber<1||!Number.isSafeInteger(system.cloneNumber+1))throw Error(tr("Número de clon no válido."));
  if(!isTerminal(system.health)&&options.livingOverride!==true)throw Error(tr("El ciudadano sigue vivo. Se requiere confirmación explícita del DJ."));
  if(!Object.hasOwn(INVENTORY_POLICIES,options.inventory)||!Object.hasOwn(POWER_POLICIES,options.power))throw Error(tr("Opción de reemplazo no válida."));
  if(typeof options.credits!=="number"||!Number.isFinite(options.credits))throw Error(tr("Créditos no válidos."));
  if(options.power==="manual"&&(typeof options.powerName!=="string"||!options.powerName.trim()))throw Error(tr("Introduce el Poder Mutante del nuevo clon."));
}
export function archiveClone(source,options,{timestamp=Date.now(),worldTime=0}={}){
  const s=source.system;
  return {number:s.cloneNumber,citizenId:source.name,deathType:s.health.status,
    causeOfDeath:options.causeOfDeath??"",notes:[s.health.notes,s.health.treatmentNotes].filter(Boolean).join("\n"),
    localizedWounds:structuredClone(s.health.wounds??[]),
    gmNotes:options.gmNotes??"",appearanceNotes:options.appearanceNotes??"",timestamp,worldTime,credits:s.credits,
    inventoryPolicy:options.inventory,
    equipmentDisposition:s.health.status==="vaporized"?"destroyed":options.inventory==="keep"?"retainedByGM":"leftWithPreviousBody",
    inventorySnapshot:(source.items??[]).map(item=>({name:item.name,type:item.type,
      catalogId:item.flags?.["paranoia-2-edition"]?.catalogId??"",quantity:item.system.quantity??1,
      assigned:item.system.assigned??false,length:item.system.length??null}))};
}
export function nextCitizenId(actor){return buildCitizenId({...actor.system,cloneNumber:actor.system.cloneNumber+1},actor.name);}
