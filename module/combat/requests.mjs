import {tr} from "../i18n/index.mjs";
import {SYSTEM_ID as NS} from "./config.mjs";
import {stateOf} from "./state.mjs";
import {executeCombatRequest} from "./service.mjs";

let queue=Promise.resolve();
const waiting=new Map();
const activeGM=()=>game.users.activeGM;
function enqueue(request,user){const task=queue.then(()=>executeCombatRequest(request,user));queue=task.catch(()=>{});return task;}

/** Authenticated Foundry documents avoid trusting a userId in a custom socket payload.
 * Requests are private, short-lived messages; only the active GM processes them in order. */
export async function requestCombat(combat,operation,options={},combatantId) {
  if(!activeGM())throw Error(tr("Se necesita un DJ conectado para coordinar el combate."));
  const request={combatId:combat?.id,combatantId,operation,options,round:combat?.round,phase:stateOf(combat).phase};
  if(game.user.id===activeGM().id)return enqueue(request,game.user);
  const id=foundry.utils.randomID();
  const response=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{waiting.delete(id);reject(Error(tr("El DJ no ha confirmado la solicitud. Comprueba el estado antes de repetirla.")));},30000);
    waiting.set(id,{resolve,reject,timer});
  });
  let message;
  try {
    message=await foundry.documents.ChatMessage.create({content:tr("Solicitud de combate"),whisper:[activeGM().id],flags:{[NS]:{request:{...request,id}}}},{notify:false});
    return await response;
  } finally {
    const pending=waiting.get(id);if(pending){clearTimeout(pending.timer);waiting.delete(id);}
    if(message && game.messages.has(message.id))await message.delete();
  }
}

export function registerCombatRequests() {
  Hooks.on("createChatMessage",(message,_options,userId)=>{
    const request=message.getFlag(NS,"request");
    if(!request || game.user.id!==activeGM()?.id || message.author?.id!==userId)return;
    const user=game.users.get(userId);if(!user)return;
    enqueue(request,user).then(result=>message.update({[`flags.${NS}.response`]:{id:request.id,ok:true,...(["preview","attack","damage"].includes(request.operation)?{result}: {})}},{notify:false}),
      error=>message.update({[`flags.${NS}.response`]:{id:request.id,ok:false,error:error.message}},{notify:false})).catch(console.error);
  });
  Hooks.on("updateChatMessage",message=>{
    const response=message.getFlag(NS,"response"),pending=waiting.get(response?.id);
    if(!pending)return;
    clearTimeout(pending.timer);waiting.delete(response.id);
    response.ok?pending.resolve(response):pending.reject(Error(response.error));
  });
}
