import {tr} from "../i18n/index.mjs";
import {NS,initialRecord} from "./rules.mjs";
import {legacyTreason} from "../migrations/legacy.mjs";
let queue=Promise.resolve();
export function requireGM(){if(!game.user.isGM)throw Error(tr("Solo el DJ puede consultar el registro de traición."));}
export function actorKey(actor){
  if(!actor||!["character","npc"].includes(actor.type))throw Error(tr("Solo los ciudadanos pueden tener PT."));
  return actor.uuid;
}
const empty=()=>({actors:{},clearance:{actions:{},reports:{}}});
function stored(){return structuredClone(game.settings.get(NS,"treasonLedger")??empty());}
export function readRecord(actor){requireGM();return structuredClone(stored().actors?.[actorKey(actor)]??legacyTreason(actor._source?.system??actor.system,actor.type)??initialRecord(actor.type));}
export function readClearanceLedger(){requireGM();return stored().clearance??{actions:{},reports:{}};}
/** Chat is the only persistent submission record; no duplicate request database. */
export function readInbox(){
  requireGM();const inbox={};
  for(const message of game.messages){
    const value=message.getFlag?.(NS,"treasonReport");
    if(!value||!["trust","accusation","proposal"].includes(value.kind)||!String(value.reason??"").trim())continue;
    const actor=game.actors.find(a=>a.uuid===value.actorUuid)??globalThis.fromUuidSync?.(value.actorUuid);
    if(!actor||(!message.author?.isGM&&!actor.testUserPermission(message.author,"OWNER")))continue;
    const recipients=game.users.filter(u=>u.isGM||u.id===message.author.id).map(u=>u.id);
    if(value.public===true){if(message.whisper?.length||value.kind==="proposal")continue;}
    else if(!message.whisper?.length||message.whisper.some(id=>!recipients.includes(id)))continue;
    inbox[message.id]={...structuredClone(value),authorId:message.author.id,timestamp:message.timestamp,status:message.getFlag(NS,"treasonReview")?.status??"pending"};
  }
  return inbox;
}
export function transaction(mutator){
  const result=queue.catch(()=>{}).then(async()=>{
    requireGM();if(game.users.activeGM?.id!==game.user.id)throw Error(tr("El DJ coordinador debe aplicar este cambio."));
    const previous=stored(),stamp=JSON.stringify(previous),next={...empty(),...previous,inbox:readInbox()};
    const before=structuredClone(next.inbox),result=await mutator(next);
    if(JSON.stringify(stored())!==stamp)throw Error(tr("La cuenta o el inventario cambiaron. Revisa y repite."));
    const inbox=next.inbox;delete next.inbox;
    await game.settings.set(NS,"treasonLedger",next);
    for(const [id,entry] of Object.entries(inbox))if(entry.status!==before[id]?.status){
      const message=game.messages.get(id);
      if(message)await message.setFlag(NS,"treasonReview",{status:entry.status,adjudication:entry.adjudication??null});
    }
    Hooks.callAll("paranoiaTreasonChanged");return result;
  });queue=result.catch(()=>{});return result;
}
export function registerLedger(){
  game.settings.register(NS,"treasonLedger",{scope:"world",config:false,type:Object,default:empty()});
  Hooks.once("ready",async()=>{
    if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)return;
    // Transfer only the previous native gameplay ledger. Opaque older data is ignored.
    const settings=game.settings.storage.get("world");
    const old=settings.find(setting=>{
      if(!setting.key.startsWith(`${NS}.`)||setting.key===`${NS}.treasonLedger`)return false;
      try{const data=typeof setting.value==="string"?JSON.parse(setting.value):setting.value;
        return data?.version===2&&data.body?.actors&&Object.values(data.body.actors).every(r=>Number.isSafeInteger(r.points)&&Array.isArray(r.history)&&Array.isArray(r.trust));
      }catch{return false;}
    });
    if(!old)return;
    try{
      const source=typeof old.value==="string"?JSON.parse(old.value):old.value;
      if(source?.version!==2||!source.body?.actors)return;
      const body=source.body,next=empty(),existing=stored();
      for(const key of ["actors","clearance","notices","responses"])if(body[key])next[key]=structuredClone(body[key]);
      for(const key of ["actors","notices","responses"])if(existing[key])next[key]={...next[key],...existing[key]};
      next.clearance={actions:{...next.clearance.actions,...existing.clearance?.actions},reports:{...next.clearance.reports,...existing.clearance?.reports}};
      await game.settings.set(NS,"treasonLedger",next);
      for(const [id,entry] of Object.entries(body.inbox??{})){
        const message=game.messages.get(id);if(!message)continue;
        await message.setFlag(NS,"treasonReport",{kind:entry.kind,actorUuid:entry.actorUuid,accusedUuid:entry.accusedUuid??null,reason:entry.reason,notes:entry.notes??"",public:entry.public===true,category:entry.category??"other"});
        if(!message.getFlag(NS,"treasonReview"))await message.setFlag(NS,"treasonReview",{status:entry.status??"pending",adjudication:entry.adjudication??null});
      }
      // The successful native transfer removes the obsolete source, not a second database.
      await old.delete();Hooks.callAll("paranoiaTreasonChanged");
    }catch(error){ui.notifications.error(error.message);}
  });
}
