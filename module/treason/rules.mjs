import {localizedRecord,tr,trHTML} from "../i18n/index.mjs";
export const NS = "paranoia-2-edition";
export const CATEGORIES = Object.freeze(localizedRecord({suspiciousAction:"Acción sospechosa", accusation:"Acusación", mutantPower:"Poder mutante", secretSociety:"Sociedad secreta", missionReport:"Informe final", computerOrder:"Orden del Ordenador", equipment:"Equipo", other:"Otro"}));
// Annex B is unavailable. Worlds may configure their own suggestions; none are official.
export const treasonOffenses = new Map();
export function integer(value, label=tr("Cantidad")) {
  if(typeof value!=="number" || !Number.isSafeInteger(value)) throw Error(trHTML`${label}: se requiere un entero.`);
  return value;
}
export function initialRecord(type) {
  if(!["character","npc"].includes(type)) throw Error(tr("Solo los ciudadanos pueden tener PT."));
  return {enabled:type==="character",points:1,declaredTraitor:false,bounty:null,history:[],trust:[]};
}
export function adjustRecord(record, delta, options={}, metadata={}) {
  integer(delta); integer(record.points,tr("PT"));
  if(!record.enabled) throw Error(tr("Seguimiento de traición desactivado."));
  const reason=String(options.reason??"").trim();
  if(!reason) throw Error(tr("Indica el motivo del cambio."));
  const category=options.category??"other";
  if(!Object.hasOwn(CATEGORIES,category)) throw Error(tr("Categoría no válida."));
  const next=structuredClone(record), previous=record.points;
  next.points=Math.max(0,Math.min(20,previous+delta));
  if(options.declare || (previous<20 && next.points===20)) next.declaredTraitor=true;
  if(options.revoke) next.declaredTraitor=false;
  if(Object.hasOwn(options,"bounty")) {
    if(options.bounty!==null && (!Number.isFinite(options.bounty)||options.bounty<0)) throw Error(tr("Recompensa no válida."));
    next.bounty=options.bounty;
  }
  next.history.push({...metadata,previous,delta:next.points-previous,requestedDelta:delta,current:next.points,
    reason,category,relatedActor:options.relatedActor??null,notes:String(options.notes??""),
    previousDeclaredTraitor:record.declaredTraitor,declaredTraitor:next.declaredTraitor,previousBounty:record.bounty,bounty:next.bounty,
    event:options.revoke?"revoke":options.declare?"declare":"adjust"});
  return next;
}
export function computerTrust(die, points) {
  integer(die,tr("Dado"));integer(points,tr("PT"));
  if(die<1||die>20||points<0||points>20)throw Error(tr("Tirada o umbral fuera de rango."));
  return {die,points,success:die>points};
}
