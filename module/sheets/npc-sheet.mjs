import {documentText} from "../i18n/documents.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import {LABELS} from "./labels.mjs";
import {CLEARANCE_CODES} from "../actors/identity.mjs";
import {NPC_ROLES} from "../npc/config.mjs";
import {openNPCGenerator} from "../npc/generator-dialog.mjs";
import {duplicateNPC} from "../npc/service.mjs";
import {createItem,editItem,deleteItem,changeQuantity} from "./item-actions.mjs";
import {WEAPON_CATEGORIES,skillLabel,armorCode} from "../items/config.mjs";
import {capabilityRows} from "./capabilities.mjs";
import {sheetCheck,sheetDuel} from "../rolls/dialogs.mjs";
import {healthAction} from "../health/dialogs.mjs";
import {healthView} from "../health/service.mjs";
import {powerAction,powerView} from "../powers/dialogs.mjs";
import {POWER_REGISTRY} from "../powers/registry.mjs";
import {activateClone} from "../clones/dialog.mjs";
import {isTerminal} from "../clones/rules.mjs";
import {declarationDialog,attackDialog} from "../combat/dialogs.mjs";
import {treasonAction,panelHTML} from "../treason/dialogs.mjs";
import {societyAction,panel as societyPanel} from "../societies/dialogs.mjs";
import {clearanceAction,panel as clearancePanel} from "../clearance/dialogs.mjs";
import {clearanceIndex} from "../clearance/rules.mjs";
import {developmentAction,panel as developmentPanel} from "../development/dialogs.mjs";
import {creditAction,panel as creditPanel} from "../credits/dialogs.mjs";

async function combatAction(event,target){
  if(!game.user.isGM)return;
  const combat=game.combat,participants=combat?.combatants.filter(c=>c.actor?.uuid===this.actor.uuid)??[];
  if(participants.length!==1)return ui.notifications.warn(tr("Abre el PNJ del Token correspondiente en el encuentro activo."));
  try{await (target.dataset.combatAction==="attack"?attackDialog:declarationDialog)(combat,participants[0]);}
  catch(error){ui.notifications.warn(error.message);}
}
async function equipArmor(event,target){
  if(!this.isEditable)return;
  const item=this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);if(item?.type!=="armor")return;
  const equip=!item.system.equipped;
  await this.actor.updateEmbeddedDocuments("Item",this.actor.items.filter(i=>i.type==="armor").map(i=>({_id:i.id,"system.equipped":equip&&i.id===item.id})));
}
const choices=(map,value)=>Object.entries(map).map(([key,label])=>({key,label,selected:key===value}));

/** A separate compact view over the shared Citizen schema and rule services. */
export class NPCSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2){
  static DEFAULT_OPTIONS={classes:["paranoia-sheet","paranoia-npc"],position:{width:860,height:820},window:{resizable:true},
    form:{submitOnChange:true,closeOnSubmit:false},actions:{creditAction,developmentAction,clearanceAction,societyAction,treasonAction,createItem,editItem,deleteItem,changeQuantity,rollCheck:sheetCheck,attributeDuel:sheetDuel,healthAction,powerAction,activateClone,equipArmor,combatAction,
      generateNPC:openNPCGenerator,
      duplicateNPC:async function(){if(this.isEditable)(await duplicateNPC(this.actor)).sheet.render(true);},
      toggleSkills:async function(){this.showAllSkills=!this.showAllSkills;await this.render();}}};
  static PARTS={body:{template:"systems/paranoia-2-edition/templates/npc/sheet.hbs",scrollable:[".p2-scroll"]}};
  get isEditable(){return game.user.isGM&&super.isEditable;}
  _canDragStart(){return this.isEditable;}
  _canDragDrop(){return this.isEditable;}
  async _prepareContext(options){
    await super._prepareContext(options);
    const s=this.actor.system,isGM=game.user.isGM;
    const attributes=Object.entries(s.attributes).filter(([key])=>key!=="mutantPower").map(([key,data])=>({key,label:LABELS.attributeNames[key],value:data.value}));
    const skillGroups=Object.entries(s.skills).map(([group,skills])=>({label:LABELS.attributeNames[group],skills:Object.entries(skills)
      .filter(([,data])=>this.showAllSkills||data.value!==0).sort((a,b)=>b[1].value-a[1].value)
      .map(([key,data])=>({key:`${group}.${key}`,label:LABELS.skillNames[group][key],value:data.value}))}));
    const inventory=["weapon","armor","equipment"].map(type=>({type,label:{weapon:tr("Armas"),armor:tr("Armadura"),equipment:tr("Equipo")}[type],items:this.actor.items.filter(i=>i.type===type).sort((a,b)=>a.sort-b.sort).map(i=>({
      id:i.id,name:documentText(i),quantity:i.system.quantity,experimental:i.system.experimental,assigned:i.system.assigned,equipped:i.system.equipped,isArmor:type==="armor",unauthorized:clearanceIndex(i.system.securityClearance)>clearanceIndex(s.securityClearance),
      summary:type==="weapon"?trHTML`${WEAPON_CATEGORIES[i.system.weaponCategory]?.code??i.system.weaponType??"—"} · ${skillLabel(i.system.skill)} · ND ${i.system.damageNumber??"—"} · ${i.system.range??"—"}`:type==="armor"?armorCode(i.system.protectionType,i.system.protectionValue):""}))}));
    // Never serialize the complete Actor/system into a public sheet context.
    return {name:this.actor.name,clearancePanel:isGM?clearancePanel(this.actor):"",clearanceLabel:LABELS.clearances[s.securityClearance],treasonPanel:panelHTML(this.actor),societyPanel:await societyPanel(this.actor),editable:this.isEditable,isGM,identity:{...s.identity,cloneNumber:s.cloneNumber,service:s.service},
      clearances:choices(Object.fromEntries(Object.keys(CLEARANCE_CODES).map(k=>[k,LABELS.clearances[k]])),s.securityClearance),attributes,skillGroups,showAllSkills:this.showAllSkills,
      capabilities:capabilityRows(s),developmentPanel:isGM?developmentPanel(this.actor):"",combatCapacities:capabilityRows(s).slice(1,3),health:healthView(this.actor),inventory,
      activeWeapon:this.actor.items.get(s.npc.activeWeaponId)?.name??tr("Sin arma activa"),
      equippedArmor:this.actor.items.filter(i=>i.type==="armor"&&i.system.equipped).map(i=>`${i.name} (${armorCode(i.system.protectionType,i.system.protectionValue)})`).join(", ")||tr("Sin armadura equipada"),
      secret:isGM?{...s.npc,creditPanel:creditPanel(this.actor),roles:choices(NPC_ROLES,s.npc.role),credits:s.credits,coverService:s.coverService,privateNotes:s.privateNotes,
        power:s.mutantPower,powerScore:s.attributes.mutantPower.value,powerView:powerView(this.actor),
        powers:choices(Object.fromEntries(Object.entries(POWER_REGISTRY).map(([k,p])=>[k,p.label])),s.mutantPower.key),
        weapons:this.actor.items.filter(i=>i.type==="weapon").map(i=>({key:i.id,label:i.name,selected:i.id===s.npc.activeWeaponId})),
        nextClone:s.identity.useCitizenId&&isTerminal(s.health)}:null};
  }
}
