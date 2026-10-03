import {documentText,documentView,preserveTranslatedFields} from "../i18n/documents.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import {ITEM_SKILLS} from "../items/config.mjs";
import {ItemCatalog} from "../items/catalog.mjs";
import {validateMemory,programSummary} from "./rules.mjs";
import {createVehicleDialog} from "../vehicles/creator.mjs";
let open=false;
export async function createRobotDialog(){
  if(!game.user.isGM||open)return;open=true;
  try{
    const templates=await game.packs.get("paranoia-2-edition.robots").getDocuments();
    const esc=foundry.utils.escapeHTML;
    const chosen=await foundry.applications.api.DialogV2.wait({window:{title:tr("Crear Robot · plantilla")},content:trHTML`<label>Plantilla<select name="template"><option value="">Personalizado</option>${templates.map(a=>`<option value="${a.id}">${esc(documentText(a))}</option>`).join("")}</select></label>`,buttons:[{action:"next",label:tr("Configurar"),callback:(_e,b)=>({id:b.form.elements.template.value})},{action:"cancel",label:tr("Cancelar"),callback:()=>null}]});
    if(!chosen)return;
    const source=chosen.id?templates.find(a=>a.id===chosen.id).toObject():{name:tr("Robot"),type:"robot",system:{},items:[]};
    if(source.system.robot?.requiresVehicleSystem){ui.notifications.info(tr("El Roboavión físico se crea como Vehículo; sus programas representan el cerebro electrónico."));return await createVehicleDialog();}
    delete source._id;delete source.folder;delete source._stats;source.ownership={default:0};source.prototypeToken={name:source.name,actorLink:false};
    const entries=await ItemCatalog.entries();
    const content=await foundry.applications.handlebars.renderTemplate("systems/paranoia-2-edition/templates/robots/create.hbs",{name:documentText(source),model:documentText(source,"system.robot.model"),capacity:source.system.robot?.memory?.capacity,
      existing:documentView(source,"items").map(i=>i.name),skills:ITEM_SKILLS,items:entries.map(i=>({uuid:i.uuid,name:documentText(i)})),slots:[0,1,2]});
    let pending;
    return await foundry.applications.api.DialogV2.wait({window:{title:tr("Configurar robot")},position:{width:600},classes:["p2-robot-dialog"],content,buttons:[{action:"create",label:tr("Crear Robot"),callback:(_e,b)=>pending??=(async()=>{
      const f=b.form.elements;source.name=preserveTranslatedFields(source,{name:f.name.value.trim()}).name||source.name;source.prototypeToken.name=source.name;source.system.robot??={};
      source.system.robot.model=f.model.value;source.system.robot.memory={capacity:f.capacity.value.trim()?Number(f.capacity.value):null};
      const originalUsed=programSummary(source.items,null).used;
      for(let n=0;n<3;n++){if(!f[`skill${n}`].value)continue;source.items.push({name:`${ITEM_SKILLS.find(s=>s.key===f[`skill${n}`].value).label} ${f[`level${n}`].value}`,type:"robotProgram",system:{skill:f[`skill${n}`].value,level:Number(f[`level${n}`].value),active:true,storageMode:f[`card${n}`].checked?"card":"resident"}});}
      let chassisEquipped=false;
      for(const opt of f.catalog.selectedOptions){const doc=entries.find(i=>i.uuid===opt.value);const item=doc.toObject();delete item._id;delete item.folder;
        if(item.type==="weapon")item.system.integrated=f.integrateWeapons.checked;
        if(item.type==="armor"&&f.chassis.checked){item.system.integrated=true;item.system.equipped=!chassisEquipped;chassisEquipped=true;}
        source.items.push(item);
      }
      if(f.peripheral.value.trim())source.items.push({name:f.peripheral.value.trim(),type:"robotPeripheral",system:{description:f.peripheral.value.trim()}});
      validateMemory(source.items,source.system.robot.memory.capacity,{previousUsed:source.system.robot.memory.capacity==null?originalUsed:0});
      for(const item of source.items)item._id=foundry.utils.randomID();
      const actor=await foundry.documents.Actor.create(source);if(actor)await actor.sheet.render(true);return actor;
    })().catch(e=>{ui.notifications.error(e.message);})},{action:"cancel",label:tr("Cancelar"),callback:()=>null}]});
  }finally{open=false;}
}
