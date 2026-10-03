import {tr} from "../i18n/index.mjs";
import {executeClone} from "./service.mjs";
const NS="paranoia-2-edition";
const waiting=new Map();
let queue=Promise.resolve();
function enqueue(actor,options,user){const result=queue.then(()=>executeClone(actor,options,user));queue=result.catch(()=>{});return result;}
export async function requestClone(actor,options){
  if(!game.user.isGM)throw Error(tr("Solo el DJ puede activar clones."));
  const gm=game.users.activeGM;if(!gm)throw Error(tr("Se necesita un DJ conectado."));
  if(gm.id===game.user.id)return enqueue(actor,options,game.user);
  const id=foundry.utils.randomID();let message;
  const response=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{waiting.delete(id);reject(Error(tr("Sin confirmación del DJ coordinador. Revisa el Actor antes de repetir.")));},30000);
    waiting.set(id,{resolve,reject,timer});
  });
  try{
    message=await foundry.documents.ChatMessage.create({content:tr("Solicitud privada de activación de clon"),whisper:[gm.id],
      flags:{[NS]:{cloneRequest:{id,actorUuid:actor.uuid,options}}}},{notify:false});
    return await response;
  }finally{
    const pending=waiting.get(id);if(pending){clearTimeout(pending.timer);waiting.delete(id);}
    // Keep the private coordination receipt. Immediate deletion races V14 chat rendering.
  }
}
export function registerCloneRequests(){
  Hooks.on("createChatMessage",(message,_options,userId)=>{
    const request=message.getFlag(NS,"cloneRequest");
    if(!request||game.user.id!==game.users.activeGM?.id||message.author?.id!==userId)return;
    const user=game.users.get(userId);
    Promise.resolve().then(async()=>{
      if(!user?.isGM)throw Error(tr("Solo el DJ puede activar clones."));
      const actor=await fromUuid(request.actorUuid);
      return enqueue(actor,request.options,user);
    }).then(result=>message.update({[`flags.${NS}.cloneResponse`]:{id:request.id,ok:true,result}},{notify:false}),
      error=>message.update({[`flags.${NS}.cloneResponse`]:{id:request.id,ok:false,error:error.message}},{notify:false})).catch(console.error);
  });
  Hooks.on("updateChatMessage",message=>{
    const response=message.getFlag(NS,"cloneResponse"),pending=waiting.get(response?.id);
    if(!pending)return;
    clearTimeout(pending.timer);waiting.delete(response.id);
    response.ok?pending.resolve(response.result):pending.reject(Error(response.error));
  });
}
