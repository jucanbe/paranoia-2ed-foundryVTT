import {blockedReason} from "./rules.mjs";
import * as HealthService from "./service.mjs";
import {DamageService} from "../damage/service.mjs";
import {chooseDamageResult} from "../damage/dialogs.mjs";
import {effectivePowerHealth} from "../powers/rules.mjs";
export function registerHealth(){
  game.paranoia=Object.freeze({...game.paranoia,DamageService,HealthService:Object.freeze({
    applyHealthResult:HealthService.applyHealthResult,clearStun:HealthService.recoverStun,
    applyTreatment:HealthService.applyTreatment,markTreated:HealthService.markTreated,
    setStatus:HealthService.setHealthStatus,checkUntreated:HealthService.checkUntreated,hourlySurvival:HealthService.hourlySurvival
  })});
  Hooks.on("updateCombat",combat=>HealthService.expireCombatStuns(combat).catch(error=>ui.notifications.error(error.message)));
  Hooks.once("ready",()=>{for(const combat of game.combats)HealthService.expireCombatStuns(combat).catch(console.error);});
  Hooks.on("preUpdateToken",(token,changes,_options,userId)=>{
    if(game.users.get(userId)?.isGM)return;
    if(!["x","y","elevation"].some(key=>Object.hasOwn(changes,key)))return;
    const reason=blockedReason(effectivePowerHealth(token.actor));
    if(reason){ui.notifications.warn(reason);return false;}
  });
  Hooks.on("preMoveToken",token=>{
    if(game.user.isGM)return;
    const reason=blockedReason(effectivePowerHealth(token.actor));
    if(reason){ui.notifications.warn(reason);return false;}
  });
  Hooks.on("renderChatMessageHTML",(message,html)=>{
    for(const button of html.querySelectorAll('[data-action="resolveDamage"]')){
      if(!game.user.isGM){button.remove();continue;}
      button.addEventListener("click",async()=>{
        button.disabled=true;
        try{await chooseDamageResult(await DamageService.fromMessage(message));}
        catch(error){ui.notifications.error(error.message);}finally{button.disabled=false;}
      });
    }
  });
}
