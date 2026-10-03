import {tr,trHTML} from "../i18n/index.mjs";
import {NS,treasonOffenses} from "./rules.mjs";
import {registerStore,isUnlocked,unlock,locked,transaction,actorKey} from "./store.mjs";
import {initialRecord} from "./rules.mjs";
import {legacyTreason} from "../migrations/legacy.mjs";
import * as service from "./service.mjs";
import {openDashboard,adjustDialog} from "./dialogs.mjs";
export function registerTreason(){
  registerStore();
  const api=Object.freeze({...service,unlock,lock:locked,isUnlocked,openDashboard,treasonOffenses});
  game.paranoia=Object.freeze({...game.paranoia,TreasonService:api,treason:api});
  Hooks.on("renderActorDirectory",(_app,html)=>{
    if(!game.user.isGM||html.querySelector("[data-treason-dashboard]"))return;
    const button=document.createElement("button");button.type="button";button.dataset.treasonDashboard="";button.textContent=tr("Traición · panel del DJ");
    button.addEventListener("click",()=>openDashboard());(html.querySelector(".directory-header")??html).prepend(button);
  });
  Hooks.on("paranoiaTreasonChanged",()=>{
    for(const actor of game.actors)if(["character","npc"].includes(actor.type)&&actor.sheet?.rendered)actor.sheet.render();
  });
  Hooks.on("updateSetting",(setting,_changes,_options,userId)=>{
    if(setting.key===`${NS}.treasonVault`&&userId!==game.user.id&&isUnlocked())locked();
  });
  Hooks.on("createActor",actor=>{
    if(!isUnlocked()||game.users.activeGM?.id!==game.user.id||!["character","npc"].includes(actor.type))return;
    transaction(body=>{body.actors[actorKey(actor)]??=legacyTreason(actor._source?.system??actor.system,actor.type)??initialRecord(actor.type);}).catch(e=>ui.notifications.error(e.message));
  });
  Hooks.on("createChatMessage",message=>{
    if(!isUnlocked()||game.users.activeGM?.id!==game.user.id||!message.getFlag(NS,"treasonReport"))return;
    // Receiving queues an authenticated report; it never changes PT or rolls automatically.
    service.receiveReports().then(()=>ui.notifications.info(tr("Nuevo informe al Ordenador. Revisa el panel de traición."))).catch(e=>ui.notifications.error(e.message));
  });
  Hooks.on("renderChatMessageHTML",(message,html)=>{
    const power=message.getFlag(NS,"powerResult");
    if(!game.user.isGM||!power||html.querySelector("[data-treason-power]"))return;
    const button=document.createElement("button");button.type="button";button.dataset.treasonPower="";button.textContent=tr("Registrar como traición");
    button.addEventListener("click",async()=>{
      if(button.disabled)return;button.disabled=true;
      try{await adjustDialog(await fromUuid(power.actorUuid),{category:"mutantPower",reason:trHTML`Uso descubierto de Poder Mutante: ${power.powerName}`,notes:trHTML`Resultado: ${message.uuid}`});}
      catch(e){ui.notifications.error(e.message);}finally{button.disabled=false;}
    });html.append(button);
  });
}
