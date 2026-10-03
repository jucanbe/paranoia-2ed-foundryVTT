import {CreditService} from "./service.mjs";
import {registerCreditRequests} from "./requests.mjs";
export function registerCredits(){
  game.settings.register("paranoia-2-edition","defaultMissionReward",{name:"P2.Settings.defaultMissionReward",hint:"P2.Settings.defaultMissionRewardHint",scope:"world",config:true,type:Number,default:1000});
  game.paranoia=Object.freeze({...game.paranoia,CreditService});registerCreditRequests();
  Hooks.on("paranoiaCreditsChanged",actor=>{if(actor.sheet?.rendered)actor.sheet.render();});
}
