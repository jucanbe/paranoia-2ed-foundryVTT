import {staticMarkup} from "../i18n/index.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import {CATEGORIES,NS} from "./rules.mjs";
import {readInbox} from "./ledger.mjs";
import * as service from "./service.mjs";
import {CLEARANCE_CODES} from "../actors/identity.mjs";
import {isTerminal} from "../clones/rules.mjs";
import * as clearance from "../clearance/service.mjs";
import {action as clearanceDialog,progressText} from "../clearance/dialogs.mjs";
import {LABELS} from "../sheets/labels.mjs";
import * as development from "../development/service.mjs";
import * as credits from "../credits/service.mjs";
import {action as creditDialog} from "../credits/dialogs.mjs";
const esc=value=>foundry.utils.escapeHTML(String(value??""));
const choices=values=>Object.entries(values).map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join("");
const field=(name,label,value="",type="text")=>`<label class="p2-treason-field">${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${type==="number"?'step="1"':''}></label>`;
const select=(name,label,values)=>`<label class="p2-treason-field">${esc(label)}<select name="${name}">${choices(values)}</select></label>`;
async function form(title,content,accept=tr("Aplicar"),render){
  const result=await foundry.applications.api.DialogV2.wait({window:{title},position:{width:650},content:`<div class="p2-treason-dialog">${content}</div>`,
    buttons:[{action:"apply",label:accept,default:true,callback:(_event,button)=>({values:Object.fromEntries(new FormData(button.form))})},{action:"cancel",label:tr("Cancelar")}],render});
  return result?.values??null;
}
export function equipmentWarnings(actor){
  if(!game.user.isGM)return [];
  const levels=Object.keys(CLEARANCE_CODES),level=levels.indexOf(actor.system.securityClearance);
  return [...actor.items].filter(i=>level>=0&&levels.indexOf(i.system.securityClearance)>level).map(i=>i.name);
}
export function panelHTML(actor){
  if(!game.user.isGM)return "";
  const button=(op,label)=>`<button type="button" data-action="treasonAction" data-treason-operation="${op}">${label}</button>`;
  const r=service.getRecord(actor),warnings=equipmentWarnings(actor);
  return trHTML`<section class="p2-section"><h2>Traición · solo DJ</h2>${r.enabled?trHTML`<p><strong>Puntos: ${r.points} / 20</strong> · ${r.declaredTraitor?tr("TRAIDOR DECLARADO"):tr("Sin declaración")}</p>
    <div class="p2-treason-actions">${button("add",tr("Añadir PT"))}${button("remove",tr("Quitar PT"))}${button("history",tr("Historial"))}${button("trust",tr("Solicitar al Ordenador"))}${button("declare",tr("Declarar traidor inmediatamente"))}${button("revoke",tr("Revocar condición de traidor"))}${button("bounty",tr("Recompensa"))}${button("publish",tr("Publicar declaraciones pendientes"))}</div>`:staticMarkup("<p>Seguimiento desactivado.</p>")}
    ${actor.type==="npc"?button("tracking",r.enabled?tr("Desactivar seguimiento"):tr("Activar seguimiento")):""}
    ${warnings.length?trHTML`<p>Equipo por encima del nivel de seguridad: ${warnings.map(esc).join(", ")}</p>${button("equipment",tr("Registrar posible traición"))}`:""}
    ${button("dashboard",tr("Panel de traición / informe final"))}</section>`;
}
export async function adjustDialog(actor,{negative=false,category="other",reason="",notes=""}={}){
  const values=await form(negative?tr("Quitar PT"):tr("Añadir PT"),`${field("amount",tr("Cantidad"),1,"number")}${field("reason",tr("Motivo"),reason)}${select("category",tr("Categoría"),{[category]:CATEGORIES[category],...CATEGORIES})}${field("relatedActor",tr("UUID del ciudadano relacionado (opcional)"))}${field("notes",tr("Nota privada"),notes)}`);
  if(!values)return;
  const amount=Number(values.amount);if(!Number.isSafeInteger(amount)||amount<0)throw Error(tr("Cantidad no válida."));
  await service.adjustPoints(actor,negative?-amount:amount,{...values,relatedActor:values.relatedActor||null});
}
export async function historyDialog(actor){
  const r=service.getRecord(actor);
  await foundry.applications.api.DialogV2.prompt({window:{title:trHTML`Registro privado · ${actor.name}`},position:{width:760},content:trHTML`<div class="p2-treason-history"><p>PT: ${r.points} · Recompensa: ${r.bounty??"—"}</p>
    <table><thead><tr><th>Fecha / tiempo</th><th>Cambio</th><th>Motivo</th></tr></thead><tbody>${r.history.map(h=>`<tr><td>${esc(new Date(h.timestamp).toLocaleString())}<br>${h.worldTime??"—"} s</td><td>${h.previous} → ${h.current} (${h.delta>=0?"+":""}${h.delta})</td><td>${esc(h.reason)}<br>${esc(CATEGORIES[h.category])}<br>${esc(h.notes)}<br>${esc(h.relatedActor)}</td></tr>`).join("")}</tbody></table>
    <h3>Confianza del Ordenador · detalles privados</h3>${r.trust.map(t=>`<p>${esc(t.request)}: ${t.die} &gt; ${t.points} → ${t.success?tr("Aceptada"):tr("Denegada")}</p>`).join("")}</div>`,ok:{label:tr("Cerrar")}});
}
export async function trustDialog(actor){
  const values=await form(tr("Solicitar al Ordenador"),`<p>${esc(actor.name)}</p>${field("request",tr("Solicitud"))}${select("visibility",tr("Visibilidad"),{private:tr("Informe privado al DJ"),public:tr("Pública")})}`,tr("Solicitar"));
  if(!values)return;
  if(!values.request.trim())throw Error(tr("Indica la solicitud."));
  const message=await service.submitReport({kind:"trust",actorUuid:actor.uuid,reason:values.request,public:values.visibility==="public"});
  if(game.user.isGM){
    await service.receiveReports();await service.rollComputerTrust(actor,{request:values.request,requestId:message.id});
  }
}
export async function accusationDialog(actor){
  const citizens=Object.fromEntries(game.actors.filter(a=>["character","npc"].includes(a.type)&&a.visible).map(a=>[a.uuid,a.name]));
  const values=await form(tr("Acusar de traición"),trHTML`<p>Acusador: ${esc(actor.name)}</p>${select("accusedUuid",tr("Acusado"),citizens)}${field("reason",tr("Acusación"))}${field("notes",tr("Pruebas / notas"))}${select("visibility",tr("Visibilidad"),{private:tr("Informe privado al DJ"),public:tr("Acusación pública")})}`,tr("Enviar"));
  if(values)await service.submitReport({kind:"accusation",actorUuid:actor.uuid,...values,public:values.visibility==="public"});
}
export async function missionDialog(){
  if(!game.user.isGM)throw Error(tr("Solo DJ."));
  const actors=game.actors.filter(a=>a.type==="character"||(a.type==="npc"&&(service.getRecord(a).enabled||clearance.isEnabled(a)||development.isEnabled(a)||credits.isEnabled(a))));
  const content=trHTML`${field("missionId",tr("Referencia única de misión"),foundry.utils.randomID())}<p>Traición, ascenso y Desarrollo son independientes. La concesión sugerida es 4 PD, también si la misión fracasa. Si ya se activó otro clon o hubo desaparición/vaporización, revisa «Superviviente válido».</p><div style="overflow:auto"><table><thead><tr><th>Incluir / ciudadano</th><th>Resultado</th><th>PT / ajuste</th><th>Ascenso</th><th>DESARROLLO</th><th>CRÉDITOS</th><th>Motivo / excepción DJ</th></tr></thead><tbody>${actors.map((a,i)=>{
    const enabled=clearance.isEnabled(a)&&!!clearance.getNext(a),valid=!isTerminal(a.system.health)&&!service.getRecord(a).declaredTraitor;
    return trHTML`<tr><td><label><input type="checkbox" name="include${i}" ${a.type==="character"||!isTerminal(a.system.health)?"checked":""}>${esc(a.name)}</label><br>Clon actual: ${a.system.cloneNumber}</td><td><select name="result${i}" data-outcome="${i}">${choices({none:tr("Sin participación"),success:tr("Éxito"),failure:tr("Fracaso"),custom:tr("Definido por DJ")})}</select></td><td>${service.getRecord(a).enabled?service.getPoints(a):tr("Seguimiento PT desactivado")}<input aria-label="Ajuste PT" type="number" step="1" name="delta${i}" value="0" ${!service.getRecord(a).enabled?"readonly":""}></td><td><label><input type="checkbox" name="count${i}" ${enabled&&valid?"checked":""} ${!enabled?"disabled":""}>Contar para ascenso</label><label><input type="checkbox" name="survivor${i}" ${valid?"checked":""}>Superviviente válido para ascenso</label>${enabled?esc(progressText(clearance.getPromotionRequirements(a))):tr("Seguimiento de ascensos desactivado")}</td><td>${development.isEnabled(a)?`${field(`pd${i}`,tr("PD concedidos"),game.settings.get(NS,"defaultDevelopmentAward"),"number")}${field(`pdReason${i}`,tr("Motivo PD (visible al propietario)"),tr("Desarrollo tras la aventura"))}<label><input type="checkbox" name="used${i}">Limitar a habilidades utilizadas</label><label><input type="checkbox" name="resetUsage${i}">Reiniciar usos</label>`:tr("Desarrollo desactivado")}</td><td>${credits.isEnabled(a)?trHTML`${field(`reward${i}`,tr("Recompensa"),0,"number")}${field(`fine${i}`,tr("Multa"),0,"number")}${field(`creditReason${i}`,tr("Motivo económico"),tr("Resultado económico de misión"))}<small>Referencia sugerida: ${game.settings.get(NS,"defaultMissionReward")} créditos; no automática.</small><output data-credit-net="${i}">Neto: 0</output>`:tr("Economía desactivada")}</td><td><input aria-label="Motivo" name="reason${i}" value="Informe final de misión"><label><input type="checkbox" name="override${i}">Excepción DJ (motivo obligatorio)</label></td></tr>`;
  }).join("")}</tbody></table></div>`;
  const values=await form(tr("Informe Final de misión"),content,tr("Confirmar informe"),(_event,dialog)=>{
    dialog.element.querySelectorAll("[data-credit-net]").forEach(output=>{const i=output.dataset.creditNet,reward=dialog.element.querySelector(`[name="reward${i}"]`),fine=dialog.element.querySelector(`[name="fine${i}"]`),refresh=()=>{output.textContent=trHTML`Neto: ${Number(reward.value)-Number(fine.value)} créditos`;};reward.addEventListener("input",refresh);fine.addEventListener("input",refresh);});
    dialog.element.querySelectorAll("[data-outcome]").forEach(el=>el.addEventListener("change",()=>{
      if(el.value==="custom")return;const i=el.dataset.outcome,delta=dialog.element.querySelector(`[name="delta${i}"]`);
      if(!delta.readOnly)delta.value=el.value==="success"?-1:el.value==="failure"?1:0;
      dialog.element.querySelector(`[name="reason${i}"]`).value=el.value==="success"?tr("Éxito de misión"):el.value==="failure"?tr("Fracaso de misión"):tr("Informe final de misión");
    }));
  });
  if(!values)return;
  const rows=actors.flatMap((actor,i)=>values[`include${i}`]?[{actor,delta:Number(values[`delta${i}`]),reason:values[`reason${i}`],result:values[`result${i}`],countForPromotion:!!values[`count${i}`],validSurvivor:!!values[`survivor${i}`],override:!!values[`override${i}`],...(credits.isEnabled(actor)?{creditReward:Number(values[`reward${i}`]),creditFine:Number(values[`fine${i}`]),creditReason:values[`creditReason${i}`]}:{}),...(development.isEnabled(actor)?{developmentAward:Number(values[`pd${i}`]),developmentReason:values[`pdReason${i}`],developmentRestriction:values[`used${i}`]?"used":"keep",resetSkillUsage:!!values[`resetUsage${i}`]}:{})}]:[]);
  const results=await service.applyMissionReport(rows,{missionId:values.missionId.trim()});
  if(results.some(r=>r.alreadyApplied))ui.notifications.warn(tr("El informe ya estaba aplicado. No se repiten PT ni progreso."));
  for(const result of results){
    const actor=actors.find(a=>a.uuid===result.actorUuid),r=clearance.getPromotionRequirements(actor);
    const promote=await foundry.applications.api.DialogV2.confirm({window:{title:trHTML`Informe aplicado · ${actor.name}`},content:trHTML`<p>Misión: ${esc(values.missionId)} · ${esc(rows.find(v=>v.actor===actor).result)}</p><p>Créditos: +${result.creditReward??0} recompensa / −${result.creditFine??0} multa · Saldo: ${actor.system.credits}</p><p>PD concedidos: ${result.developmentAward??0} · PD pendientes: ${actor.system.development.available}</p><p>Ajuste PT: ${rows.find(v=>v.actor===actor).delta} · Progreso: ${result.counted?"+1":tr("sin incremento")}</p><p>${esc(progressText(r))} · ${esc(r.blocked|| (r.eligible?trHTML`Elegible para ${LABELS.clearances[r.target]}`:tr("Requisito pendiente")))}</p>`,yes:{label:r.eligible?tr("Ascender ahora"):tr("Cerrar")},no:{label:tr("Ascender después")}});
    if(promote&&r.eligible)await clearanceDialog(actor,"promote");
    if(development.isEnabled(actor)&&development.getAvailable(actor)>0)ui.notifications.info(trHTML`${actor.name}: PD pendientes ${development.getAvailable(actor)}. Usa «Mejorar habilidades» para gastarlos al terminar la aventura.`);
  }
}
export async function reviewReport(id){
  const entry=readInbox()[id];if(!entry||entry.status!=="pending")throw Error(tr("Informe ya resuelto."));
  const actor=await fromUuid(entry.actorUuid);
  if(entry.kind==="trust"){
    if(await foundry.applications.api.DialogV2.confirm({window:{title:tr("Confianza del Ordenador")},content:`<p>${esc(actor.name)}: ${esc(entry.reason)}</p>`,yes:{label:tr("Solicitar")},no:{label:tr("Cancelar")}}))await service.rollComputerTrust(actor,{request:entry.reason,requestId:id});
    return;
  }
  const values=await form(tr("Revisar informe privado"),`<p>${esc(actor.name)}: ${esc(entry.reason)}</p><p>${esc(entry.notes)}</p>${entry.accusedUuid?trHTML`<p>Acusado: ${esc((await fromUuid(entry.accusedUuid))?.name)}</p>`:""}${select("disposition",tr("Decisión"),{note:tr("Anotar sin PT"),dismiss:tr("Desestimar"),apply:tr("Aplicar ajuste elegido por DJ")})}${field("delta",tr("Ajuste (sin cantidad oficial)"),entry.suggestedDelta??0,"number")}${field("reason",tr("Motivo"),entry.reason)}`);
  if(values)await service.adjudicateReport(id,{...values,delta:Number(values.delta)});
}
export async function action(actor,operation){
  if(operation?.startsWith("credit:"))return creditDialog(actor,operation.slice(7));
  if(operation?.startsWith("clearance:"))return clearanceDialog(actor,operation.slice(10));
  if(operation==="trust")return trustDialog(actor);
  if(operation==="accuse")return accusationDialog(actor);
  if(!game.user.isGM)throw Error(tr("Solo el DJ puede gestionar la traición."));
  if(operation==="dashboard")return openDashboard();
  if(operation==="mission")return missionDialog();
  if(operation==="receive")return service.receiveReports();
  if(operation==="publish")return service.publishDeclarations();
  if(operation==="responses")return service.publishResponses();
  if(operation==="add"||operation==="remove")return adjustDialog(actor,{negative:operation==="remove"});
  if(operation==="equipment")return adjustDialog(actor,{category:"equipment",reason:tr("Equipo por encima del nivel de seguridad"),notes:equipmentWarnings(actor).join(", ")});
  if(operation==="history")return historyDialog(actor);
  if(operation==="tracking")return service.enableTracking(actor,!service.getRecord(actor).enabled);
  if(operation==="declare"||operation==="revoke"||operation==="bounty"){
    const values=await form(operation==="declare"?tr("Confirmar declaración inmediata (PT = 20)"):operation==="revoke"?tr("Revocar condición de traidor"):tr("Recompensa por eliminación"),
      `${field("reason",tr("Motivo"))}${operation!=="revoke"?field("bounty",tr("Créditos (vacío: sin especificar)"),service.getRecord(actor).bounty??"","number"):""}`,tr("Confirmar"));
    if(!values)return;
    const bounty=values.bounty?.trim()?Number(values.bounty):null;
    return operation==="declare"?service.declareTraitor(actor,values.reason,bounty):operation==="revoke"?service.revokeTraitor(actor,values.reason):service.setBounty(actor,bounty,values.reason);
  }
}
const busy=new WeakSet();
export async function treasonAction(_event,target){
  if(busy.has(this))return;busy.add(this);
  try{await action(this.actor,target.dataset.treasonOperation);await this.render();}
  catch(error){ui.notifications.error(error.message);}finally{busy.delete(this);}
}
let dashboard;
export function openDashboard(){
  if(!game.user.isGM)throw Error(tr("Solo DJ."));
  dashboard??=new TreasonDashboard();return dashboard.render(true);
}
export class TreasonDashboard extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2){
  static DEFAULT_OPTIONS={classes:["paranoia-sheet"],window:{title:"Traición · panel del DJ",resizable:true},position:{width:820,height:700},actions:{
    command:async function(_event,target){
      if(busy.has(this))return;busy.add(this);
      try{if(target.dataset.reportId)await reviewReport(target.dataset.reportId);
        else await action(target.dataset.actorUuid?await fromUuid(target.dataset.actorUuid):null,target.dataset.operation);
        await this.render();
      }catch(error){ui.notifications.error(error.message);}finally{busy.delete(this);}
    }}};
  static PARTS={body:{template:"systems/paranoia-2-edition/templates/treason/dashboard.hbs"}};
  async _prepareContext(){
    if(!game.user.isGM)throw Error(tr("Solo DJ."));
    const actors=game.actors.filter(a=>["character","npc"].includes(a.type)).map(a=>({uuid:a.uuid,name:a.name,...service.getRecord(a)})).sort((a,b)=>b.points-a.points);
    const promotions=game.actors.filter(a=>clearance.isEnabled(a)).map(a=>{const r=clearance.getPromotionRequirements(a);return {uuid:a.uuid,name:a.name,current:LABELS.clearances[a.system.securityClearance],next:LABELS.clearances[r.target]??"—",progress:progressText(r),eligible:r.eligible,blocked:r.blocked};});
    const economy=game.actors.filter(a=>credits.isEnabled(a)).map(a=>({uuid:a.uuid,name:a.name,balance:credits.getBalance(a)}));
    return {actors,promotions,economy,inbox:Object.entries(readInbox()).filter(([,e])=>e.status==="pending").map(([id,e])=>({id,reason:e.reason,kind:e.kind}))};
  }
}
