import {staticMarkup} from "../i18n/index.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import * as service from "./service.mjs";
import {TRANSACTION_TYPES,purchaseCost} from "./rules.mjs";
import {ItemCatalog} from "../items/catalog.mjs";
const esc=v=>foundry.utils.escapeHTML(String(v??""));
const field=(name,label,value="",type="text")=>`<label class="p2-treason-field">${esc(label)}<input type="${type}" name="${name}" value="${esc(value)}" ${type==="number"?'step="any"':''}></label>`;
async function form(title,content,label=tr("Confirmar"),render){
  const result=await foundry.applications.api.DialogV2.wait({window:{title,resizable:true},position:{width:740},content:`<div class="p2-treason-dialog">${content}</div>`,render,buttons:[
    {action:"apply",label,callback:(_e,b)=>({values:Object.fromEntries(new FormData(b.form))})},{action:"cancel",label:tr("Cancelar")}]});return result?.values;
}
export function panel(actor){
  if(!service.canView(actor))return "";
  const button=(op,label)=>`<button type="button" data-action="creditAction" data-credit-operation="${op}">${label}</button>`;
  return trHTML`<section class="p2-section p2-credits"><h2>Créditos</h2><p><strong>${service.getBalance(actor)} créditos</strong>${actor.system.credits<0?" · Saldo negativo / deuda":""}</p><div class="p2-treason-actions">${service.isEnabled(actor)?`${button("history",tr("Historial"))}${button("purchase",tr("Comprar"))}${button("spend",tr("Registrar gasto"))}${game.user.isGM?`${button("reward",tr("+ Recompensa"))}${button("fine",tr("Multa"))}${button("adjustment",tr("Ajustar créditos"))}${button("loss",tr("Registrar pérdida / imponer multa"))}`:""}`:tr("Seguimiento económico desactivado.")}${game.user.isGM&&actor.type==="npc"?button("tracking",service.isEnabled(actor)?tr("Desactivar economía"):tr("Activar economía")):""}</div></section>`;
}
export async function transactionDialog(actor,type,{reason="",relatedItem=""}={}){
  const isSpend=type==="spend",isFine=type==="fine",isReward=type==="reward";
  const values=await form(isFine?tr("Imponer multa"):isReward?tr("Conceder créditos"):isSpend?tr("Registrar gasto"):tr("Ajustar créditos"),trHTML`<p>${esc(actor.name)} · Saldo: ${service.getBalance(actor)} créditos.</p>${field("amount",type==="adjustment"?tr("Ajuste positivo o negativo"):tr("Cantidad"),isReward?game.settings.get("paranoia-2-edition","defaultMissionReward"):0,"number")}${field("reason",tr("Motivo"),reason)}${!isSpend?trHTML`${field("missionReference",tr("Misión / referencia"))}${field("relatedItem",tr("UUID de objeto relacionado (opcional)"),relatedItem)}${field("notes",tr("Notas"))}
    <label><input name="privateNotes" type="checkbox"> Ocultar motivo, fuente y notas al propietario (cifrado del DJ)</label><label>Aviso<select name="notification"><option value="none">Sin chat</option><option value="owner">Privado al propietario / DJ</option><option value="public">Público deliberado</option></select></label><label><input name="showReason" type="checkbox"> Incluir motivo visible en el aviso (nunca notas privadas)</label>`:""}${game.user.isGM&&isSpend?staticMarkup('<label><input type="checkbox" name="allowDebt"> Autorizar gasto con saldo insuficiente</label>'):""}`);
  if(!values)return;
  const options={...values,privateNotes:!!values.privateNotes,showReason:!!values.showReason,allowDebt:!!values.allowDebt};
  if(isSpend)return service.spend(actor,Number(values.amount),values.reason,options);
  if(isFine)return service.fine(actor,Number(values.amount),values.reason,options);
  if(isReward)return service.reward(actor,Number(values.amount),values.reason,options);
  return service.adjust(actor,Number(values.amount),options);
}
async function purchaseDialog(actor){
  const entries=(await ItemCatalog.entries()).filter(i=>typeof i.system.price==="number"&&i.system.price>=0);
  const values=await form(tr("Comprar objeto"),trHTML`<p>Saldo: ${service.getBalance(actor)} créditos. El equipo asignado se entrega por separado y no se cobra.</p><label>Objeto<select name="itemUuid">${entries.map(i=>trHTML`<option value="${esc(i.uuid)}">${esc(i.name)} · ${i.system.price} créditos${i.system.priceUnit==="meter"?" / metro":i.system.priceUnit==="bottle"?" / botella":" / unidad"}</option>`).join("")}</select></label>${field("quantity",tr("Cantidad (metros si corresponde)"),1,"number")}<p data-credit-cost>Coste calculado al seleccionar.</p>${game.user.isGM?staticMarkup('<label><input name="allowDebt" type="checkbox"> Autorizar compra a crédito</label><label><input name="clearanceOverride" type="checkbox"> Autorizar excepción de Nivel de Seguridad</label>'):""}`,tr("Comprar"),(_e,dialog)=>{
    const root=dialog.element,refresh=()=>{try{const item=entries.find(i=>i.uuid===root.querySelector('[name="itemUuid"]').value),cost=purchaseCost(item,Number(root.querySelector('[name="quantity"]').value));root.querySelector('[data-credit-cost]').textContent=trHTML`Coste: ${cost} créditos · Saldo resultante: ${service.getBalance(actor)-cost}`;}catch(error){root.querySelector('[data-credit-cost]').textContent=error.message;}};
    root.addEventListener("input",refresh);root.addEventListener("change",refresh);refresh();
  });
  if(values)return service.purchase(actor,values.itemUuid,Number(values.quantity),{allowDebt:!!values.allowDebt,clearanceOverride:!!values.clearanceOverride});
}
export async function historyDialog(actor){
  const history=service.getHistory(actor);
  const values=await form(tr("Historial de créditos"),`<div style="max-height:430px;overflow:auto">${history.map(h=>trHTML`<details><summary>${esc(TRANSACTION_TYPES[h.type])} · ${h.delta>=0?"+":""}${h.delta} · ${h.previousBalance} → ${h.resultingBalance}</summary><p>${esc(h.reason)}<br>${esc(h.missionReference)} · ${esc(new Date(h.timestamp).toLocaleString())} · ${h.worldTime} s<br>Usuario: ${esc(game.users.get(h.userId)?.name??h.userId)}<br>${esc(h.notes)}${h.private?staticMarkup("<br>Detalles privados del DJ"):""}</p></details>`).join("")}</div>${game.user.isGM?trHTML`<label>Transacción<select name="transaction"><option value="">Ninguna</option>${history.map(h=>`<option value="${esc(h.id)}">${esc(TRANSACTION_TYPES[h.type])} · ${h.delta} · ${esc(h.reason)}</option>`).join("")}</select></label><label>Acción<select name="operation"><option value="none">Solo consultar</option><option value="private">Ver detalles privados</option><option value="correct">Corregir mediante compensación</option><option value="refund">Revertir compra intacta</option></select></label>${field("delta",tr("Ajuste compensatorio"),0,"number")}${field("reason",tr("Motivo de corrección / reembolso"))}`:""}`,tr("Cerrar / aplicar"));
  if(!values?.transaction)return;
  if(values.operation==="private"){
    const details=await service.getPrivateDetails(actor,values.transaction);
    return foundry.applications.api.DialogV2.prompt({window:{title:tr("Detalles económicos · solo DJ")},content:`<p>${esc(details?.reason??tr("Sin datos privados"))}<br>${esc(details?.notes)}<br>${esc(details?.relatedItem)}</p>`,ok:{label:tr("Cerrar")}});
  }
  if(values.operation==="correct")return service.correctTransaction(actor,values.transaction,Number(values.delta),{reason:values.reason});
  if(values.operation==="refund")return service.refundPurchase(actor,values.transaction,{reason:values.reason});
}
export async function action(actor,op){
  if(op==="history")return historyDialog(actor);if(op==="purchase")return purchaseDialog(actor);
  if(op==="spend")return transactionDialog(actor,"spend");
  if(!game.user.isGM)throw Error(tr("Solo el DJ puede conceder recompensas, imponer multas o corregir."));
  if(op==="tracking")return service.enableTracking(actor,!service.isEnabled(actor));
  if(op==="loss"){
    const items=actor.items.filter(i=>i.system.assigned);
    const values=await form(tr("Registrar pérdida de equipo asignado"),trHTML`<p>La pérdida no impone una multa automáticamente. Selecciona la referencia y decide el importe.</p><select name="itemUuid"><option value="">Otro equipo</option>${items.map(i=>`<option value="${i.uuid}">${esc(i.name)}</option>`).join("")}</select>`,tr("Preparar multa"));
    if(values)return transactionDialog(actor,"fine",{relatedItem:values.itemUuid,reason:tr("Pérdida de equipo asignado del Ordenador")});return;
  }
  return transactionDialog(actor,op);
}
const busy=new WeakSet();
export async function creditAction(_e,target){if(busy.has(this))return;busy.add(this);try{await action(this.actor,target.dataset.creditOperation);await this.render();}catch(error){ui.notifications.error(error.message);}finally{busy.delete(this);}}
export async function proposeFine(){
  if(!game.user.isGM)return;
  try{const actors=game.actors.filter(a=>service.isEnabled(a)),values=await form(tr("Proponer multa · daño a propiedad del Ordenador"),trHTML`<p>${esc(this.actor.name)}. No existe una tarifa automática: el DJ decide ciudadano e importe.</p><label>Ciudadano responsable<select name="actorUuid">${actors.map(a=>`<option value="${a.uuid}">${esc(a.name)}</option>`).join("")}</select></label>`,tr("Preparar multa"));
    if(values)return transactionDialog(await fromUuid(values.actorUuid),"fine",{reason:trHTML`Daño / pérdida de ${this.actor.name}`});}catch(error){ui.notifications.error(error.message);}
}
