import {SYSTEM_ID as NS,COMBAT_TURN_SECONDS} from "./config.mjs";
import {PhaseCombat,PhaseCombatant} from "./document.mjs";
import {PhaseCombatTracker} from "./tracker.mjs";
import {registerCombatRequests,requestCombat} from "./requests.mjs";
import {cleanupCombat} from "./service.mjs";
import {registerAttackDamage} from "./damage.mjs";
import {registerOptionalSettings} from "./optional/settings.mjs";
import {registerRepairs,repairWeapon} from "./optional/repairs.mjs";
import {addWound} from "./optional/wounds.mjs";
export function registerCombat(){
  registerOptionalSettings();
  registerRepairs();
  CONFIG.Combat.documentClass=PhaseCombat;
  CONFIG.Combatant.documentClass=PhaseCombatant;
  CONFIG.ui.combat=PhaseCombatTracker;
  CONFIG.time.roundTime=COMBAT_TURN_SECONDS;
  CONFIG.time.turnTime=0;
  registerCombatRequests();
  registerAttackDamage();
  game.paranoia=Object.freeze({...game.paranoia,combat:Object.freeze({request:requestCombat,
    addWound,repairWeapon,
    attack:(combat,combatantId,options)=>requestCombat(combat,"attack",options,combatantId),
    nextPhase:(combat,options)=>requestCombat(combat,"next",options)})});
  Hooks.on("deleteCombat",combat=>{if(game.user.id===game.users.activeGM?.id)cleanupCombat(combat).catch(console.error);});
  for(const hook of ["createChatMessage","updateChatMessage","deleteChatMessage"])Hooks.on(hook,message=>{
    if(message.getFlag(NS,"npcDeclaration"))ui.combat.render({force:true});
  });
}
