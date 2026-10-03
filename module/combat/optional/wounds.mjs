import {tr,trHTML} from "../../i18n/index.mjs";
import {LOCATIONS} from "./rules.mjs";
import {enabled} from "./settings.mjs";
import {applyHealthResult,withHealthLock} from "../../health/service.mjs";
export async function addWound(actor,{location,side="unspecified",consequence="narrative",permanent=false,notes="",damageId=""}={}){
  if(!enabled("hitLocation")||!["character","npc"].includes(actor.type)||!game.user.isGM)throw Error(tr("Localización no disponible."));
  if(!Object.hasOwn(LOCATIONS,location)||!["left","right","unspecified"].includes(side)||!["narrative","blind","deaf","incapacitated","cognitive","custom"].includes(consequence))throw Error(tr("Localización o consecuencia no válida."));
  const wound=await withHealthLock(actor,async()=>{
    const wounds=structuredClone(actor.system.toObject().health.wounds??[]);if(damageId&&wounds.some(w=>w.damageId===damageId))return null;
    const record={id:foundry.utils.randomID(),location,side,consequence,permanent:!!permanent||(location==="head"&&["cognitive","custom"].includes(consequence)),notes:String(notes),active:true,damageId,cloneNumber:actor.system.cloneNumber,timestamp:Date.now()};wounds.push(record);
    if(!await actor.update({"system.health.wounds":wounds}))throw Error(tr("No se guardó la localización."));return record;
  });
  if(wound?.location==="head"&&consequence==="incapacitated")await applyHealthResult(actor,"incapacitated",{announce:false});return wound;
}
export async function woundDialog(actor,damageId=""){
  if(!enabled("hitLocation")||!game.user.isGM||!["character","npc"].includes(actor.type))return;
  const values=await foundry.applications.api.DialogV2.wait({window:{title:tr("Localización de herida · DJ")},content:trHTML`<p>Sin tabla del Anexo B: el DJ decide. La penalización normal por Herido permanece.</p><label>Localización<select name="location">${Object.entries(LOCATIONS).map(([key,label])=>`<option value="${key}">${label}</option>`).join("")}</select></label><label>Lado<select name="side"><option value="unspecified">Sin especificar</option><option value="left">Izquierdo</option><option value="right">Derecho</option></select></label><label>Consecuencia de cabeza<select name="consequence"><option value="narrative">Solo narrativa</option><option value="blind">Ceguera</option><option value="deaf">Sordera</option><option value="incapacitated">Incapacitación</option><option value="cognitive">Deterioro cognitivo permanente</option><option value="custom">Efecto permanente personalizado</option></select></label><label><input name="permanent" type="checkbox"> Conservar consecuencia permanente al sanar</label><label>Notas<textarea name="notes"></textarea></label>`,buttons:[{action:"apply",label:tr("Localizar"),callback:(_e,b)=>Object.fromEntries(new FormData(b.form))},{action:"cancel",label:tr("Omitir")}]});
  if(values?.location)return addWound(actor,{...values,permanent:!!values.permanent,damageId});
}
export {healedWounds} from "./rules.mjs";
