import {SecurityClearanceService} from "./service.mjs";
export function registerSecurityClearance(){
  game.settings.register("paranoia-2-edition","showPromotionProgressToPlayers",{name:"P2.Settings.showPromotionProgressToPlayers",hint:"P2.Settings.showPromotionProgressToPlayersHint",scope:"world",config:true,type:Boolean,default:true});
  game.paranoia=Object.freeze({...game.paranoia,SecurityClearanceService});
  Hooks.on("paranoiaClearanceChanged",actor=>actor.sheet?.render(false));
  Hooks.on("updateSetting",setting=>{
    if(setting.key==="paranoia-2-edition.showPromotionProgressToPlayers")for(const actor of game.actors)
      if(["character","npc"].includes(actor.type)&&actor.sheet?.rendered)actor.sheet.render();
  });
}
