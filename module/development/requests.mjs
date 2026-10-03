import {tr} from "../i18n/index.mjs";
import {executeSpend} from "./service.mjs";
const NS="paranoia-2-edition",waiting=new Map();
export async function requestDevelopment(actor,rows,options={}){
  const gm=game.users.activeGM;if(!gm)throw Error(tr("Se necesita un DJ conectado para validar y guardar las mejoras."));
  const id=foundry.utils.randomID();
  const response=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{waiting.delete(id);reject(Error(tr("Sin confirmación del DJ. Revisa el historial antes de repetir.")));},30000);waiting.set(id,{resolve,reject,timer});});
  try{
    await foundry.documents.ChatMessage.create({content:tr("Solicitud privada de mejora de habilidades"),whisper:[gm.id,game.user.id],flags:{[NS]:{developmentRequest:{id,actorUuid:actor.uuid,rows,options}}}},{notify:false});
    return await response;
  }catch(error){const pending=waiting.get(id);if(pending){clearTimeout(pending.timer);waiting.delete(id);}throw error;}
}
export function registerDevelopmentRequests(){
  Hooks.on("createChatMessage",(message,_options,userId)=>{
    const request=message.getFlag(NS,"developmentRequest");
    if(!request||game.user.id!==game.users.activeGM?.id||message.author?.id!==userId)return;
    Promise.resolve().then(async()=>{
      const user=game.users.get(userId),actor=await fromUuid(request.actorUuid);
      if(!user||(!user.isGM&&!actor?.testUserPermission(user,"OWNER")))throw Error(tr("No tienes permiso para mejorar este ciudadano."));
      return executeSpend(actor,request.rows,{...request.options,requestId:message.id},user);
    }).then(result=>message.update({[`flags.${NS}.developmentResponse`]:{id:request.id,ok:true,result}},{notify:false}),
      error=>message.update({[`flags.${NS}.developmentResponse`]:{id:request.id,ok:false,error:error.message}},{notify:false})).catch(console.error);
  });
  Hooks.on("updateChatMessage",message=>{
    if(message.author?.id!==game.user.id)return;
    const r=message.getFlag(NS,"developmentResponse"),pending=waiting.get(r?.id);if(!pending)return;
    // Actor update and receipt are emitted in order by the coordinator.
    clearTimeout(pending.timer);waiting.delete(r.id);r.ok?pending.resolve(r.result):pending.reject(Error(r.error));
  });
}
