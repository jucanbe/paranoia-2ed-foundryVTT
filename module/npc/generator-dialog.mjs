import {tr,trHTML} from "../i18n/index.mjs";
import {NPC_GENERATION_CONFIG as POLICY,NPC_ROLES} from "./config.mjs";
import {NPCGenerator} from "./service.mjs";
import {CLEARANCE_CODES} from "../actors/identity.mjs";
import {SERVICES,serviceLabel} from "../creation/config.mjs";
import {LABELS} from "../sheets/labels.mjs";
import {SOCIETY_REGISTRY,societyName} from "../societies/registry.mjs";
const root="systems/paranoia-2-edition/templates/npc";
let opened=false;
const choices=(map,selected)=>Object.entries(map).map(([key,label])=>({key,label,selected:key===selected}));
async function show(title,content,buttons){
  return foundry.applications.api.DialogV2.wait({window:{title},position:{width:530},classes:["p2-npc-generator"],content,buttons,
    render:(_event,app)=>{for(const details of app.element.querySelectorAll("details"))details.addEventListener("toggle",()=>{
      app.setPosition({top:Math.max(10,(window.innerHeight-app.element.offsetHeight)/2)});
    });}});
}
export async function openNPCGenerator(){
  if(!game.user.isGM||opened)return;opened=true;
  try{
    const defaults=POLICY.defaults;
    const content=await foundry.applications.handlebars.renderTemplate(`${root}/generator.hbs`,{
      societies:choices({...Object.fromEntries(Object.values(SOCIETY_REGISTRY).map(s=>[s.key,s.displayName])),custom:tr("Otra / personalizada")},""),
      clearances:choices(Object.fromEntries(Object.keys(CLEARANCE_CODES).map(key=>[key,LABELS.clearances[key]])),defaults.securityClearance),
      services:choices({"":tr("Sin servicio / especial"),...Object.fromEntries(Object.keys(SERVICES).map(key=>[key,serviceLabel(key)]))},defaults.service),
      roles:choices(NPC_ROLES,defaults.role),competences:choices(Object.fromEntries(Object.entries(POLICY.competence).map(([key,data])=>[key,trHTML`${data.label} (${data.attributeAdjustment>=0?"+":""}${data.attributeAdjustment} a Atributos)`])),defaults.competence),maxQuantity:POLICY.maxQuantity
    });
    let submitted;
    const options=await show(tr("Generar PNJ"),content,[{action:"generate",label:tr("Generar"),default:true,callback:(_e,button)=>{
      if(submitted)return submitted;
      const form=button.form,fields=form.elements;
      submitted=Object.fromEntries(new FormData(form));
      for(const key of ["cloneNumber","quantity","disposition"])submitted[key]=Number(fields[key].value);
      for(const key of ["useCitizenId","basicEquipment","randomEquipment","mutation","sameProfile","preview"])submitted[key]=fields[key].checked;
      return submitted;
    }},{action:"cancel",label:tr("Cancelar"),callback:()=>null}]);
    if(!options||typeof options!=="object")return;
    let draft=await NPCGenerator.preview(options);
    if(options.preview){
      for(;;){
        const data={npcs:draft.sources.map(source=>({name:source.name,service:source.system.service,clearance:LABELS.clearances[source.system.securityClearance],
          attributes:Object.entries(source.system.attributes).filter(([key])=>key!=="mutantPower"||options.mutation).map(([key,attribute])=>({label:LABELS.attributeNames[key],value:attribute.value})),
          skills:Object.entries(source.system.skills).flatMap(([group,skills])=>Object.entries(skills).filter(([,s])=>s.value>0).map(([key,s])=>({label:LABELS.skillNames[group][key],value:s.value}))),
          items:source.items.map(i=>i.name),power:source.system.mutantPower.name,society:societyName(source.system.secretSociety)}))};
        const preview=await foundry.applications.handlebars.renderTemplate(`${root}/preview.hbs`,data);
        const result=await show(tr("Vista previa — solo DJ"),preview,[{action:"create",label:tr("Crear PNJ"),default:true,callback:()=>"create"},{action:"reroll",label:tr("Generar de nuevo"),callback:()=>"reroll"},{action:"cancel",label:tr("Cancelar"),callback:()=>null}]);
        if(!result||result==="cancel")return;
        if(result==="create")break;
        draft=await NPCGenerator.preview(options);
      }
    }
    const actors=await NPCGenerator.create(draft);
    ui.notifications.info(trHTML`${actors.length} PNJ creados. Generador de conveniencia, no tabla oficial.`);
    if(actors.length===1)await actors[0].sheet.render({force:true});
    return actors;
  }catch(error){ui.notifications.error(error.message);}finally{opened=false;}
}
