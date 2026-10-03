import {tr,trHTML} from "../i18n/index.mjs";
import {amount,entry,ledger,purchaseCost,TRANSACTION_TYPES} from "./rules.mjs";
import {ItemCatalog} from "../items/catalog.mjs";
import {canPurchase} from "../creation/purchases.mjs";
import {sealReport,openReport} from "../treason/store.mjs";
import {requestCredits} from "./requests.mjs";
const queues=new Map(),NS="paranoia-2-edition";
function citizen(actor){if(!["character","npc"].includes(actor?.type))throw Error(tr("Solo los ciudadanos tienen un saldo personal de créditos."));}
export function canView(actor,user=game.user){return !!user?.isGM||(actor?.type==="character"&&actor.testUserPermission(user,"OWNER"));}
function owner(actor,user=game.user){citizen(actor);if(!canView(actor,user))throw Error(tr("No tienes permiso para usar esta cuenta."));}
function gm(actor){citizen(actor);if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)throw Error(tr("El DJ coordinador debe gestionar esta transacción."));}
export const isEnabled=actor=>actor?.type==="character"||(actor?.type==="npc"&&actor.system.creditTrackingEnabled===true);
export function getBalance(actor){owner(actor);return amount(actor.system.credits);}
export function getHistory(actor){owner(actor);return ledger(actor).history.map(({privateData,...h})=>({...h,private:!!privateData}));}
export async function getPrivateDetails(actor,id){gm(actor);const h=ledger(actor).history.find(h=>h.id===id);if(!h)throw Error(tr("Transacción desconocida."));return h.privateData?openReport(h.privateData):null;}
function enqueue(actor,callback){const result=(queues.get(actor.uuid)??Promise.resolve()).catch(()=>{}).then(callback);queues.set(actor.uuid,result);return result;}
const stamp=actor=>JSON.stringify({credits:actor.system.credits,ledger:actor.system.creditLedger,items:actor.items?.map(i=>i.toObject())});
const meta=user=>({id:foundry.utils.randomID(),timestamp:Date.now(),worldTime:game.time.worldTime,userId:(user??game.user).id});
async function write(actor,balance,history,expected,items){
  gm(actor);const system={...actor.system.toObject(),credits:balance,creditLedger:{history}};
  new CONFIG.Actor.dataModels[actor.type](system,{strict:true});
  if(items)for(const item of items)new CONFIG.Item.documentClass(item,{parent:actor,strict:true});
  if(stamp(actor)!==expected)throw Error(tr("La cuenta o el inventario cambiaron. Revisa y repite."));
  const changes=items?{system,items}:{"system.credits":balance,"system.creditLedger":{history}};
  if(!await actor.update(changes,{paranoiaCreditTransaction:true,...(items?{diff:false,recursive:false}:{})}))throw Error(tr("No se guardó la transacción."));
  Hooks.callAll("paranoiaCreditsChanged",actor);return balance;
}
async function privateOptions(options){
  if(!options.privateNotes)return options;
  if(!game.settings.get(NS,"treasonVault")?.publicKey)throw Error(tr("Prepara el registro secreto del DJ para cifrar notas económicas privadas."));
  // Never persist private reasons, item sources or notes in plaintext Actor data.
  const privateData=await sealReport({reason:String(options.reason??""),notes:String(options.notes??""),relatedItem:String(options.relatedItem??"")});
  return {...options,reason:tr("Transacción privada del DJ"),notes:"",relatedItem:"",privateData};
}
async function notify(actor,h,options){
  if(!["owner","public"].includes(options.notification))return;
  const esc=foundry.utils.escapeHTML;
  try{await foundry.documents.ChatMessage.create({content:trHTML`<p><strong>${esc(actor.name)}</strong> · ${esc(TRANSACTION_TYPES[h.type]??h.type)}: ${h.delta>=0?"+":""}${h.delta} créditos.</p><p>Nuevo saldo: ${h.resultingBalance}</p>${options.showReason&&!h.privateData?`<p>${esc(h.reason)}</p>`:""}`,whisper:options.notification==="public"?[]:game.users.filter(u=>u.isGM||actor.testUserPermission(u,"OWNER")).map(u=>u.id)});}catch(error){ui.notifications.warn(trHTML`Transacción guardada; no se pudo enviar el aviso: ${error.message}`);}
}
export function adjust(actor,delta,options={}){
  gm(actor);amount(delta);if(!isEnabled(actor))throw Error(tr("Activa el seguimiento económico del PNJ."));
  return enqueue(actor,async()=>{
    const expected=stamp(actor),history=ledger(actor).history;
    if(options.requestId){const previous=history.find(h=>h.requestId===options.requestId);if(previous)return {duplicate:true,entry:previous};}
    const clean=await privateOptions(options),h=entry(actor.system.credits,delta,{...clean,...meta(),requestId:options.requestId??""});
    history.push(h);await write(actor,h.resultingBalance,history,expected);await notify(actor,h,options);return h;
  });
}
export function reward(actor,value,reason,options={}){amount(value,{positive:true});return adjust(actor,value,{...options,type:"reward",reason});}
export function fine(actor,value,reason,options={}){amount(value,{positive:true});return adjust(actor,-value,{...options,type:"fine",reason});}
export function spend(actor,value,reason,options={}){
  owner(actor);amount(value,{positive:true});
  if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)return requestCredits(actor,"spend",{amount:value,reason});
  return executeSpend(actor,value,reason,options,game.user);
}
export function executeSpend(actor,value,reason,options={},user=game.user){
  gm(actor);owner(actor,user);amount(value,{positive:true});if(!isEnabled(actor))throw Error(tr("Seguimiento económico desactivado."));
  if(!user.isGM&&options.allowDebt)throw Error(tr("Solo el DJ puede autorizar gasto a crédito."));
  return enqueue(actor,async()=>{
    owner(actor,user);const expected=stamp(actor),history=ledger(actor).history;
    if(options.requestId&&history.some(h=>h.requestId===options.requestId))return {duplicate:true};
    if(value>actor.system.credits&&!options.allowDebt)throw Error(tr("No hay suficientes créditos."));
    const clean=await privateOptions({...options,reason});
    const h=entry(actor.system.credits,-value,{...clean,...meta(user),type:"purchase",requestId:options.requestId??""});history.push(h);
    await write(actor,h.resultingBalance,history,expected);return h;
  });
}
async function catalogItem(value){
  const uuid=typeof value==="string"?value:value?.uuid;
  const item=(await ItemCatalog.entries()).find(i=>i.uuid===uuid);if(!item)throw Error(tr("Selecciona un objeto del catálogo del sistema."));return item;
}
export async function purchase(actor,item,quantity,options={}){
  owner(actor);
  if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)return requestCredits(actor,"purchase",{itemUuid:typeof item==="string"?item:item?.uuid,quantity});
  return executePurchase(actor,item,quantity,options,game.user);
}
export function executePurchase(actor,value,quantity,options={},user=game.user){
  gm(actor);owner(actor,user);if(!isEnabled(actor))throw Error(tr("Seguimiento económico desactivado."));
  if(!user.isGM&&(options.allowDebt||options.clearanceOverride))throw Error(tr("Solo el DJ puede autorizar excepciones de compra."));
  return enqueue(actor,async()=>{
    owner(actor,user);const expected=stamp(actor),history=ledger(actor).history;
    if(options.requestId&&history.some(h=>h.requestId===options.requestId))return {duplicate:true};
    const item=await catalogItem(value),cost=purchaseCost(item,quantity);
    if(!canPurchase(item,actor.system.securityClearance,!!options.clearanceOverride))throw Error(tr("El objeto supera el Nivel de Seguridad autorizado."));
    if(cost>actor.system.credits&&!options.allowDebt)throw Error(tr("No hay suficientes créditos."));
    const source=item.toObject();source._id=foundry.utils.randomID();delete source.folder;delete source.ownership;delete source._stats;
    source.system.assigned=false;source.system.quantity=source.system.priceUnit==="meter"?1:quantity;
    if(source.system.priceUnit==="meter")source.system.length=quantity;
    source.flags??={};source.flags[NS]={...source.flags[NS],catalogSource:item.uuid};
    const h=entry(actor.system.credits,-cost,{...meta(user),type:"purchase",reason:trHTML`Compra: ${item.name}`,relatedItem:item.uuid,requestId:options.requestId??""});
    h.purchase={embeddedItemId:source._id,quantity,price:item.system.price,priceUnit:item.system.priceUnit??"item",sourceSnapshot:structuredClone(source)};
    history.push(h);await write(actor,h.resultingBalance,history,expected,[...actor.items.map(i=>i.toObject()),source]);return h;
  });
}
export function refundPurchase(actor,id,options={}){
  gm(actor);
  return enqueue(actor,async()=>{
    const expected=stamp(actor),history=ledger(actor).history,h=history.find(h=>h.id===id&&h.type==="purchase"&&h.purchase);
    if(!h||history.some(v=>v.corrects===id&&v.type==="refund"))throw Error(tr("Compra desconocida o ya reembolsada."));
    const item=actor.items.get(h.purchase.embeddedItemId);
    if(!item||JSON.stringify(cleanItem(item.toObject()))!==JSON.stringify(cleanItem(h.purchase.sourceSnapshot)))throw Error(tr("El objeto falta o cambió: no se reembolsa automáticamente material usado, consumido o destruido."));
    const clean=await privateOptions(options),correction=entry(actor.system.credits,-h.delta,{...clean,...meta(),type:"refund",corrects:id});history.push(correction);
    await write(actor,correction.resultingBalance,history,expected,actor.items.filter(i=>i.id!==item.id).map(i=>i.toObject()));return correction;
  });
}
function cleanItem(source){return Object.fromEntries(["name","type","img","system","flags","effects"].map(key=>[key,source[key]??(key==="effects"?[]:key==="flags"?{}:null)]));}
export function correctTransaction(actor,id,delta,options={}){
  gm(actor);if(!ledger(actor).history.some(h=>h.id===id))throw Error(tr("Transacción desconocida."));return adjust(actor,delta,{...options,type:"adjustment",corrects:id});
}
export function prepareMissionCredits(actor,{reward=0,fine=0,reason="",missionReportId,missionReference=missionReportId}={}){
  gm(actor);amount(reward);amount(fine);if(reward<0||fine<0)throw Error(tr("Recompensa y multa deben ser cantidades no negativas."));
  if((reward||fine)&&!isEnabled(actor))throw Error(tr("Activa el seguimiento económico del PNJ."));
  if((reward||fine)&&!String(reason).trim())throw Error(tr("Indica el motivo económico."));
  amount(actor.system.credits+reward);amount(actor.system.credits+reward-fine);
  return {actorUuid:actor.uuid,reward,fine,reason,missionReportId,missionReference};
}
export async function applyMissionCredits(task){
  const actor=await fromUuid(task.actorUuid);gm(actor);
  return enqueue(actor,async()=>{
    const expected=stamp(actor),history=ledger(actor).history;let balance=actor.system.credits;
    if(history.some(h=>h.requestId===`report:${task.missionReportId}:credits`))return {duplicate:true};
    prepareMissionCredits(actor,task);
    const rows=[];
    if(task.reward)rows.push({delta:task.reward,type:"reward"});if(task.fine)rows.push({delta:-task.fine,type:"fine"});
    if(!rows.length)return;
    for(const row of rows){const h=entry(balance,row.delta,{...meta(),...task,...row,requestId:`report:${task.missionReportId}:credits`});history.push(h);balance=h.resultingBalance;}
    await write(actor,balance,history,expected);return {balance};
  });
}
export function enableTracking(actor,enabled){gm(actor);if(actor.type!=="npc")throw Error(tr("Los personajes tienen economía activada."));return actor.update({"system.creditTrackingEnabled":!!enabled});}
export const CreditService=Object.freeze({getBalance,getHistory,getPrivateDetails,isEnabled,canView,adjust,reward,fine,spend,purchase,refundPurchase,correctTransaction,enableTracking});
