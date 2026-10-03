import {staticMarkup} from "../i18n/index.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import {NS,initialRecord,adjustRecord,computerTrust,integer} from "./rules.mjs";
import {readRecord,readInbox,actorKey,transaction,requireGM,sealReport,openReport} from "./store.mjs";
import {stageMissionReport,resumeMissionReport} from "../clearance/service.mjs";
const esc=value=>foundry.utils.escapeHTML(String(value??""));
const meta=()=>({id:foundry.utils.randomID(),timestamp:Date.now(),worldTime:game.time.worldTime,userId:game.user.id});
const record=(body,actor)=>body.actors[actorKey(actor)]??=initialRecord(actor.type);
function owner(actor,user=game.user){
  actorKey(actor);
  if(!user?.isGM&&!actor.testUserPermission(user,"OWNER"))throw Error(tr("No tienes permiso para actuar por este ciudadano."));
}
export const getPoints=actor=>readRecord(actor).points;
export const getRecord=readRecord;
export const checkTraitorStatus=actor=>readRecord(actor).declaredTraitor;
function change(body,actor,delta,options){
  const before=record(body,actor),after=adjustRecord(before,delta,options,meta());
  body.actors[actorKey(actor)]=after;
  if(options.revoke)for(const notice of Object.values(body.notices??{}))if(notice.actorUuid===actor.uuid&&!notice.published)notice.published=true;
  if(!before.declaredTraitor&&after.declaredTraitor){
    body.notices??={};const id=after.history.at(-1).id;
    body.notices[id]={actorUuid:actor.uuid,name:actor.name,bounty:after.bounty,published:false};
  }
  return structuredClone(after);
}
export async function adjustPoints(actor,delta,options={}){return transaction(body=>change(body,actor,delta,options));}
export const addPoints=(actor,amount,reason)=>{integer(amount);if(amount<0)throw Error(tr("Cantidad negativa."));return adjustPoints(actor,amount,{reason});};
export const removePoints=(actor,amount,reason)=>{integer(amount);if(amount<0)throw Error(tr("Cantidad negativa."));return adjustPoints(actor,-amount,{reason});};
export async function enableTracking(actor,enabled=true){
  if(actor.type!=="npc")throw Error(tr("Solo los PNJ tienen seguimiento opcional."));
  return transaction(body=>{
    const r=record(body,actor);r.enabled=!!enabled;
    r.history.push({...meta(),previous:r.points,delta:0,current:r.points,reason:enabled?tr("Seguimiento activado"):tr("Seguimiento desactivado"),category:"other",event:"tracking"});
    return structuredClone(r);
  });
}
export const declareTraitor=(actor,reason,bounty=null)=>transaction(body=>change(body,actor,20-record(body,actor).points,{reason,declare:true,bounty}));
export const revokeTraitor=(actor,reason)=>adjustPoints(actor,0,{reason,revoke:true});
export const setBounty=(actor,bounty,reason)=>adjustPoints(actor,0,{reason,bounty});
export async function applyMissionReport(rows,options={}){
  if(!rows.length)throw Error(tr("Selecciona al menos un ciudadano."));
  if(Object.hasOwn(options,"missionId")){
    if(typeof options.missionId!=="string"||!options.missionId.trim())throw Error(tr("Indica una referencia de misión única."));
    options={...options,missionId:options.missionId.trim()};
  }
  const seen=new Set();
  const result=await transaction(body=>{
    if(options.missionId&&Object.hasOwn(body.clearance?.reports??{},options.missionId))return stageMissionReport(body,rows,options,[]);
    const records=rows.map(({actor,delta,reason})=>{
    const key=actorKey(actor);if(seen.has(key))throw Error(tr("Ciudadano duplicado."));seen.add(key);
    if(options.missionId&&!record(body,actor).enabled){
      integer(delta);if(delta!==0)throw Error(tr("Activa el seguimiento de traición para modificar PT del PNJ."));
      if(!String(reason??"").trim())throw Error(tr("Indica el motivo."));
      return structuredClone(record(body,actor));
    }
    return change(body,actor,delta,{reason,category:"missionReport"});
    });
    return options.missionId?stageMissionReport(body,rows,options,records):records;
  });
  if(!options.missionId)return result;
  const summary=await resumeMissionReport(options.missionId);
  return result.alreadyApplied?summary.map(row=>({...row,counted:false,alreadyApplied:true})):summary;
}
/** Explicit publication: private threshold events are offered once, never execute or target anyone. */
export async function publishDeclarations(){
  requireGM();
  // Serialize publication with ledger writes; retries find the already-created public card.
  return transaction(async body=>{
    for(const [id,notice] of Object.entries(body.notices??{})){
      if(notice.published)continue;
      if(!game.messages.some(m=>m.getFlag(NS,"treasonDeclaration")===id)){
        await foundry.documents.ChatMessage.create({content:trHTML`<section><strong>ATENCIÓN, CIUDADANO.</strong><p>${esc(notice.name)} HA SIDO DECLARADO TRAIDOR.</p>${notice.bounty===null?"":trHTML`<p>Recompensa: ${esc(notice.bounty)} créditos.</p>`}</section>`,flags:{[NS]:{treasonDeclaration:id}}});
      }
      notice.published=true;
    }
  });
}
export async function rollComputerTrust(actor,{request="",requestId=null}={}){
  requireGM();
  const result=await transaction(async body=>{
    const r=record(body,actor);if(!r.enabled)throw Error(tr("Seguimiento desactivado."));
    const entry=requestId?body.inbox[requestId]:null;
    if(requestId&&(!entry||entry.status!=="pending"||entry.kind!=="trust"||entry.actorUuid!==actor.uuid))throw Error(tr("Solicitud ya resuelta o no válida."));
    const roll=await new foundry.dice.Roll("1d20").evaluate();
    const check=computerTrust(roll.total,r.points),id=requestId??foundry.utils.randomID();
    const detail={...meta(),...check,request:String(request),roll:roll.toJSON(),id};
    r.trust.push(detail);if(entry)entry.status="resolved";
    body.responses??={};body.responses[id]={actorUuid:actor.uuid,name:actor.name,request:String(request),success:check.success,published:false};
    return detail;
  });
  await publishResponses();return result;
}
export async function publishResponses(){
  return transaction(async body=>{
    for(const [id,r] of Object.entries(body.responses??{})){
      if(r.published)continue;
      if(!game.messages.some(m=>m.getFlag(NS,"computerResponse")===id))await foundry.documents.ChatMessage.create({
        content:trHTML`<section><strong>${esc(r.name)}</strong><p>Solicita: ${esc(r.request)}</p><b>EL ORDENADOR: SOLICITUD ${r.success?tr("ACEPTADA"):tr("DENEGADA")}</b></section>`,flags:{[NS]:{computerResponse:id}}});
      r.published=true;
    }
  });
}
/** Authenticated Chat author supplies identity; ciphertext protects private reports from other clients. */
export async function submitReport(payload){
  const actor=await fromUuid(payload.actorUuid);owner(actor);
  if(!game.users.activeGM)throw Error(tr("Se necesita un DJ conectado."));
  if(!["trust","accusation","proposal"].includes(payload.kind))throw Error(tr("Solicitud desconocida."));
  if(!String(payload.reason??"").trim())throw Error(tr("Indica el motivo o solicitud."));
  const box=await sealReport(payload);
  const publicText=payload.kind==="accusation"&&payload.public?trHTML`<p>${esc(actor.name)} acusa a ${esc((await fromUuid(payload.accusedUuid))?.name)}: ${esc(payload.reason)}</p><p>${esc(payload.notes)}</p>`:staticMarkup("<p>Informe privado enviado al Ordenador.</p>");
  return foundry.documents.ChatMessage.create({content:publicText,
    whisper:payload.public?[]:game.users.filter(u=>u.isGM||u.id===game.user.id).map(u=>u.id),
    flags:{[NS]:{treasonReport:{box}}}});
}
export const propose=({actor,category="other",reason,suggestedDelta,notes=""})=>submitReport({kind:"proposal",actorUuid:actor.uuid,category,reason,suggestedDelta,notes,public:false});
export async function receiveReports(){
  requireGM();const known=readInbox();
  for(const message of game.messages){
    const packet=message.getFlag(NS,"treasonReport");if(!packet||known[message.id])continue;
    let value;
    try{
      value=await openReport(packet.box);const actor=await fromUuid(value.actorUuid);owner(actor,message.author);
      if(!["trust","accusation","proposal"].includes(value.kind)||!String(value.reason??"").trim())throw Error(tr("Informe no válido."));
      if(value.kind==="accusation")actorKey(await fromUuid(value.accusedUuid));
      if(value.suggestedDelta!==undefined)integer(value.suggestedDelta);
    }catch{continue;} // Malformed or unauthorized packets cannot mutate citizen records.
    await transaction(body=>{body.inbox[message.id]??={...value,authorId:message.author.id,status:"pending",timestamp:message.timestamp};});
  }
  return readInbox();
}
export async function adjudicateReport(id,{delta=0,reason,disposition="note"}={}){
  return transaction(async body=>{
    const entry=body.inbox[id];if(!entry||entry.status!=="pending"||entry.kind==="trust")throw Error(tr("Informe ya resuelto o no válido."));
    if(!["dismiss","note","apply"].includes(disposition))throw Error(tr("Decisión no válida."));
    if(disposition==="apply"){
      const actor=await fromUuid(entry.kind==="accusation"?entry.accusedUuid:entry.actorUuid);
      change(body,actor,delta,{reason:reason||entry.reason,category:entry.kind==="accusation"?"accusation":entry.category,
        relatedActor:entry.kind==="accusation"?entry.actorUuid:null,notes:entry.notes});
    }
    entry.status=disposition;entry.adjudication={...meta(),delta:disposition==="apply"?delta:0,reason:reason??""};
  });
}
