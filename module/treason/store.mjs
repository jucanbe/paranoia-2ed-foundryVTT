import {tr} from "../i18n/index.mjs";
import {NS,initialRecord} from "./rules.mjs";
import {legacyTreason} from "../migrations/legacy.mjs";
import {createVault,unlockVault,encryptVault,encryptReport,decryptReport,requireSecureContext} from "./crypto.mjs";
let state=null, fingerprint=null, queue=Promise.resolve();
export function requireGM(){if(!game.user.isGM)throw Error(tr("Solo el DJ puede consultar el registro de traición."));}
function requireWriter(){requireGM();if(game.users.activeGM?.id!==game.user.id)throw Error(tr("El DJ coordinador debe aplicar este cambio."));}
const stored=()=>game.settings.get(NS,"treasonVault");
export function isUnlocked(){return !!game.user.isGM&&!!state;}
function current(){
  requireGM();if(!state)throw Error(tr("Desbloquea el registro de traición."));
  if(JSON.stringify(stored())!==fingerprint){state=null;throw Error(tr("El registro cambió en otra sesión. Desbloquéalo de nuevo."));}
  return state;
}
export function actorKey(actor){
  if(!actor||!["character","npc"].includes(actor.type))throw Error(tr("Solo los ciudadanos pueden tener PT."));
  // A linked token and its citizen share the world Actor UUID. Unlinked NPCs keep their own UUID.
  return actor.uuid;
}
export function readRecord(actor){
  const body=current().body,key=actorKey(actor);
  return structuredClone(body.actors[key]??initialRecord(actor.type));
}
export function readInbox(){return structuredClone(current().body.inbox);}
// Additional private ledgers share the existing encrypted vault and GM checks.
export function readClearanceLedger(){return structuredClone(current().body.clearance??{actions:{},reports:{}});}
export function locked(){state=null;fingerprint=null;Hooks.callAll("paranoiaTreasonChanged");}
export async function unlock(password){
  requireGM();requireSecureContext();const data=stored();
  let next;
  if(!data?.version){
    requireWriter();next=await createVault(password,{actors:{},inbox:{}});
    for(const actor of game.actors)if(["character","npc"].includes(actor.type))next.body.actors[actor.uuid]=legacyTreason(actor._source?.system??actor.system,actor.type)??initialRecord(actor.type);
    const encrypted=await encryptVault(next);await game.settings.set(NS,"treasonVault",encrypted);
  }else {
    try{next=await unlockVault(password,data);}catch{throw Error(tr("No se pudo desbloquear: comprueba la frase secreta y el registro guardado."));}
  }
  state=next;
  fingerprint=JSON.stringify(stored());Hooks.callAll("paranoiaTreasonChanged");
  if(game.users.activeGM?.id===game.user.id&&game.actors.some(actor=>["character","npc"].includes(actor.type)&&!next.body.actors[actor.uuid]))await transaction(body=>{
    for(const actor of game.actors)if(["character","npc"].includes(actor.type)&&!body.actors[actor.uuid]){
      body.actors[actor.uuid]=legacyTreason(actor._source?.system??actor.system,actor.type)??initialRecord(actor.type);
    }
  });
}
/** One encrypted World-setting update commits the entire batch. No partial Actor writes. */
export function transaction(mutator){
  const result=queue.catch(()=>{}).then(async()=>{
    requireWriter();const active=current(),next=structuredClone(active.body);
    const result=await mutator(next);
    const encrypted=await encryptVault(active,next);
    current(); // Detect a concurrent session before attempting the commit.
    await game.settings.set(NS,"treasonVault",encrypted);
    active.body=next;fingerprint=JSON.stringify(stored());
    Hooks.callAll("paranoiaTreasonChanged");return result;
  });queue=result.catch(()=>{});return result;
}
export async function sealReport(value){return encryptReport(stored()?.publicKey,value);}
export async function openReport(box){return decryptReport(current().body.privateKey,box);}
export function registerStore(){
  game.settings.register(NS,"treasonVault",{scope:"world",config:false,type:Object,default:{}});
}
