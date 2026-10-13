import {serviceState,rollCoverService} from "./service.mjs";
import {tr} from "../i18n/index.mjs";
export async function serviceAction(event,target){
 if(!game.user.isGM||!this.isEditable||this._serviceBusy)return;
 this._serviceBusy=true;
 try{const state=serviceState(this.actor);
 if(target.dataset.serviceAction==="clear"&&state.invalidCoverService){await this.actor.update({"system.coverService":null});}
 else if(state.isSSI){const result=await rollCoverService(async()=> (await new Roll("1d20").evaluate()).total);await this.actor.update({"system.coverService":result.result});}
 }catch(error){ui.notifications.warn(tr(error.message));}finally{this._serviceBusy=false;}
}
