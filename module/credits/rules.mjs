import {localizedRecord,tr,trHTML} from "../i18n/index.mjs";
export const TRANSACTION_TYPES=Object.freeze(localizedRecord({reward:"Recompensa",fine:"Multa",purchase:"Compra",refund:"Reembolso",adjustment:"Ajuste",transfer:"Transferencia",other:"Otro"}));
export function amount(value,{positive=false}={}){
  if(typeof value!=="number"||!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER||(positive&&value<=0))throw Error(tr("Indica una cantidad numérica válida."));return value;
}
export function entry(balance,delta,{type="adjustment",reason,missionReference="",missionReportId="",relatedItem="",notes="",id,requestId="",timestamp=Date.now(),worldTime=0,userId="",privateData=null,corrects=""}={}){
  amount(balance);amount(delta);if(!Object.hasOwn(TRANSACTION_TYPES,type))throw Error(tr("Tipo de transacción desconocido."));
  if(!String(reason??"").trim())throw Error(tr("Indica el motivo."));
  const resultingBalance=amount(balance+delta);
  return {id,type,previousBalance:balance,delta,resultingBalance,reason:String(reason).trim(),missionReference:String(missionReference),missionReportId:String(missionReportId),relatedItem:String(relatedItem),notes:String(notes),requestId:String(requestId),timestamp,worldTime,userId,privateData,corrects:String(corrects)};
}
export function ledger(actor){const value=actor.system.creditLedger;return structuredClone(value?.toObject?.()??value??{history:[]});}
export function purchaseCost(item,quantity){
  if(!Number.isSafeInteger(quantity)||quantity<=0)throw Error(tr("Cantidad de compra no válida."));
  if(typeof item?.system.price!=="number"||item.system.price<0)throw Error(tr("El objeto no tiene precio disponible."));
  return amount(item.system.price*quantity);
}
/** Creation uses its original budget and prices, with one consolidated Actor write. */
export function creationLedger(actor,purchases,meta){
  const history=ledger(actor).history;let balance=actor.system.credits;
  const starting=entry(balance,100-balance,{...meta,type:"adjustment",reason:tr("Créditos iniciales de creación (100)"),requestId:`creation:${meta.id}`});history.push(starting);balance=100;
  for(const row of purchases.rows){const h=entry(balance,-row.cost,{...meta,id:`${meta.id}:${row.id}`,type:"purchase",reason:trHTML`Compra de creación: ${row.name}`,relatedItem:row.item.uuid});history.push(h);balance=h.resultingBalance;}
  return {history};
}
