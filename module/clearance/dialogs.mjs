import {staticMarkup} from "../i18n/index.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import * as service from "./service.mjs";
import {CLEARANCE_CODES} from "../actors/identity.mjs";
import {LABELS} from "../sheets/labels.mjs";
import {clearanceIndex} from "./rules.mjs";
const esc=v=>foundry.utils.escapeHTML(String(v??""));
const field=(name,label,value="",type="text")=>`<label class="p2-treason-field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${type==="number"?'min="0" step="1"':''}></label>`;
const checkbox=(name,label,checked=false)=>`<label><input type="checkbox" name="${name}" ${checked?"checked":""}> ${esc(label)}</label>`;
export function progressText(r){return !r.target?tr("Nivel máximo"):r.type==="successfulMissions"?`${r.completed} / ${r.count} misiones`:r.description;}
export function panel(actor){
  const r=service.getPromotionRequirements(actor);if(!r)return "";
  const button=(op,label)=>`<button type="button" data-action="clearanceAction" data-clearance-operation="${op}">${label}</button>`;
  return trHTML`<section class="p2-section p2-clearance"><h2>Nivel de Seguridad · ascensos</h2>${r.enabled?trHTML`<p>Próximo nivel: ${esc(LABELS.clearances[r.target]??"—")} · ${esc(progressText(r))}</p>`:staticMarkup("<p>Seguimiento de ascensos desactivado.</p>")}
    ${game.user.isGM?`<p>${esc(r.blocked|| (r.eligible?tr("Elegible para ascenso"):tr("Requisito pendiente")))}</p><div class="p2-treason-actions">${r.enabled&&r.target?button("promote",tr("Ascender")):""}${service.getPrevious(actor)?button("demote",tr("Degradar")):""}${button("manual",tr("Cambiar nivel"))}${button("correct",tr("Corregir progreso"))}${button("history",tr("Historial de CS"))}${actor.type==="npc"?button("tracking",r.enabled?tr("Desactivar seguimiento"):tr("Activar seguimiento")):""}</div>`:""}</section>`;
}
async function form(title,content,label=tr("Confirmar")){
  const result=await foundry.applications.api.DialogV2.wait({window:{title},position:{width:650},content:`<div class="p2-treason-dialog">${content}</div>`,buttons:[
    {action:"apply",label,callback:(_e,b)=>({values:Object.fromEntries(new FormData(b.form))})},{action:"cancel",label:tr("Cancelar")}]});
  return result?.values;
}
export async function action(actor,operation){
  if(!game.user.isGM)throw Error(tr("Solo el DJ puede gestionar niveles de seguridad."));
  if(operation==="tracking")return service.enableTracking(actor,!service.isEnabled(actor),{reason:tr("Seguimiento de ascensos del PNJ")});
  if(operation==="history"){
    const history=service.getHistory(actor);
    const result=await form(tr("Historial privado de CS"),trHTML`<table><thead><tr><th>Cambio / estado</th><th>Motivo y notas del DJ</th></tr></thead><tbody>${history.map(h=>`<tr><td>${esc(LABELS.clearances[h.previousClearance])} → ${esc(LABELS.clearances[h.newClearance])}<br>${esc(h.type)} · ${esc(h.status)}<br>${esc(new Date(h.timestamp).toLocaleString())} · ${h.worldTime} s<br>DJ: ${esc(game.users.get(h.userId)?.name??h.userId)}</td><td>${esc(h.reason)}<br>${esc(h.missionReference)}<br>${esc(h.notes)}${h.type==="progressCorrection"||h.type==="missionProgress"?trHTML`<br>Misiones: ${h.before.securityProgress.successfulMissions} → ${h.after.securityProgress.successfulMissions}`:""}</td></tr>`).join("")}</tbody></table>${history.some(h=>h.status==="pending")?trHTML`<label>Reanudar cambio pendiente<select name="pending"><option value="">Ninguno</option>${history.filter(h=>h.status==="pending").map(h=>`<option value="${esc(h.id)}">${esc(h.reason)}</option>`).join("")}</select></label>`:""}`,tr("Cerrar / reanudar"));
    if(result?.pending)await service.resumeAction(result.pending);return;
  }
  if(operation==="correct"){
    const p=actor.system.securityProgress;
    const values=await form(tr("Corregir progreso"),`${field("count",tr("Misiones"),p.successfulMissions,"number")}${checkbox("satisfied",tr("Requisito especial confirmado por el DJ"),p.requirementSatisfied)}${field("reason",tr("Motivo obligatorio"))}${field("notes",tr("Notas privadas del DJ"))}`);
    if(values)return service.correctProgress(actor,{...values,successfulMissions:Number(values.count),requirementSatisfied:!!values.satisfied});return;
  }
  const current=service.getCurrent(actor),r=service.getPromotionRequirements(actor);
  let choices=Object.keys(CLEARANCE_CODES);
  if(operation==="demote")choices=choices.filter(k=>clearanceIndex(k)<clearanceIndex(current));
  const next=operation==="promote"?service.getNext(actor):operation==="demote"?service.getPrevious(actor):current;
  const content=trHTML`<p>Ciudadano: ${esc(actor.name)} · Actual: ${esc(LABELS.clearances[current])}</p>${operation==="promote"?trHTML`<p>Nuevo nivel: ${esc(LABELS.clearances[next])} · ${esc(progressText(r))}<br>${esc(r.blocked)}</p>${checkbox("override",tr("Excepción del DJ: ignorar requisito / condición de traidor (motivo obligatorio)"))}`:trHTML`<label>Nuevo nivel<select name="target">${choices.map(k=>`<option value="${k}" ${k===next?"selected":""}>${esc(LABELS.clearances[k])}</option>`).join("")}</select></label>${checkbox("preserveProgress",tr("Conservar progreso"))}`}
    ${field("reason",tr("Motivo obligatorio"))}${field("missionReference",tr("Misión / referencia"))}${field("notes",tr("Notas privadas del DJ"))}${checkbox("announce",tr("Publicar anuncio de cambio de nivel"))}`;
  const values=await form(operation==="promote"?tr("Ascender ciudadano"):operation==="demote"?tr("Degradar nivel de seguridad"):tr("Cambiar nivel de seguridad"),content,operation==="promote"?tr("Ascender ciudadano"):tr("Confirmar cambio"));
  if(!values)return;
  const options={...values,override:!!values.override,announce:!!values.announce,preserveProgress:!!values.preserveProgress};
  if(operation==="promote")return service.promote(actor,options);
  if(operation==="demote"){
    if(clearanceIndex(current)-clearanceIndex(values.target)>1){
      options.confirmMultiLevel=await foundry.applications.api.DialogV2.confirm({window:{title:tr("Confirmar degradación de varios niveles")},content:`<p>${esc(LABELS.clearances[current])} → ${esc(LABELS.clearances[values.target])}</p>`,yes:{label:tr("Confirmar degradación")},no:{label:tr("Cancelar")}});
      if(!options.confirmMultiLevel)return;
    }
    return service.demote(actor,options);
  }
  return service.setClearance(actor,values.target,options);
}
const busy=new WeakSet();
export async function clearanceAction(_event,target){
  if(busy.has(this))return;busy.add(this);
  try{await action(this.actor,target.dataset.clearanceOperation);await this.render();}catch(error){ui.notifications.error(error.message);}finally{busy.delete(this);}
}
