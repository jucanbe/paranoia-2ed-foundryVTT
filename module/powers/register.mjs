import {isRulesActor} from "../actors/types.mjs";
import {pointsFor} from "./rules.mjs";
import {registerPowerRequests,requestPower} from "./requests.mjs";
import {registerPowerChat,openPowerUse} from "./dialogs.mjs";
import {expirePowerEffects} from "./effects.mjs";
import {POWER_REGISTRY} from "./registry.mjs";
import {availablePowers,learnPsionicPower,psionicTrainingLevels} from "./service.mjs";
async function initializePool(actor){
  if(game.user.id!==game.users.activeGM?.id||!isRulesActor(actor))return;
  const pool=actor.system.mutantPower.points;
  if(pool?.value==null||pool?.max==null)await actor.update({"system.mutantPower.points":pointsFor(actor.system)});
}
export function registerPowers(){
  registerPowerRequests();registerPowerChat();
  game.paranoia=Object.freeze({...game.paranoia,MutantPowerService:Object.freeze({
    usePower:(actor,options)=>options?requestPower(actor,"use",options):openPowerUse(actor),
    recover:(actor,hours)=>requestPower(actor,"recover",{hours}),availablePowers,learnPsionicPower,psionicTrainingLevels,registry:POWER_REGISTRY})});
  Hooks.once("ready",async()=>{for(const actor of game.actors)try{await initializePool(actor);}catch(error){console.error("paranoia-2-edition | PM initialization",error);}await expirePowerEffects();});
  Hooks.on("createActor",actor=>initializePool(actor).catch(console.error));
  Hooks.on("updateWorldTime",()=>expirePowerEffects());
  Hooks.on("updateCombat",()=>expirePowerEffects());
}
