import {staticMarkup} from "../i18n/index.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import * as service from "./service.mjs";
import {SKILLS,development,improvementCost} from "./rules.mjs";
import {LABELS} from "../sheets/labels.mjs";
const esc=v=>foundry.utils.escapeHTML(String(v??""));
const field=(name,label,value="",type="text")=>`<label class="p2-treason-field">${esc(label)}<input name="${name}" value="${esc(value)}" type="${type}" ${type==="number"?'step="1"':''}></label>`;
async function form(title,content,label=tr("Aplicar"),render){
  const result=await foundry.applications.api.DialogV2.wait({window:{title,resizable:true},position:{width:780},content:`<div class="p2-treason-dialog">${content}</div>`,render,buttons:[
    {action:"apply",label,callback:(_e,b)=>{const data=new FormData(b.form);return {values:Object.fromEntries(data),eligible:data.getAll("eligible")};}},{action:"cancel",label:tr("Cancelar")}]});
  return result?.values?{...result.values,eligibleSkills:result.eligible}:null;
}
export function panel(actor){
  if(!service.canView(actor))return "";
  const d=development(actor.system.development),button=(op,label)=>`<button type="button" data-action="developmentAction" data-development-operation="${op}">${label}</button>`;
  return trHTML`<section class="p2-section p2-development"><h2>Desarrollo · después de aventuras</h2>${service.isEnabled(actor)?trHTML`<p><strong>PD disponibles: ${d.available}</strong>${d.available?" · PD pendientes: gástalos al terminar la aventura o consulta al DJ.":""}</p><div class="p2-treason-actions">${button("spend",tr("Mejorar habilidades"))}${button("history",tr("Historial de PD"))}${game.user.isGM?`${button("award",tr("Conceder PD"))}${button("correct",tr("Corregir PD"))}${button("restrict",tr("Restringir habilidades"))}${button("reset",tr("Nueva aventura / reiniciar usos"))}`:""}</div>`:staticMarkup("<p>Desarrollo desactivado.</p>")}${game.user.isGM&&actor.type==="npc"?button("tracking",service.isEnabled(actor)?tr("Desactivar desarrollo"):tr("Activar desarrollo")):""}</section>`;
}
function eligibleInputs(actor){
  const d=development(actor.system.development);
  return trHTML`<details><summary>Habilidades elegibles: selección manual</summary><div style="max-height:260px;overflow:auto">${SKILLS.map(s=>trHTML`<label><input type="checkbox" name="eligible" value="${s.key}" ${d.eligibleSkills.includes(s.key)?"checked":""}> ${esc(s.label)} (${esc(s.groupLabel)}) · usos: ${d.usage.find(r=>r.skillKey===s.key)?.count??0}</label>`).join("")}</div></details>`;
}
export async function spendDialog(actor){
  const d=development(actor.system.development),metadata=service.societyMetadata(actor),groups=[...new Set(SKILLS.map(s=>s.groupLabel))];
  const content=trHTML`<p>PD disponibles: <strong>${d.available}</strong>. Mejora posterior a creación: sin límite de 12, 14 o 20. Los PD mejoran habilidades individuales.</p><div style="max-height:440px;overflow:auto">${groups.map(group=>trHTML`<h3>${esc(group)}</h3><table><thead><tr><th>Habilidad / actual</th><th>Incremento</th><th>Nuevo / coste PD</th>${game.user.isGM?staticMarkup("<th>Coste DJ (opcional)</th>"):""}</tr></thead><tbody>${SKILLS.filter(s=>s.groupLabel===group).map(s=>{
    const i=SKILLS.indexOf(s),[g,k]=s.key.split("."),value=actor.system.skills[g][k].value,blocked=d.restricted&&!d.eligibleSkills.includes(s.key);
    return trHTML`<tr><td>${esc(s.label)}: ${value}${blocked?" · no autorizada":""}</td><td><div class="p2-development-increment"><button type="button" data-increment="${i}" data-step="-1">−</button><input style="width:70px" aria-label="Incremento ${esc(s.label)}" type="number" min="0" step="1" name="increase${i}" value="0" ${blocked&&!game.user.isGM?"disabled":""}><button type="button" data-increment="${i}" data-step="1" ${blocked&&!game.user.isGM?"disabled":""}>+</button></div></td><td><output data-preview="${i}">${value} / 0</output></td>${game.user.isGM?trHTML`<td><input style="width:70px" aria-label="Coste DJ ${esc(s.label)}" type="number" min="0" step="1" name="cost${i}" placeholder="Auto"></td>`:""}</tr>`;
  }).join("")}</tbody></table>`).join("")}</div><p data-development-summary>Total: 0 PD · Restantes: ${d.available}</p>${game.user.isGM?staticMarkup('<label><input type="checkbox" name="overrideRestrictions"> Excepción DJ: ignorar habilidades restringidas</label>'):""}${field("reason",tr("Motivo / referencia visible al propietario"),tr("Mejora posterior a la aventura"))}`;
  const values=await form(tr("Mejorar habilidades"),content,tr("Aplicar mejoras"),(_event,dialog)=>{
    const element=dialog.element;
    const refresh=()=>{
      let total=0,error="";
      const data=Object.fromEntries(new FormData(element instanceof HTMLFormElement?element:element.querySelector("form")));
      const rows=SKILLS.map((s,i)=>({skillKey:s.key,increase:Number(data[`increase${i}`]??0),...(data[`cost${i}`]?.trim()?{overrideCost:Number(data[`cost${i}`])}:{})}));
      for(const [i,row] of rows.entries()){
        const [g,k]=row.skillKey.split("."),current=actor.system.skills[g][k].value;
        try{const cost=row.increase?(row.overrideCost??improvementCost(row.skillKey,row.increase,metadata).cost):0;total+=cost;element.querySelector(`[data-preview="${i}"]`).textContent=`${current} → ${current+row.increase} / ${cost} PD`;}catch(e){error=e.message;}
      }
      try{service.preview(actor,rows,{overrideRestrictions:!!data.overrideRestrictions,reason:data.reason});}catch(e){error=e.message;}
      element.querySelector("[data-development-summary]").textContent=error||trHTML`Total: ${total} PD · Restantes: ${d.available-total}`;
      element.querySelector('[data-action="apply"]').disabled=!!error||rows.every(r=>!r.increase);
    };
    element.addEventListener("input",refresh);element.addEventListener("change",refresh);
    element.querySelectorAll("[data-increment]").forEach(button=>button.addEventListener("click",()=>{const input=element.querySelector(`[name="increase${button.dataset.increment}"]`);if(input.disabled)return;input.value=Math.max(0,Number(input.value)+Number(button.dataset.step));refresh();}));refresh();
  });
  if(!values)return;
  const rows=SKILLS.map((s,i)=>({skillKey:s.key,increase:Number(values[`increase${i}`]??0),...(values[`cost${i}`]?.trim()?{overrideCost:Number(values[`cost${i}`])}:{})})).filter(r=>r.increase);
  const result=await service.spendBatch(actor,rows,{reason:values.reason,overrideRestrictions:!!values.overrideRestrictions});
  const available=service.getAvailable(actor);if(available)ui.notifications.info(trHTML`PD pendientes: ${available}. Puedes completar las mejoras o conservarlos con permiso del DJ.`);return result;
}
export async function action(actor,op){
  if(op==="spend")return spendDialog(actor);
  if(op==="history"){
    const history=service.getHistory(actor),refunded=new Set(history.filter(h=>h.kind==="refund").map(h=>h.expenditureId));
    const values=await form(tr("Historial de desarrollo"),trHTML`<p>Obtenidos: ${actor.system.development.lifetimeEarned} · Gastados acumulados: ${actor.system.development.lifetimeSpent} · Reembolsados: ${actor.system.development.lifetimeRefunded}</p><div style="max-height:430px;overflow:auto">${history.map(h=>trHTML`<p><strong>${esc(h.kind)} · ${esc(new Date(h.timestamp).toLocaleString())}</strong> · DJ/jugador: ${esc(game.users.get(h.userId)?.name??h.userId)}<br>${esc(h.reason)} · ${esc(h.missionReference)} · ${h.amount??h.totalCost??""} PD${(h.rows??[]).map(r=>trHTML`<br>${esc(SKILLS.find(s=>s.key===r.skillKey)?.label??r.skillKey)}: ${r.oldValue} → ${r.newValue} · ${r.cost} PD · ${esc(r.rule)}`).join("")}</p>`).join("")}</div>${game.user.isGM?trHTML`<label>Revertir mejora<select name="refund"><option value="">Ninguna</option>${history.filter(h=>h.kind==="expenditure"&&!refunded.has(h.id)).map(h=>`<option value="${esc(h.id)}">${esc(h.reason)} · ${h.totalCost} PD</option>`).join("")}</select></label>${field("reason",tr("Motivo obligatorio para revertir"))}`:""}`,tr("Cerrar / revertir"));
    if(values?.refund)return service.refund(actor,values.refund,{reason:values.reason});return;
  }
  if(!game.user.isGM)throw Error(tr("Solo el DJ puede gestionar PD."));
  if(op==="tracking")return service.enableTracking(actor,!service.isEnabled(actor));
  if(op==="reset"){
    if(await foundry.applications.api.DialogV2.confirm({window:{title:tr("Nueva aventura")},content:staticMarkup("<p>¿Reiniciar contadores de habilidades utilizadas? Se conservan habilidades, PD, restricciones e historial.</p>")}))return service.resetUsage(actor);return;
  }
  if(op==="correct"){
    const values=await form(tr("Corregir PD"),`${field("delta",tr("Ajuste positivo o negativo"),0,"number")}${field("reason",tr("Motivo obligatorio"))}`);
    if(values)return service.correct(actor,Number(values.delta),values);return;
  }
  const values=await form(op==="award"?tr("Conceder PD"):tr("Restringir habilidades"),trHTML`${op==="award"?field("amount",tr("Concesión sugerida (libro: aproximadamente 4 PD)"),game.settings.get("paranoia-2-edition","defaultDevelopmentAward"),"number"):""}${field("reason",tr("Motivo visible al propietario"),op==="award"?tr("Desarrollo tras la aventura"):tr("Restricción del DJ"))}<label>Habilidades permitidas<select name="restriction"><option value="keep">Conservar restricciones</option><option value="all">Todas</option><option value="used">Limitar mejora a habilidades utilizadas</option><option value="choose">Selección manual</option></select></label>${eligibleInputs(actor)}${op==="award"?staticMarkup('<label><input type="checkbox" name="resetUsage"> Reiniciar usos para la siguiente aventura</label><label>Aviso<select name="notification"><option value="none">Sin chat</option><option value="owner">Privado al propietario / DJ</option><option value="public">Público (solo cantidad)</option></select></label>'):""}`,op==="award"?tr("Conceder PD"):tr("Aplicar restricción"));
  if(!values)return;
  if(op==="award")return service.award(actor,Number(values.amount),{...values,resetUsage:!!values.resetUsage});
  if(values.restriction==="keep")return;
  const keys=values.restriction==="used"?actor.system.development.usage.filter(r=>r.count>0).map(r=>r.skillKey):values.eligibleSkills;
  return service.restrictSkills(actor,keys,values.restriction!=="all",values);
}
const busy=new WeakSet();
export async function developmentAction(_e,target){if(busy.has(this))return;busy.add(this);try{await action(this.actor,target.dataset.developmentOperation);await this.render();}catch(error){ui.notifications.error(error.message);}finally{busy.delete(this);}}
