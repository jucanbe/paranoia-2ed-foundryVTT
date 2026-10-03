import {tr} from "../i18n/index.mjs";
import {requestCombat} from "./requests.mjs";
import {SYSTEM_ID as NS} from "./config.mjs";

export class PhaseCombat extends foundry.documents.Combat {
  startCombat(){return requestCombat(this,"start");}
  nextTurn(){return requestCombat(this,this.round ? "next":"start");}
  previousTurn(){return requestCombat(this,"previous");}
  nextRound(){return this.nextTurn();}
  previousRound(){return this.previousTurn();}
  rollInitiative(){ui.notifications.info(tr("Paranoia utiliza fases simultáneas, sin iniciativa."));return Promise.resolve(this);}
  _sortCombatants(a,b){return a.name.localeCompare(b.name)||a.id.localeCompare(b.id);}
  _canChangeRound(user){return user.isGM;}
  _canChangeTurn(user){return user.isGM;}
}

export class PhaseCombatant extends foundry.documents.Combatant {
  async _preUpdate(changes,options,user){
    if(!user.isGM && (foundry.utils.getProperty(changes,`flags.${NS}`)!==undefined || Object.keys(changes).some(k=>k.startsWith(`flags.${NS}`)))) {
      ui.notifications.warn(tr("Los datos de combate deben ser validados por el DJ."));
      return false;
    }
    return super._preUpdate(changes,options,user);
  }
}
