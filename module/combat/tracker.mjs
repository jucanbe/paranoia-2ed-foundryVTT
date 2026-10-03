import {staticMarkup} from "../i18n/index.mjs";
import {trHTML,tr} from "../i18n/index.mjs";
import {SYSTEM_ID as NS,PHASES,ACTIONS,MOVEMENT} from "./config.mjs";
import {stateOf,declarationOf,attackState,canDeclare,snapshotOf,movementState} from "./state.mjs";
import {requestCombat} from "./requests.mjs";
import {declarationDialog,attackDialog} from "./dialogs.mjs";
import {HEALTH_STATES,blockedReason} from "../health/rules.mjs";
import {effectivePowerHealth} from "../powers/rules.mjs";
import {VEHICLE_STATES,movementSummary} from "../vehicles/rules.mjs";
import {ROBOT_STATES} from "../robots/rules.mjs";
import {allAttacksResolved} from "../robots/combat.mjs";

import {enabled} from "./optional/settings.mjs";
import {specialActions} from "./optional/runtime.mjs";
import {surpriseDialog} from "./optional/ui.mjs";
const action=async function(event,button){
  event.stopPropagation();button.disabled=true;
  try{
    const combat=this.viewed,c=combat.combatants.get(button.closest('[data-combatant-id]')?.dataset.combatantId);
    const operation=button.dataset.operation;
    if(operation==="setReady"){const content=trHTML`<label>Arma preparada antes del combate<select name="weaponId"><option value="">Ninguna</option>${c.actor.items.filter(w=>w.type==="weapon").map(w=>`<option value="${w.id}">${foundry.utils.escapeHTML(w.name)}</option>`).join("")}</select></label>`;const choice=await foundry.applications.api.DialogV2.wait({window:{title:tr("Preparar arma · DJ")},content,buttons:[{action:"apply",label:tr("Preparar"),callback:(_e,b)=>({id:b.form.elements.weaponId.value})},{action:"cancel",label:tr("Cancelar")}]});if(choice?.id!==undefined)await requestCombat(combat,"setReady",{weaponIds:choice.id?[choice.id]:[]},c.id);}
    else if(operation==="surprise")await surpriseDialog(combat,requestCombat);
    else if(operation==="handlingOverride")await requestCombat(combat,"handling",{override:true},c.id);
    else if(operation==="handling")await requestCombat(combat,"handling",{},c.id);
    else if(operation==="declare")await declarationDialog(combat,c);
    else if(operation==="attack")await attackDialog(combat,c);
    else if(operation==="markAttack"){
      if(await foundry.applications.api.DialogV2.confirm({window:{title:tr("Resolución manual del DJ")},content:staticMarkup("<p>¿Marcar el ataque como resuelto sin tirar ni aplicar daño automático?</p>"),yes:{label:tr("Marcar resuelto")},no:{label:tr("Cancelar")}}))await requestCombat(combat,operation,{},c.id);
    }else if(operation==="release"){
      if(await foundry.applications.api.DialogV2.confirm({window:{title:tr("Autorizar otro ataque")},content:staticMarkup("<p>Comprueba el chat antes de eliminar el bloqueo de ataque. ¿Continuar?</p>"),yes:{label:tr("Continuar")},no:{label:tr("Cancelar")}}))await requestCombat(combat,operation,{},c.id);
    }else if(operation==="movement")await requestCombat(combat,operation,{},c.id);
    else await requestCombat(combat,operation);
  }catch(error){ui.notifications.error(error.message);}finally{button.disabled=false;}
};
export class PhaseCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
  static DEFAULT_OPTIONS={actions:{phaseAction:action}};
  static PARTS={
    header:{template:"templates/sidebar/tabs/combat/header.hbs"},
    tracker:{template:`systems/${NS}/templates/combat/tracker.hbs`,scrollable:[""]},
    footer:{template:`systems/${NS}/templates/combat/footer.hbs`}
  };
  async _preparePartContext(part,context,options){
    context=await super._preparePartContext(part,context,options);
    const combat=this.viewed;if(!combat)return context;
    const state=stateOf(combat);
    context.phaseLabel=state.phase==="surpriseResolution"?tr("Turno de Sorpresa"):PHASES[state.phase];context.canSurprise=enabled("surprise")&&!combat.round;context.unlocked=state.unlocked;context.round=combat.round;
    if(part==="tracker")context.turns=context.turns.map(row=>{
      const c=combat.combatants.get(row.id),d=declarationOf(combat,c)??snapshotOf(combat,c),attack=attackState(combat,c);
      const resolved=allAttacksResolved(attack,d),pending=attack?.pending||Object.values(attack?.weapons??{}).some(a=>a.pending);
      return {...row,canReady:enabled("weaponHandling")&&game.user.isGM&&!combat.round,readyLabel:enabled("weaponHandling")?c.actor?.items.filter(w=>w.type==="weapon").map(w=>`${w.name}: ${w.system.integrated||c.getFlag(NS,"weaponReady")?.includes(w.id)?tr("Preparada"):tr("Enfundada")}`).join(" · "):"",healthLabel:(c.actor?.type==="vehicle"?VEHICLE_STATES:c.actor?.type==="robot"?ROBOT_STATES:HEALTH_STATES)[c.actor?.system.health?.status],css:row.css.replace(/\bactive\b/g,""),declaration:d?.text,actionLabel:d?.burst?tr("RÁFAGA"):({...ACTIONS,...specialActions()})[d?.action],weaponProgressLabel:c.getFlag(NS,"weaponProgress")&&enabled(c.getFlag(NS,"weaponProgress").operation==="reload"?"ammunition":"weaponHandling")?`${c.getFlag(NS,"weaponProgress").operation==="reload"?tr("Recarga"):tr("Acceso al arma")}: ${c.getFlag(NS,"weaponProgress").done}/${c.getFlag(NS,"weaponProgress").required} turnos`:"",canHandle:c.actor?.isOwner&&["resolution","surpriseResolution"].includes(state.phase)&&Object.hasOwn(specialActions(),d?.action??"")&&c.getFlag(NS,"otherAction")?.round!==combat.round,
        movement:c.actor?.type==="vehicle"?movementSummary(c.actor.system.vehicle):c.actor?.type==="robot"?`${c.actor.system.robot.movement.mode||tr("Locomoción")} · ${c.actor.system.robot.movement.metersPerTurn??tr("Sin velocidad configurada")}`:d?`${MOVEMENT[d.movement]?.label} · ${MOVEMENT[d.movement]?.distance}`:"",
        resolved,pending,canRelease:game.user.isGM && (resolved||pending),canDeclare:canDeclare(combat,c)&&(!blockedReason(effectivePowerHealth(c.actor))||game.user.isGM),
        movementResolved:movementState(combat,c)?.resolved,
        canMarkAttack:game.user.isGM&&snapshotOf(combat,c)?.action==="attack"&&!resolved,
        canMove:c.actor?.isOwner&&state.phase==="movement"&&!movementState(combat,c)?.resolved&&!blockedReason(effectivePowerHealth(c.actor)),
        canAttack:c.actor?.isOwner && combat.round>0 && (game.user.isGM||(["resolution","surpriseResolution"].includes(state.phase)&&snapshotOf(combat,c)?.action==="attack"&&!resolved&&!pending)),isGM:game.user.isGM};
    });return context;
  }
  async _onRender(context,options){
    // V14 assumes updateCombat renderData always includes the viewed encounter.
    // Health timing can update a different encounter; skip only that scroll handling.
    if(options.renderContext==="updateCombat"&&Array.isArray(options.renderData)&&!options.renderData.some(d=>d._id===this.viewed?.id))options={...options,renderContext:undefined};
    await super._onRender(context,options);
    this.element.querySelectorAll('[data-action="rollAll"],[data-action="rollNPC"]').forEach(e=>e.remove());
    const title=this.element.querySelector(".encounter-title");if(title&&this.viewed)title.textContent=this.viewed.round?trHTML`Turno ${this.viewed.round}`:tr("Combate sin comenzar");
  }
  _getEntryContextOptions(){return super._getEntryContextOptions().filter(o=>!["COMBATANT.ACTIONS.Clear","COMBATANT.ACTIONS.Reroll"].includes(o.label));}
}
