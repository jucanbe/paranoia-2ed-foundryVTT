import {staticMarkup} from "../i18n/index.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import {POWER_NS as NS} from "./rules.mjs";
import {ownedPower,requirePowerOwner,privateRecipients,renderPower,powerCombatContext,commitPowerUse,recoverPower,adjudicatePower,endPowerEffect} from "./service.mjs";

let queue=Promise.resolve();
const enqueue=task=>{const result=queue.catch(()=>{}).then(task);queue=result.catch(()=>{});return result;};
export async function requestPower(actor,operation,options={}){
  requirePowerOwner(actor);
  if(!game.users.activeGM)throw Error(tr("Se necesita un DJ conectado para aprobar y coordinar el poder."));
  if(!["use","recover"].includes(operation)&&!game.user.isGM)throw Error(tr("Solo el DJ puede adjudicar poderes."));
  const {combat}=powerCombatContext(actor);
  const request={actorUuid:actor.uuid,operation,options,cloneNumber:actor.system.cloneNumber,
    powerKey:ownedPower(actor,options.powerKey)?.key,round:combat?.round,combatId:combat?.id,status:"pending"};
  const message=await foundry.documents.ChatMessage.create({
    content:await renderPower("request",{actorName:actor.name,operation,isUse:operation==="use",...options}),
    whisper:privateRecipients(actor),flags:{[NS]:{powerRequest:request}}},{notify:false});
  if(game.user.id===game.users.activeGM.id)return processPowerRequest(message,options);
  ui.notifications.info(operation==="use"?tr("Solicitud privada enviada al DJ para revisar coste y dificultad."):tr("Solicitud privada enviada al DJ."));
  return {messageId:message.id,pending:true};
}
export function processPowerRequest(message,approved){return enqueue(async()=>{
  if(game.user.id!==game.users.activeGM?.id)throw Error(tr("Solo el DJ coordinador puede confirmar esta solicitud."));
  const request=message.getFlag(NS,"powerRequest");
  if(!request||request.status!=="pending")throw Error(tr("La solicitud ya fue procesada o está en curso."));
  const actor=await fromUuid(request.actorUuid),user=message.author;
  requirePowerOwner(actor,user);
  if(actor.system.cloneNumber!==request.cloneNumber)throw Error(tr("La solicitud pertenece a otro clon."));
  if(!["use","recover"].includes(request.operation)&&!user.isGM)throw Error(tr("La operación requiere al DJ."));
  const options=approved??request.options;
  if(request.operation==="use"&&!approved) return {pending:true};
  await message.update({[`flags.${NS}.powerRequest.status`] : "processing"},{notify:false});
  try{
    let result;
    if(request.operation==="use")result=await commitPowerUse(actor,options,request,message.id);
    else if(request.operation==="recover")result=await recoverPower(actor,Number(options.hours));
    else if(request.operation==="adjudicate")result=await adjudicatePower(game.messages.get(options.messageId),options);
    else if(request.operation==="endEffect")result=await endPowerEffect(actor,options.effectId,{rested:!!options.rested});
    else throw Error(tr("Operación no válida."));
    await message.update({content:staticMarkup("<p>Solicitud privada resuelta.</p>"),[`flags.${NS}.powerRequest.status`] : "completed"},{notify:false});
    return result;
  }catch(error){
    await message.update({content:trHTML`<p>Revisión del DJ necesaria: ${foundry.utils.escapeHTML(error.message)} No repitas sin comprobar PM y resultado.</p>`,
      [`flags.${NS}.powerRequest.status`] : "review"},{notify:false});
    throw error;
  }
});}
export function registerPowerRequests(){
  Hooks.on("createChatMessage",(message,_options,userId)=>{
    const request=message.getFlag(NS,"powerRequest");
    if(!request||game.user.id!==game.users.activeGM?.id||userId===game.user.id||message.author?.id!==userId)return;
    if(request.operation==="use")return; // Explicit private approval, never trust the proposed cost or modifier.
    processPowerRequest(message).catch(error=>ui.notifications.error(error.message));
  });
}
