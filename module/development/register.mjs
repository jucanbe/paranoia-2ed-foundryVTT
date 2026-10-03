import {DevelopmentService} from "./service.mjs";
import {registerDevelopmentRequests} from "./requests.mjs";
export function registerDevelopment(){
  game.settings.register("paranoia-2-edition","defaultDevelopmentAward",{name:"P2.Settings.defaultDevelopmentAward",hint:"P2.Settings.defaultDevelopmentAwardHint",scope:"world",config:true,type:Number,default:4});
  game.paranoia=Object.freeze({...game.paranoia,DevelopmentService});registerDevelopmentRequests();
  Hooks.on("paranoiaDevelopmentChanged",actor=>{if(actor.sheet?.rendered)actor.sheet.render();});
}
