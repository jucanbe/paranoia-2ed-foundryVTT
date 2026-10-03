import {tr,trHTML} from "../i18n/index.mjs";
import {SOCIETY_REGISTRY,societyName,MEMBERSHIP_STATUSES,MISSION_STATUSES,MISSION_CATEGORIES} from "./registry.mjs";
import {newMembership,replaceMembership,migrateMembership} from "./migration.mjs";
import {ITEM_SKILLS} from "../items/config.mjs";
const queues=new Map();
const id=()=>foundry.utils.randomID();
const text=value=>String(value??"").trim();
function citizen(actor){if(!["character","npc"].includes(actor?.type))throw Error(tr("La afiliación requiere un ciudadano."));}
function gm(actor){citizen(actor);if(!game.user.isGM)throw Error(tr("Solo el DJ puede gestionar afiliaciones y misiones."));}
export function canView(actor,user=game.user){return !!user?.isGM||(actor?.type==="character"&&actor.testUserPermission(user,"OWNER"));}
export function getMembership(actor){citizen(actor);if(!canView(actor))throw Error(tr("Afiliación confidencial."));const member=migrateMembership(actor.system.secretSociety?.toObject?.()??actor.system.secretSociety);if(!game.user.isGM)delete member.gmData;return member;}
export function worldDefinitions(){return game.settings.get("paranoia-2-edition","customSocieties")??{};}
export function getDefinition(key){return SOCIETY_REGISTRY[key]??worldDefinitions()[key]??null;}
export async function saveWorldDefinition(key,input){
  if(!game.user.isGM)throw Error(tr("Solo el DJ puede gestionar sociedades del Mundo."));
  if(!/^world-[a-zA-Z0-9_-]+$/.test(key))throw Error(tr("Usa una clave estable world-… para la sociedad."));
  if(!text(input.displayName??input.name))throw Error(tr("Introduce un nombre."));
  const definition={key,displayName:text(input.displayName??input.name)};
  for(const field of ["memberDescription","beliefs","objectives","benefits","obligations","specialRules","jargon"])definition[field]=text(input[field]);
  definition.allies=[];definition.enemies=[];definition.relationshipsVerified=false;
  const development=input.development??worldDefinitions()[key]?.development??{},multipliers={};
  for(const [key,value] of Object.entries(development.skillCostMultipliers??{})){
    if(!ITEM_SKILLS.some(skill=>skill.key===key)||typeof value!=="number"||!Number.isFinite(value)||value<=0)
      throw Error(tr("Modificador de desarrollo no válido: usa claves de habilidades existentes y costes positivos."));
    multipliers[key]=value;
  }
  definition.development={scope:development.scope==="creation"?"creation":"postCreation",skillCostMultipliers:multipliers,
    allowedSkills:(development.allowedSkills??[]).filter(key=>ITEM_SKILLS.some(skill=>skill.key===key)),options:[]};
  await game.settings.set("paranoia-2-edition","customSocieties",{...worldDefinitions(),[key]:definition});
  return definition;
}
export function areAllies(a,b){const def=getDefinition(a);return def?.allies.includes(b)?true:def?.relationshipsVerified?false:null;}
export function areEnemies(a,b){const def=getDefinition(a);return def?.enemies.includes(b)?true:def?.relationshipsVerified?false:null;}
export async function privateData(actor){
  gm(actor);const member=getMembership(actor);
  if(!member.gmData)return {memberships:{}};
  return structuredClone(member.gmData.native?member.gmData.value:member.gmData.memberships?member.gmData:{memberships:{}});
}
export function memberPrivate(data,member){return data.memberships[member.id||"legacy"]??={notes:"",rankHistory:[],missions:{},contacts:{}};}
function mutate(actor,callback,{privateEdit=false}={}){
  gm(actor);
  const result=(queues.get(actor.uuid)??Promise.resolve()).catch(()=>{}).then(async()=>{
    const previous=getMembership(actor),stamp=JSON.stringify(actor.system.secretSociety);
    let secret;
    if(privateEdit){secret=await privateData(actor);}
    const next=structuredClone(previous);await callback(next,secret);
    if(privateEdit)next.gmData=structuredClone(secret);
    // Validate before touching the Actor. Membership and GM audit share one document write.
    new CONFIG.Actor.dataModels[actor.type]({...actor.system.toObject(),secretSociety:next},{strict:true});
    if(JSON.stringify(actor.system.secretSociety)!==stamp)throw Error(tr("La afiliación cambió durante la edición. Revisa y repite."));
    if(!await actor.update({"system.secretSociety":next},{paranoiaSocietyEdit:true}))throw Error(tr("No se guardó la afiliación."));
    return getMembership(actor);
  });queues.set(actor.uuid,result);return result;
}
export function assignMembership(actor,key,{custom={},notes=""}={}){
  return mutate(actor,member=>{
    if(key.startsWith("world-")){
      const definition=getDefinition(key);if(!definition)throw Error(tr("Sociedad del Mundo no encontrada."));
      custom={name:definition.displayName,worldKey:key};key="custom";
    }
    if(key==="custom"&&!text(custom.name))throw Error(tr("Introduce el nombre de la sociedad personalizada."));
    const fresh=newMembership(key,{name:text(custom.name),joinedAt:Date.now()});
    if(key==="custom")fresh.custom={...fresh.custom,...custom};
    fresh.notes=text(notes);
    Object.assign(member,replaceMembership(member,fresh));
  });
}
export function changeRank(actor,newRank,{reason,gmNotes=""}={}){
  let previousRank;
  return mutate(actor,(member,secret)=>{
    previousRank=structuredClone(member.rank);
    if(!member.societyKey)throw Error(tr("Asigna primero una sociedad."));
    if(!Number.isSafeInteger(newRank.level)||newRank.level<0)throw Error(tr("El nivel debe ser un entero no negativo."));
    if(!text(reason))throw Error(tr("Indica el motivo del cambio de rango."));
    const rank={level:newRank.level,label:text(newRank.label)};
    if(member.societyKey==="psionics"&&rank.level>member.rank.level){
      member.psionicLevels??=[];
      if(!member.psionicLevels.includes(rank.level))member.psionicLevels.push(rank.level);
    }
    memberPrivate(secret,member).rankHistory.push({id:id(),oldRank:structuredClone(member.rank),newRank:rank,reason:text(reason),timestamp:Date.now(),worldTime:game.time.worldTime,userId:game.user.id,gmNote:text(gmNotes)});
    member.rank=rank;
  },{privateEdit:true}).then(member=>{
    if(previousRank.level!==member.rank.level)Hooks.callAll("paranoiaSocietyRankChanged",actor,{societyKey:member.societyKey,previousRank,newRank:structuredClone(member.rank),hooks:getDefinition(member.societyKey)?.rankHooks??[]});
    return member;
  });
}
export function setStatus(actor,status){
  return mutate(actor,member=>{if(!Object.hasOwn(MEMBERSHIP_STATUSES,status))throw Error(tr("Estado no válido."));member.status=status;});
}
export const removeMembership=actor=>setStatus(actor,"expelled");
export function setGMNotes(actor,notes){return mutate(actor,(member,secret)=>{memberPrivate(secret,member).notes=text(notes);},{privateEdit:true});}
export function setCustomDefinition(actor,definition){return mutate(actor,member=>{
  if(member.societyKey!=="custom")throw Error(tr("Las definiciones oficiales no se modifican."));
  if(!text(definition.name))throw Error(tr("Introduce un nombre."));
  member.custom.worldKey=""; // Editing this membership deliberately detaches its World reference.
  for(const key of ["name","beliefs","objectives","allies","enemies","benefits","obligations","notes"])member.custom[key]=text(definition[key]);
});}
export function assignMission(actor,input){
  return mutate(actor,(member,secret)=>{
    if(!member.societyKey)throw Error(tr("Asigna primero una sociedad."));
    if(!text(input.title)||!text(input.description))throw Error(tr("Introduce título e instrucciones."));
    if(!Object.hasOwn(MISSION_CATEGORIES,input.category??"other"))throw Error(tr("Categoría no válida."));
    const mission={id:id(),title:text(input.title),description:text(input.description),status:"active",category:input.category??"other",assignedBy:text(input.assignedBy),
      rewardNotes:text(input.rewardNotes),consequenceNotes:text(input.consequenceNotes),secretNotes:text(input.secretNotes),createdAt:Date.now(),resolvedAt:null};
    member.missions??=[];member.missions.push(mission);
    if(secret)memberPrivate(secret,member).missions[mission.id]={gmNotes:text(input.gmNotes)};
  },{privateEdit:!!text(input.gmNotes)});
}
export function resolveMission(actor,missionId,status){
  return mutate(actor,member=>{
    if(!Object.hasOwn(MISSION_STATUSES,status)||status==="active")throw Error(tr("Resolución no válida."));
    const mission=member.missions.find(m=>m.id===missionId);if(!mission)throw Error(tr("Misión no encontrada."));
    if(mission.status!=="active")throw Error(tr("La misión ya fue resuelta."));
    mission.status=status;mission.resolvedAt=Date.now();
    // No points, rank, reward, inventory or credit side effects.
  });
}
export function editMission(actor,missionId,input){
  return mutate(actor,(member,secret)=>{
    const mission=member.missions.find(m=>m.id===missionId);if(!mission)throw Error(tr("Misión no encontrada."));
    if(!text(input.title)||!text(input.description))throw Error(tr("Introduce título e instrucciones."));
    for(const key of ["title","description","assignedBy","rewardNotes","consequenceNotes","secretNotes"])if(Object.hasOwn(input,key))mission[key]=text(input[key]);
    if(secret)memberPrivate(secret,member).missions[mission.id]={gmNotes:text(input.gmNotes)};
  },{privateEdit:Object.hasOwn(input,"gmNotes")});
}
export async function resolveContact(actor,contactId){
  const contact=getMembership(actor).contacts?.find(c=>c.id===contactId);
  if(!contact?.actorUuid)return null;
  try{const document=await fromUuid(contact.actorUuid);return document?.documentName==="Actor"&&document.testUserPermission(game.user,"OBSERVER")?document:null;}catch{return null;}
}
export function addContact(actor,input){
  return mutate(actor,(member,secret)=>{
    if(!text(input.name))throw Error(tr("Introduce un nombre de contacto."));
    const contact={id:id(),name:text(input.name),actorUuid:text(input.actorUuid),role:text(input.role),notes:text(input.notes),trustNotes:text(input.trustNotes)};
    member.contacts??=[];member.contacts.push(contact);
    if(secret)memberPrivate(secret,member).contacts[contact.id]={gmNotes:text(input.gmNotes)};
  },{privateEdit:!!text(input.gmNotes)});
}
export function addFavor(actor,input){return mutate(actor,member=>{
  const {description,title="",type="favor"}=typeof input==="string"?{description:input}:input;
  if(!text(description))throw Error(tr("Describe el favor u obligación."));
  if(!["favor","obligation"].includes(type))throw Error(tr("Tipo no válido."));
  member.favors??=[];member.favors.push({id:id(),title:text(title),description:text(description),type,status:"pending",resolved:false,createdAt:Date.now()});
});}
export function resolveFavor(actor,favorId){return mutate(actor,member=>{
  const favor=member.favors.find(f=>f.id===favorId);if(!favor)throw Error(tr("Favor no encontrado."));favor.resolved=true;favor.status="resolved";
});}
export async function markExposed(actor,{publish=false}={}){
  const before=getMembership(actor),result=await mutate(actor,member=>{member.exposed=true;});
  if(publish&&!before.exposed)await foundry.documents.ChatMessage.create({content:trHTML`<p>${foundry.utils.escapeHTML(actor.name)}: afiliación revelada a ${foundry.utils.escapeHTML(societyName(result))}.</p>`});
  return result;
}
export async function proposeDiscovery(actor,{reason,suggestedDelta}={}){
  gm(actor);return game.paranoia.treason.propose({actor,category:"secretSociety",reason:reason||tr("Actividad de sociedad secreta descubierta"),suggestedDelta});
}
