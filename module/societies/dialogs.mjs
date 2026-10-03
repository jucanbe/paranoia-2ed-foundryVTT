import {staticMarkup} from "../i18n/index.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import * as service from "./service.mjs";
import {societyReferenceHTML} from "./reference.mjs";
import {learnPsionicPower,psionicTrainingLevels,availablePowers} from "../powers/service.mjs";
import {POWER_REGISTRY} from "../powers/registry.mjs";
import {SOCIETY_REGISTRY,societyName,societyDisplayName,rankLabel,MEMBERSHIP_STATUSES,MISSION_STATUSES,MISSION_CATEGORIES} from "./registry.mjs";
import {adjustDialog,action as treasonAction} from "../treason/dialogs.mjs";
const esc=v=>foundry.utils.escapeHTML(String(v??""));
const field=(key,label,value="",type="text")=>`<label>${esc(label)}<input name="${key}" type="${type}" value="${esc(value)}" ${type==="number"?'step="1"':''}></label>`;
const area=(key,label,value="")=>`<label>${esc(label)}<textarea name="${key}" rows="3">${esc(value)}</textarea></label>`;
const select=(key,label,options,value="")=>`<label>${esc(label)}<select name="${key}">${Object.entries(options).map(([k,l])=>`<option value="${k}" ${value===k?"selected":""}>${esc(l)}</option>`).join("")}</select></label>`;
async function form(title,content,label=tr("Guardar")){
  const result=await foundry.applications.api.DialogV2.wait({window:{title},position:{width:620},content:`<div class="p2-society-form">${content}</div>`,buttons:[
    {action:"save",label,default:true,callback:(_e,b)=>({data:Object.fromEntries(new FormData(b.form))})},{action:"cancel",label:tr("Cancelar")}]});
  return result?.data??null;
}
async function confirm(title,content){return foundry.applications.api.DialogV2.confirm({window:{title},content:`<p>${esc(content)}</p>`,yes:{label:tr("Confirmar")},no:{label:tr("Cancelar")}});}
export async function panel(actor){
  if(!service.canView(actor))return "";
  const m=service.getMembership(actor),isGM=game.user.isGM;
  return foundry.applications.handlebars.renderTemplate("systems/paranoia-2-edition/templates/societies/panel.hbs",{
    isGM,hasSociety:!!m.societyKey,name:societyDisplayName(m)||tr("Sin sociedad"),rank:{...m.rank,label:m.rank.label||tr(rankLabel(m))},status:MEMBERSHIP_STATUSES[m.status],exposed:m.exposed,notes:m.notes,
    activeMissions:(m.missions??[]).filter(x=>x.status==="active").length,contactCount:m.contacts?.length??0,
    missions:(m.missions??[]).map(x=>({...x,statusLabel:MISSION_STATUSES[x.status],active:x.status==="active"})),contacts:m.contacts??[],favors:(m.favors??[]).map(x=>({...x,typeLabel:x.type==="obligation"?tr("Obligación"):tr("Favor")})),
    former:(m.membershipHistory??[]).map(x=>({...x,rank:{...x.rank,label:x.rank.label||tr(rankLabel(x))},name:societyDisplayName(x),statusLabel:MEMBERSHIP_STATUSES[x.status]})),
    custom:m.societyKey==="custom",psionicTraining:isGM&&psionicTrainingLevels(actor).length>0
  });
}
export async function reference(actor){
  const m=service.getMembership(actor),definition=service.getDefinition(m.custom?.worldKey||m.societyKey)??m.custom;
  const content=societyReferenceHTML(definition??{},{isGM:game.user.isGM,name:societyDisplayName(m)});
  return foundry.applications.api.DialogV2.prompt({window:{title:tr("Referencia confidencial de sociedad")},position:{width:620},content:`<div class="p2-society-form">${content}</div>`,ok:{label:tr("Cerrar")}});
}
async function rankDialog(actor,delta){
  const m=service.getMembership(actor),v=await form(delta>0?tr("Ascender en la sociedad"):tr("Descender / corregir rango"),`${field("level",tr("Nivel"),Math.max(0,m.rank.level+delta),"number")}${field("label",tr("Título (opcional)"),m.rank.label)}${field("reason",tr("Motivo"))}${area("gmNotes",tr("Nota del DJ (privada)"))}`);
  if(v)await service.changeRank(actor,{level:Number(v.level),label:v.label},v);
}
async function privateHistory(actor){
  const m=service.getMembership(actor),data=await service.privateData(actor);
  const content=[m,...m.membershipHistory??[]].map(member=>{
    const p=service.memberPrivate(data,member);
    return `<h3>${esc(societyDisplayName(member))}</h3><p>${esc(p.notes)}</p>${p.rankHistory.map(h=>`<p>${esc(new Date(h.timestamp).toLocaleString())}: ${h.oldRank.level} ${esc(h.oldRank.label)} → ${h.newRank.level} ${esc(h.newRank.label)}<br>${esc(h.reason)}<br>${esc(h.gmNote)}</p>`).join("")}
    ${Object.entries(p.missions).map(([id,entry])=>trHTML`<p>Misión ${esc(member.missions?.find(m=>m.id===id)?.title??id)}: ${esc(entry.gmNotes)}</p>`).join("")}
    ${Object.entries(p.contacts).map(([id,entry])=>trHTML`<p>Contacto ${esc(member.contacts?.find(m=>m.id===id)?.name??id)}: ${esc(entry.gmNotes)}</p>`).join("")}`;
  }).join("");
  return foundry.applications.api.DialogV2.prompt({window:{title:tr("Historial y notas · solo DJ")},position:{width:650},content:`<div class="p2-society-form">${content}</div>`,ok:{label:tr("Cerrar")}});
}
async function discovery(actor){
  const member=service.getMembership(actor);
  const v=await form(tr("Revelar afiliación"),trHTML`<p>${esc(societyDisplayName(member))}. No se aplican PT automáticamente.</p>${member.societyKey==="communists"?staticMarkup("<p><strong>Comunistas: puedes declarar traidor mediante la adjudicación siguiente.</strong></p>"):""}<label><input name="publish" type="checkbox"> Publicar nombre y afiliación en Chat</label>${select("response",tr("Adjudicación del DJ"),{none:tr("Sin cambio de PT"),add:tr("Añadir PT (elegir cantidad)"),declare:tr("Declarar traidor (confirmar)"),custom:tr("Ajuste personalizado de PT")})}`,tr("Revelar"));
  if(!v)return;await service.markExposed(actor,{publish:!!v.publish});
  if(v.response==="add")await adjustDialog(actor,{category:"secretSociety",reason:tr("Afiliación descubierta")});
  if(v.response==="declare")await treasonAction(actor,"declare");
  if(v.response==="custom"){
    const change=await form(tr("Ajuste personalizado de PT"),`${field("delta",tr("Ajuste"),0,"number")}${field("reason",tr("Motivo"),tr("Afiliación descubierta"))}`);
    if(change)await game.paranoia.treason.adjustPoints(actor,Number(change.delta),{reason:change.reason,category:"secretSociety"});
  }
}
async function followUp(actor){
  const v=await form(tr("Misión resuelta"),trHTML`<p>No se han aplicado recompensas, cambios de rango ni PT.</p>${select("followup",tr("Acción opcional"),{none:tr("Terminar"),rank:tr("Ajustar rango"),favor:tr("Anotar favor / obligación"),treason:tr("Proponer revisión de traición")})}`,tr("Continuar"));
  if(v?.followup==="rank")await rankDialog(actor,0);
  if(v?.followup==="favor")await run(actor,"favor");
  if(v?.followup==="treason")await run(actor,"propose");
}
export async function run(actor,operation,entryId){
  if(operation==="reference")return reference(actor);
  if(operation==="openContact"){
    const document=await service.resolveContact(actor,entryId);
    if(document)return document.sheet.render(true);
    return ui.notifications.info(tr("El Actor del contacto no está disponible."));
  }
  if(!game.user.isGM)throw Error(tr("Solo el DJ puede modificar esta información."));
  const m=service.getMembership(actor);
  if(operation==="history")return privateHistory(actor);
  if(operation==="learnPsionic"){
    const known=new Set(availablePowers(actor).map(p=>p.key)),levels=psionicTrainingLevels(actor);
    const v=await form(tr("Instrucción psiónica"),trHTML`<p>El DJ elige un nuevo poder apropiado. Se conserva el original y se usa el mismo Atributo y reserva de PM. Cada nivel concede una única instrucción.</p>${select("level",tr("Nivel pendiente"),Object.fromEntries(levels.map(l=>[l,l])))}${select("key",tr("Poder elegido por el DJ"),Object.fromEntries(Object.values(POWER_REGISTRY).filter(p=>!known.has(p.key)).map(p=>[p.key,p.label])))}`);
    if(v)return learnPsionicPower(actor,v.key,Number(v.level));
  }
  if(operation==="promote"||operation==="demote")return rankDialog(actor,operation==="promote"?1:-1);
  if(operation==="expose")return discovery(actor);
  if(operation==="treason")return adjustDialog(actor,{category:"secretSociety",reason:tr("Descubrimiento de actividad de sociedad secreta")});
  if(operation==="propose"){
    const v=await form(tr("Proponer revisión de traición"),`${field("reason",tr("Motivo"))}${field("suggestedDelta",tr("Ajuste sugerido (opcional)"),"","number")}`,tr("Enviar al buzón del DJ"));
    if(v)return service.proposeDiscovery(actor,{reason:v.reason,suggestedDelta:v.suggestedDelta===""?undefined:Number(v.suggestedDelta)});
  }
  if(operation==="assign"){
    const v=await form(tr("Asignar / cambiar sociedad"),trHTML`<p>La afiliación anterior y sus misiones se conservan en el historial.</p>${select("key",tr("Sociedad"),{...Object.fromEntries([...Object.values(SOCIETY_REGISTRY),...Object.values(service.worldDefinitions())].map(s=>[s.key,SOCIETY_REGISTRY[s.key]?tr(s.displayName):s.displayName])),custom:tr("Otra / personalizada")},m.custom?.worldKey||m.societyKey)}${field("name",tr("Nombre personalizado"))}`);
    if(v)return service.assignMembership(actor,v.key,{custom:{name:v.name}});
  }
  if(operation==="custom"){
    const labels={name:tr("Nombre"),beliefs:tr("Creencias"),objectives:tr("Objetivos"),allies:tr("Aliados"),enemies:tr("Enemigos"),benefits:tr("Beneficios"),obligations:tr("Obligaciones"),notes:tr("Notas")};
    const v=await form(tr("Sociedad personalizada"),Object.entries(labels).map(([k,l])=>area(k,l,m.custom[k])).join(""));
    if(v)return service.setCustomDefinition(actor,v);
  }
  if(operation==="status"){
    const v=await form(tr("Estado de afiliación"),select("status",tr("Estado"),MEMBERSHIP_STATUSES,m.status));
    if(v){if(v.status==="expelled"&&!await confirm(tr("Expulsar de la sociedad"),tr("Se conserva todo el historial. ¿Confirmas la expulsión?")))return;return service.setStatus(actor,v.status);}
  }
  if(operation==="expel"&&await confirm(tr("Expulsar de la sociedad"),tr("Se conservan misiones, contactos y rango. ¿Confirmas la expulsión?")))return service.removeMembership(actor);
  if(operation==="gmNotes"){
    const data=await service.privateData(actor),v=await form(tr("Notas de sociedad · solo DJ"),area("notes",tr("Nota privada del DJ"),service.memberPrivate(data,m).notes));
    if(v)return service.setGMNotes(actor,v.notes);
  }
  if(operation==="mission"){
    const v=await form(tr("Asignar misión secreta"),`<p>${esc(societyDisplayName(m))}</p>${field("title",tr("Título"))}${area("description",tr("Instrucciones"))}${select("category",tr("Tipo orientativo (no tabla oficial)"),MISSION_CATEGORIES)}${field("assignedBy",tr("Asignada por"))}${area("rewardNotes",tr("Beneficio / recompensa narrativa"))}${area("consequenceNotes",tr("Consecuencia del fracaso"))}${area("secretNotes",tr("Notas visibles al miembro"))}${area("gmNotes",tr("Notas del DJ (privadas)"))}`);
    if(v)return service.assignMission(actor,v);
  }
  if(operation==="resolve"){
    const v=await form(tr("Resolver misión secreta"),select("result",tr("Resultado"),{completed:tr("Completada"),failed:tr("Fallida"),cancelled:tr("Cancelada")}));
    if(v){await service.resolveMission(actor,entryId,v.result);return followUp(actor);}
  }
  if(operation==="editMission"){
    const mission=m.missions.find(x=>x.id===entryId);if(!mission)throw Error(tr("Misión no encontrada."));
    const secret=service.memberPrivate(await service.privateData(actor),m).missions[entryId]?.gmNotes??"";
    const v=await form(tr("Editar misión secreta"),`${field("title",tr("Título"),mission.title)}${area("description",tr("Instrucciones"),mission.description)}${field("assignedBy",tr("Asignada por"),mission.assignedBy)}${area("rewardNotes",tr("Recompensa"),mission.rewardNotes)}${area("consequenceNotes",tr("Consecuencias"),mission.consequenceNotes)}${area("secretNotes",tr("Notas del miembro"),mission.secretNotes)}${area("gmNotes",tr("Notas del DJ (privadas)"),secret)}`);
    if(v)return service.editMission(actor,entryId,v);
  }
  if(operation==="contact"){
    const v=await form(tr("Añadir contacto"),`${field("name",tr("Nombre"))}${field("actorUuid",tr("UUID de Actor (opcional)"))}${field("role",tr("Papel"))}${area("notes",tr("Notas del miembro"))}${area("trustNotes",tr("Lealtad / confianza"))}${area("gmNotes",tr("Notas del DJ (privadas)"))}`);
    if(v)return service.addContact(actor,v);
  }
  if(operation==="favor"){
    const v=await form(tr("Favor / obligación"),`${field("title",tr("Título"))}${select("type",tr("Tipo"),{favor:tr("Favor"),obligation:tr("Obligación")})}${area("description",tr("Descripción (sin economía de puntos)"))}`);
    if(v)return service.addFavor(actor,v);
  }
  if(operation==="resolveFavor")return service.resolveFavor(actor,entryId);
}
const busy=new WeakSet();
export async function societyAction(_event,target){
  if(busy.has(this))return;busy.add(this);
  try{await run(this.actor,target.dataset.societyOperation,target.dataset.entryId);await this.render();}
  catch(error){ui.notifications.error(error.message);}finally{busy.delete(this);}
}
