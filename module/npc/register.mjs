import {tr} from "../i18n/index.mjs";
import {NPCGenerator} from "./service.mjs";
import {openNPCGenerator} from "./generator-dialog.mjs";
export function registerNPC(){
  game.paranoia=Object.freeze({...game.paranoia,NPCGenerator});
  Hooks.on("renderActorDirectory",(app,html)=>{
    if(!game.user.isGM||html.querySelector("[data-p2-generate-npc]"))return;
    const button=document.createElement("button");button.type="button";button.dataset.p2GenerateNpc="";button.textContent=tr("Generar PNJ");
    button.addEventListener("click",()=>openNPCGenerator());
    (html.querySelector(".directory-header")??html).prepend(button);
  });
}
