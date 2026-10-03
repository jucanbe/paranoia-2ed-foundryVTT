import {staticMarkup} from "../i18n/index.mjs";
import {documentText,documentView,preserveTranslatedFields} from "../i18n/documents.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import {fieldsDialog,escape} from "./ui.mjs";
import {VEHICLE_CATEGORIES,CLEARANCES,SKILLS} from "./fields.mjs";
import {ItemCatalog} from "../items/catalog.mjs";
let open=false;
export async function createVehicleDialog(){
  if(!game.user.isGM||open)return;open=true;
  try{
    const templates=await game.packs.get("paranoia-2-edition.vehicles").getDocuments();
    const first=await fieldsDialog(tr("Crear vehículo"),[["template",tr("Plantilla"),"text",{"":tr("Diseño personalizado"),...Object.fromEntries(templates.map(a=>[a.id,documentText(a)]))}]],{}, {confirm:tr("Diseñar")});if(!first)return;
    const source=first.values.template?templates.find(a=>a.id===first.values.template).toObject():new CONFIG.Actor.documentClass({name:tr("Vehículo"),type:"vehicle"}).toObject();
    delete source._id;delete source.folder;delete source._stats;source.ownership={default:0};
    const items=await ItemCatalog.entries(),choices=type=>Object.fromEntries(items.filter(i=>i.type===type).map(i=>[i.uuid,documentText(i)]));
    const specs=[
      [tr("Movimiento"),[["movement.description",tr("Método de locomoción (libre)"),"area"],["category",tr("Categoría"),"text",{...VEHICLE_CATEGORIES,...(!Object.hasOwn(VEHICLE_CATEGORIES,source.system.vehicle.category)?{[source.system.vehicle.category]:source.system.vehicle.category||tr("Sin especificar")}:{})}]]],
      [tr("Diseño"),[["name",tr("Nombre")],["model",tr("Modelo")],["design",tr("Apariencia"),"area"],["description",tr("Descripción"),"area"],["requiredClearance",tr("Nivel de acceso"),"text",CLEARANCES]]],
      [tr("Capacidad"),[["capacity",tr("Plazas normales (vacío: desconocidas)"),"number"],["temporaryPassengerCapacity",tr("Plazas de misión"),"number"]]],
      [tr("Propósito"),[["purpose",tr("Propósito"),"area"],["assigned",tr("Asignado"),"check"],["assignedTo",tr("Asignado a")],["assignmentNotes",tr("Misión"),"area"]]],
      [tr("Control y cerebro"),[["control.manualAvailable",tr("Manual"),"check"],["control.autopilotAvailable",tr("Piloto automático"),"check"],["control.electronicBrainAvailable",tr("Cerebro electrónico"),"check"],["control.currentMode",tr("Modo inicial"),"text",{manual:tr("Manual"),autopilot:tr("Piloto automático"),electronicBrain:tr("Cerebro electrónico")}],["handlingSkill",tr("Habilidad manual"),"text",SKILLS],["electronicBrain.name",tr("Cerebro: nombre")],["electronicBrain.personality",tr("Personalidad"),"area"]]],
      [tr("Armamento"),[["weapons",tr("Añadir armas del catálogo (selección múltiple)"),"multi",choices("weapon")]]],
      [tr("Armadura y sistemas"),[["armor",tr("Añadir armadura integrada"),"text",{"":tr("Conservar plantilla / ninguna"),...choices("armor")}],["equipment",tr("Añadir equipo defensivo / sistemas"),"multi",choices("equipment")]]],
      [tr("Programas"),[["electronicBrain.memory.capacity",tr("Capacidad de memoria (vacío: desconocida)"),"number"],["programSkill",tr("Programa adicional"),"text",SKILLS],["programLevel",tr("Nivel / sectores del programa"),"number"],["electronicBrain.programmingNotes",tr("Programación"),"area"]]],
      [tr("Defectos"),[["flawName",tr("Defecto adicional")],["flawDescription",tr("Descripción del defecto"),"area"],["flawHidden",tr("Oculto a jugadores"),"check"]]],
      [tr("Sorpresas"),[["specialSurprises",tr("Sorpresas (DJ)"),"area"],["gmNotes",tr("Notas privadas"),"area"]]]
    ];
    const values={name:documentText(source),flawHidden:true};for(const [,fields] of specs)for(const [key] of fields)values[key]??=documentText(source,`system.vehicle.${key}`,foundry.utils.getProperty(source.system.vehicle,key));
    let step=0;
    while(step<=specs.length){
      const review=step===specs.length;
      const result=await fieldsDialog(review?tr("Revisar vehículo"):`${step+1} / ${specs.length} · ${specs[step][0]}`,review?[]:specs[step][1],values,{back:step>0,confirm:review?tr("Crear vehículo"):tr("Siguiente"),intro:review?trHTML`<p><strong>${escape(values.name)}</strong> · ${escape(values.model)}</p><p>Capacidad: ${escape(values.capacity??tr("sin especificar"))}. Control: ${escape(values["control.currentMode"])}</p><p>Items de plantilla: ${documentView(source,"items").map(i=>escape(i.name)).join(", ")||"ninguno"}</p><p>Armas añadidas: ${(values.weapons??[]).length}. Equipo: ${(values.equipment??[]).length}. Los datos permanecen locales hasta confirmar.</p>`:staticMarkup("<p>Diseño del DJ. Campos numéricos vacíos: desconocidos. Modos, tripulación y sistemas se amplían en la ficha.</p>")});
      if(!result)return;Object.assign(values,result.values);if(result.back){step--;continue;}if(!review){step++;continue;}
      const submission={name:values.name,system:{vehicle:{}}};
      for(const [key,value]of Object.entries(values))if(key.includes(".")||Object.hasOwn(source.system.vehicle,key))foundry.utils.setProperty(submission.system.vehicle,key,value);
      preserveTranslatedFields(source,submission);
      source.name=submission.name.trim()||tr("Vehículo");
      for(const [key,value] of Object.entries(values))if(key.includes(".")||Object.hasOwn(source.system.vehicle,key))foundry.utils.setProperty(source.system.vehicle,key,foundry.utils.getProperty(submission.system.vehicle,key));
      for(const uuid of [...(values.weapons??[]),...(values.armor?[values.armor]:[]),...(values.equipment??[])]){const entry=items.find(i=>i.uuid===uuid);if(!entry)throw Error(tr("El catálogo cambió; no se ha creado el vehículo."));const item=entry.toObject();delete item._id;delete item.folder;item.system.integrated=true;if(item.type==="armor"){source.items.filter(i=>i.type==="armor").forEach(i=>i.system.equipped=false);item.system.equipped=true;}source.items.push(item);}
      if(values.programSkill)source.items.push({name:SKILLS[values.programSkill],type:"robotProgram",system:{skill:values.programSkill,level:values.programLevel,active:true,storageMode:"resident"}});
      if(values.flawName)source.system.vehicle.flaws.push({name:values.flawName,description:values.flawDescription,hiddenFromPlayers:values.flawHidden,gmNotes:""});
      for(const item of source.items)item._id=foundry.utils.randomID();source.prototypeToken={name:source.name,actorLink:false};
      const actor=await CONFIG.Actor.documentClass.create(source);if(actor)await actor.sheet.render(true);return actor;
    }
  }finally{open=false;}
}
