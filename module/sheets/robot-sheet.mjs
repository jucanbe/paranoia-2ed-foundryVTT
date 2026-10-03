import {documentText,documentView,preserveTranslatedFields} from "../i18n/documents.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import {ROBOT_STATES,ROBOT_TYPES,ASIMOV,FIVE_LAWS,peripheralWarnings} from "../robots/rules.mjs";
import {ITEM_CLEARANCES,ITEM_LABELS,skillLabel,armorCode} from "../items/config.mjs";
import {sheetCheck} from "../rolls/dialogs.mjs";
import {createItem,editItem,deleteItem} from "./item-actions.mjs";
import {toggleArmor} from "../health/dialogs.mjs";
import {openDamageDialog} from "../damage/dialogs.mjs";
import {recoverStun} from "../health/service.mjs";
import {repairDialog,swapDialog} from "../robots/dialogs.mjs";
import {finishCardSwap,cancelCardSwap} from "../robots/service.mjs";
import {declarationDialog,attackDialog} from "../combat/dialogs.mjs";
import {createRobotDialog} from "../robots/creator.mjs";
import {proposeFine} from "../credits/dialogs.mjs";
async function robotAction(_event,button){
  const a=this.actor;button.disabled=true;
  try{
    if(!game.user.isGM)return;
    const action=button.dataset.robotAction;
    if(action==="program"){const item=a.items.get(button.closest('[data-item-id]').dataset.itemId);await item.update({"system.active":!item.system.active});}
    if(action==="repair")await repairDialog(a);
    if(action==="damage")await openDamageDialog(a);
    if(action==="stun")await recoverStun(a);
    if(action==="swap")await swapDialog(a);
    if(action==="finishSwap")await finishCardSwap(a);
    if(action==="cancelSwap")await cancelCardSwap(a);
    if(action==="create")await createRobotDialog();
    if(["declare","attack"].includes(action)){const c=game.combat?.combatants.find(c=>c.actor?.uuid===a.uuid);if(!c)throw Error(tr("Añade el robot al encuentro activo."));await(action==="declare"?declarationDialog:attackDialog)(game.combat,c);}
  }catch(e){ui.notifications.error(e.message);}finally{button.disabled=false;}
}
export class RobotSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2){
  static DEFAULT_OPTIONS={classes:["paranoia-sheet","paranoia-robot"],position:{width:860,height:820},window:{resizable:true},form:{submitOnChange:true,closeOnSubmit:false},actions:{proposeFine,robotAction,rollCheck:sheetCheck,createItem,editItem,deleteItem,toggleArmor}};
  static PARTS={body:{template:"systems/paranoia-2-edition/templates/robots/sheet.hbs",scrollable:[".p2-scroll"]}};
  get isEditable(){return game.user.isGM&&super.isEditable;}
  _canDragStart(){return this.isEditable;}_canDragDrop(){return this.isEditable;}
  get title(){return documentText(this.actor);}
  _processFormData(event,form,formData){return preserveTranslatedFields(this.actor,super._processFormData(event,form,formData));}
  async _prepareContext(options){
    await super._prepareContext(options);const s=this.actor.system,r=documentView(this.actor,"system.robot"),gm=game.user.isGM;
    const fields=(list)=>list.map(([path,label,kind="text",choices])=>{const value=documentText(this.actor,`system.${path}`,foundry.utils.getProperty(s,path));return {path:`system.${path}`,label,value,number:kind==="number",check:kind==="check",area:kind==="area",choices:choices?Object.entries(choices).map(([key,label])=>({key,label,selected:key===value})):null};});
    return {name:documentText(this.actor),model:documentText(this.actor,"system.robot.model"),typeLabel:ROBOT_TYPES[r.type]??r.type,state:ROBOT_STATES[s.health.status],gm,editable:this.isEditable,
      inventory:["weapon","armor","equipment"].map(type=>({type,label:{weapon:tr("Armas"),armor:tr("Chasis / armadura"),equipment:tr("Equipo")}[type],items:this.actor.items.filter(i=>i.type===type).map(i=>({id:i.id,name:documentText(i),armor:type==="armor",integrated:i.system.integrated,equipped:i.system.equipped,summary:type==="armor"?armorCode(i.system.protectionType,i.system.protectionValue):type==="weapon"?trHTML`${skillLabel(i.system.skill)} · ND ${i.system.damageNumber??"—"}`:""}))})),
      internal:gm?{memory:r.memory,warnings:peripheralWarnings(this.actor),laws:FIVE_LAWS,swap:r.cardSwap,asimov:ASIMOV[r.asimovStatus],erratic:r.erratic,
        damaged:s.health.status==="lightDamage",salvage:s.health.status==="destroyed",vaporized:s.health.status==="vaporized",repairable:["lightDamage","seriousDamage"].includes(s.health.status),shortCircuit:s.health.stunned||s.health.status==="shortCircuit",
        skills:Object.entries(s.skills).flatMap(([group,skills])=>Object.entries(skills).map(([key,v])=>({key:`${group}.${key}`,label:skillLabel(`${group}.${key}`),value:v.value}))),
        programs:this.actor.items.filter(i=>i.type==="robotProgram").map(i=>({id:i.id,name:documentText(i),skill:skillLabel(i.system.skill),level:i.system.level,mode:i.system.storageMode==="card"?tr("Tarjeta"):tr("Residente"),active:i.system.active})),
        peripherals:this.actor.items.filter(i=>i.type==="robotPeripheral").map(i=>({id:i.id,name:documentText(i),description:documentText(i,"system.description"),operational:i.system.operational})),
        fields:fields([["robot.type",tr("Tipo"),"text",{...ROBOT_TYPES,...(!Object.hasOwn(ROBOT_TYPES,r.type)?{[r.type]:r.type}:{})}],["robot.model",tr("Modelo")],["robot.serial",tr("Número de serie")],["robot.designation",tr("Designación")],["robot.description",tr("Descripción"),"area"],
          ["health.status",tr("Estado (corrección del DJ)"),"text",ROBOT_STATES],["robot.ucp.model",tr("Modelo UCP")],["robot.ucp.status",tr("Estado UCP"),"text",{operational:tr("Operativa"),damaged:tr("Dañada"),removed:tr("Extraída"),destroyed:tr("Destruida")}],["robot.ucp.notes",tr("Notas UCP"),"area"],
          ["robot.memory.capacity",tr("Capacidad de memoria (vacío: desconocida)"),"number"],["robot.asimovStatus",tr("Circuitos de Asimov"),"text",ASIMOV],["robot.minimumCommandClearance",tr("Nivel mínimo para obedecer (no es nivel del robot)"),"text",{"":tr("Sin restricción"),...Object.fromEntries(ITEM_CLEARANCES.map(k=>[k,ITEM_LABELS.clearances[k]]))}],
          ["robot.authorizedOperatorActorId",tr("Operador autorizado"),"text",{"":tr("Ninguno"),...Object.fromEntries(game.actors.map(a=>[a.id,a.name]))}],["robot.secondaryOperatorActorId",tr("Operador sucesor"),"text",{"":tr("Ninguno"),...Object.fromEntries(game.actors.map(a=>[a.id,a.name]))}],
          ["robot.movement.mode",tr("Locomoción")],["robot.movement.metersPerTurn",tr("Metros por turno (vacío: desconocido)"),"number"],["robot.requiresVehicleSystem",tr("Requiere sistema de Vehículos"),"check"],["robot.erratic",tr("Comportamiento errático"),"check"],["robot.erraticNotes",tr("Notas de comportamiento"),"area"],["robot.damagedPeripherals",tr("Periféricos dañados"),"area"],["robot.salvageNotes",tr("Salvamento: UCP / tarjetas / piezas (decisión del DJ)"),"area"],["robot.notes",tr("Notas del DJ"),"area"]])}:null};
  }
}
