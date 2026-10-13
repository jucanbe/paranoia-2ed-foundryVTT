import {tr} from "../i18n/index.mjs";
export function canEditPortrait(actor,user=game.user){return actor.canUserModify(user,"update")&&!(actor.pack&&game.packs.get(actor.pack)?.locked);}
export function portraitContext(actor){return {img:actor.img,canEditPortrait:canEditPortrait(actor)};}
/** Native picker, ordinary core-document update; prototype Token texture is independent. */
export async function editPortrait(_event,target){
 const actor=this.actor;if(!canEditPortrait(actor)||this._portraitPickerOpen)return;
 this._portraitPickerOpen=true;
 try{const picker=new foundry.applications.apps.FilePicker.implementation({type:"image",current:actor.img,document:actor,
  callback:async path=>{if(canEditPortrait(actor))await actor.update({img:path});},
  position:{top:this.position.top+40,left:this.position.left+10}});
 await picker.browse();
 }catch(error){ui.notifications.error(tr(error.message));}finally{this._portraitPickerOpen=false;}
}
