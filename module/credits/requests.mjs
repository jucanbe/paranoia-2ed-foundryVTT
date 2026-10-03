import {tr} from "../i18n/index.mjs";
import {executeSpend,executePurchase} from "./service.mjs";
const NS="paranoia-2-edition",waiting=new Map();
export async function requestCredits(actor,operation,payload){
  const gm=game.users.activeGM;if(!gm)throw Error(tr("Se necesita un DJ conectado para validar el gasto."));const id=foundry.utils.randomID();
  const response=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{waiting.delete(id);reject(Error(tr("Sin confirmación del DJ. Revisa el historial antes de repetir.")));},30000);waiting.set(id,{resolve,reject,timer});});
  try{await foundry.documents.ChatMessage.create({content:tr("Solicitud privada de gasto de créditos"),whisper:[gm.id,game.user.id],flags:{[NS]:{creditRequest:{id,actorUuid:actor.uuid,operation,payload}}}},{notify:false});return await response;}
  catch(error){const pending=waiting.get(id);if(pending){clearTimeout(pending.timer);waiting.delete(id);}throw error;}
}
export function registerCreditRequests(){
  Hooks.on("createChatMessage",(message,_options,userId)=>{
    const r=message.getFlag(NS,"creditRequest");if(!r||game.user.id!==game.users.activeGM?.id||message.author?.id!==userId)return;
    Promise.resolve().then(async()=>{
      const user=game.users.get(userId),actor=await fromUuid(r.actorUuid);if(!user||(!user.isGM&&!actor?.testUserPermission(user,"OWNER")))throw Error(tr("No tienes permiso para gastar de esta cuenta."));
      if(r.operation==="spend")return executeSpend(actor,r.payload.amount,r.payload.reason,{requestId:message.id},user);
      if(r.operation==="purchase")return executePurchase(actor,r.payload.itemUuid,r.payload.quantity,{requestId:message.id},user);
      throw Error(tr("Operación económica no permitida."));
    }).then(result=>message.update({[`flags.${NS}.creditResponse`]:{id:r.id,ok:true,result}},{notify:false}),error=>message.update({[`flags.${NS}.creditResponse`]:{id:r.id,ok:false,error:error.message}},{notify:false})).catch(console.error);
  });
  Hooks.on("updateChatMessage",message=>{if(message.author?.id!==game.user.id)return;const r=message.getFlag(NS,"creditResponse"),p=waiting.get(r?.id);if(!p)return;clearTimeout(p.timer);waiting.delete(r.id);r.ok?p.resolve(r.result):p.reject(Error(r.error));});
}
