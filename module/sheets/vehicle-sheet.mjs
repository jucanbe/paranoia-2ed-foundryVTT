import {staticMarkup} from "../i18n/index.mjs";
import {documentText,documentView,preserveTranslatedFields} from "../i18n/documents.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import {VEHICLE_FIELDS,ROW_FIELDS,ROW_PATHS,VEHICLE_CATEGORIES,VEHICLE_STATES} from "../vehicles/fields.mjs";
import {CONTROL_MODES,CREW_ROLES,SYSTEM_STATES,movementSummary,capacityWarning,currentMovement} from "../vehicles/rules.mjs";
import {fieldsDialog,fieldHTML} from "../vehicles/ui.mjs";
import {occupants,vehicleGM} from "../vehicles/service.mjs";
import {maneuverDialog,repairDialog,accidentDialog} from "../vehicles/dialogs.mjs";
import {createVehicleDialog} from "../vehicles/creator.mjs";
import {createItem,editItem,deleteItem} from "./item-actions.mjs";
import {toggleArmor} from "../health/dialogs.mjs";
import {openDamageDialog} from "../damage/dialogs.mjs";
import {declarationDialog,attackDialog} from "../combat/dialogs.mjs";
import {armorCode,skillLabel,ITEM_LABELS} from "../items/config.mjs";
import {sheetCheck} from "../rolls/dialogs.mjs";
import {proposeFine} from "../credits/dialogs.mjs";
async function vehicleAction(_event,button){
  button.disabled=true;try{
    const a=this.actor;vehicleGM(a);const action=button.dataset.vehicleAction;
    if(action==="create")return await createVehicleDialog();
    if(action==="maneuver")return await maneuverDialog(a);
    if(action==="repair")return await repairDialog(a);
    if(action==="accident")return await accidentDialog(a);
    if(action==="damage")return await openDamageDialog(a);
    if(action==="smoke")return await a.update({"system.vehicle.defense.smokeActive":!a.system.vehicle.defense.smokeActive});
    if(action==="program"){const item=a.items.get(button.closest("[data-item-id]").dataset.itemId);return await item.update({"system.active":!item.system.active});}
    if(["declare","attack"].includes(action)){const c=game.combat?.combatants.find(c=>c.actor?.uuid===a.uuid);if(!c)throw Error(tr("Añade el vehículo al encuentro activo."));return await(action==="declare"?declarationDialog:attackDialog)(game.combat,c);}
    if(["row","removeRow"].includes(action)){
      const type=button.dataset.rowType,path=ROW_PATHS[type];if(!path)throw Error(tr("Sección no válida."));const rows=foundry.utils.deepClone(foundry.utils.getProperty(a.system.vehicle,path)),index=button.dataset.index==null?null:Number(button.dataset.index);
      if(action==="removeRow"){if(!await foundry.applications.api.DialogV2.confirm({window:{title:tr("Eliminar entrada")},content:staticMarkup("<p>¿Eliminar esta referencia / entrada?</p>")}))return;rows.splice(index,1);}
      else{const result=await fieldsDialog(tr("Editar entrada de vehículo"),ROW_FIELDS[type],index==null?{hiddenFromPlayers:true}:rows[index]);if(!result)return;if(type==="modes"&&(!result.values.key.trim()||rows.some((r,i)=>i!==index&&r.key===result.values.key)))throw Error(tr("Usa una clave de movimiento no vacía y única."));if(index==null)rows.push(result.values);else rows[index]=result.values;}
      await a.update({[`system.vehicle.${path}`]:rows});
    }
  }catch(e){ui.notifications.error(e.message);}finally{button.disabled=false;}
}
export class VehicleSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2){
  static DEFAULT_OPTIONS={classes:["paranoia-sheet","paranoia-vehicle"],position:{width:900,height:850},window:{resizable:true},form:{submitOnChange:true,closeOnSubmit:false},actions:{proposeFine,vehicleAction,createItem,editItem,deleteItem,toggleArmor,rollCheck:sheetCheck}};
  static PARTS={body:{template:"systems/paranoia-2-edition/templates/vehicles/sheet.hbs",scrollable:[".p2-scroll"]}};
  get isEditable(){return game.user.isGM&&super.isEditable;}
  _canDragStart(){return this.isEditable;}_canDragDrop(){return this.isEditable;}
  async _onDropActor(_event,actor){
    if(!this.isEditable)return;if(!actor||actor.uuid===this.actor.uuid)return;
    await this.actor.update({"system.vehicle.crew":[...this.actor.system.toObject().vehicle.crew,{actorUuid:actor.uuid,role:"passenger",notes:""}]});
  }
  async _onDropDocument(event,document){
    if(document.documentName==="Token")return this._onDropActor(event,document.actor);
    return super._onDropDocument(event,document);
  }
  get title(){return documentText(this.actor);}
  _processFormData(event,form,formData){return preserveTranslatedFields(this.actor,super._processFormData(event,form,formData));}
  async _prepareContext(options){
    await super._prepareContext(options);const a=this.actor,v=documentView(a,"system.vehicle"),gm=game.user.isGM,crew=await occupants(a);
    return {expanded:this.element?.querySelector("details")?.open??false,name:documentText(a),model:documentText(a,"system.vehicle.model"),category:VEHICLE_CATEGORIES[v.category]??v.category,gm,state:VEHICLE_STATES[a.system.health.status],control:CONTROL_MODES[v.control.currentMode],movement:movementSummary(v),capacity:currentMovement(v)?.capacity??v.capacity??"—",clearance:ITEM_LABELS.clearances[v.requiredClearance]??tr("Sin especificar"),crewSummary:crew.filter(c=>c.actor&&c.role!=="passenger").map(c=>`${CREW_ROLES[c.role]}: ${c.actor.name}`).join(" · "),capacityWarning:capacityWarning(v),smoke:v.defense.smokeActive,notes:v.notes,
      accidentPending:gm&&v.accidentPending,
      inventory:["weapon","armor","equipment"].map(type=>({type,label:{weapon:tr("Armamento"),armor:tr("Armadura integrada"),equipment:tr("Defensas / equipo")}[type],items:a.items.filter(i=>i.type===type).map(i=>({id:i.id,name:documentText(i),armor:type==="armor",equipped:i.system.equipped,integrated:i.system.integrated,summary:type==="armor"?armorCode(i.system.protectionType,i.system.protectionValue):type==="weapon"?trHTML`${skillLabel(i.system.skill)||tr("Habilidad sin configurar")} · ND ${i.system.damageNumber??"—"} · Cargas ${i.system.charges.value??"—"}/${i.system.charges.max??"—"}`:documentText(i,"system.description")}))})),
      rows:[{type:"crew",label:tr("Tripulación / pasajeros"),entries:crew.map(c=>({index:c.index,name:c.actor?.name??tr("Referencia no disponible"),summary:`${CREW_ROLES[c.role]} · ${c.notes}`}))},
        {type:"modes",label:tr("Modos de movimiento"),entries:v.movement.modes.map((m,index)=>({index,name:m.label||m.key,summary:`${m.maxSpeed??"—"} ${m.unit} · ${m.terrain} · ${m.notes}`}))},
        {type:"systems",label:tr("Sistemas / averías"),entries:v.systems.map((s,index)=>({index,name:s.name,summary:`${SYSTEM_STATES[s.status]} · ${s.notes}`}))},
        {type:"flaws",label:tr("Defectos"),entries:v.flaws.map((f,index)=>({...f,index})).filter(f=>gm||!f.hiddenFromPlayers).map(f=>({index:f.index,name:f.name,summary:gm?`${f.description} · ${f.gmNotes}`:f.description}))}],
      internal:gm?{memory:v.electronicBrain.memory,programs:a.items.filter(i=>i.type==="robotProgram").map(i=>({id:i.id,name:documentText(i),active:i.system.active,level:i.system.level})),skills:Object.entries(a.system.skills).flatMap(([g,skills])=>Object.entries(skills).map(([k,v])=>({key:`${g}.${k}`,label:skillLabel(`${g}.${k}`),value:v.value}))),
        sections:VEHICLE_FIELDS.map(section=>({label:section.label,html:section.fields.map(spec=>fieldHTML([`system.vehicle.${spec[0]}`,spec[1],spec[2]??"text",spec[0]==="movement.currentMode"?{"":tr("Sin seleccionar"),...Object.fromEntries(v.movement.modes.map(m=>[m.key,m.label||m.key]))}:spec[3]],documentText(a,`system.vehicle.${spec[0]}`,foundry.utils.getProperty(v,spec[0])))).join("")})),
        stateHTML:fieldHTML(["system.health.status",tr("Estado (corrección del DJ)"),"text",VEHICLE_STATES],a.system.health.status)}:null};
  }
}
