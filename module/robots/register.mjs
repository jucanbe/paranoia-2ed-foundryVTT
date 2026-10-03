import {tr} from "../i18n/index.mjs";
import * as RobotService from "./service.mjs";
import {createRobotDialog} from "./creator.mjs";
export function registerRobots(){
  game.paranoia=Object.freeze({...game.paranoia,RobotService:Object.freeze({...RobotService,create:createRobotDialog})});
  Hooks.on("renderActorDirectory",(_app,html)=>{if(!game.user.isGM||html.querySelector('[data-create-robot]'))return;const b=document.createElement("button");b.type="button";b.dataset.createRobot="";b.textContent=tr("Crear Robot");b.addEventListener("click",()=>createRobotDialog().catch(e=>ui.notifications.error(e.message)));(html.querySelector('.directory-header')??html).prepend(b);});
}
