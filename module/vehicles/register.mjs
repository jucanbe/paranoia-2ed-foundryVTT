import {tr} from "../i18n/index.mjs";
import * as service from "./service.mjs";
import {createVehicleDialog} from "./creator.mjs";
export function registerVehicles(){
  game.paranoia=Object.freeze({...game.paranoia,VehicleService:Object.freeze({...service,create:createVehicleDialog})});
  Hooks.on("renderActorDirectory",(_app,html)=>{if(!game.user.isGM||html.querySelector("[data-create-vehicle]"))return;const button=document.createElement("button");button.type="button";button.dataset.createVehicle="";button.textContent=tr("Crear vehículo");button.addEventListener("click",()=>createVehicleDialog().catch(e=>ui.notifications.error(e.message)));(html.querySelector(".directory-header")??html).prepend(button);});
}
