import {CreationSession} from "../module/creation/session.mjs";
import {commitCreation} from "../module/creation/commit.mjs";
import {equipmentWarnings,openDashboard} from "../module/treason/dialogs.mjs";
import {panel} from "../module/clearance/dialogs.mjs";
const check=(v,message)=>{if(!v)throw Error(message);};
export async function runClearanceChecks(){
  check((game.world.id==="society-fresh-validation"||game.world.id.startsWith("release-audit-"))&&game.user.isGM,"Requires isolated validation World and GM");
  
  const s=game.paranoia.SecurityClearanceService,t=game.paranoia.treason;
  const existing=game.actors.find(a=>a.type==="character"),old=existing.system.securityClearance;
  const legacySource=existing.system.toObject();delete legacySource.securityProgress;delete legacySource.clearanceProgressionEnabled;
  const migrated=new CONFIG.Actor.dataModels.character(legacySource,{strict:true});
  check(migrated.securityProgress.successfulMissions===0,"Existing progression defaults");check(migrated.securityClearance===old,"Migration changed clearance");
  const a=await Actor.create({name:"Clearance fixture",type:"character",system:{identity:{name:"DAVID",sector:"ARO"},securityClearance:"red",mutantPower:{points:{value:0,max:0}}}});
  check(a.system.securityProgress.successfulMissions===0,"New defaults");
  const initial=JSON.stringify(a.toObject()),draft=new CreationSession(a.system.toObject(),async()=>10);
  await draft.generateAttributes();draft.setService("service","SSI");draft.setService("coverService","SCP");draft.setPower("Telepatía");draft.setSociety("Club Sierra");await commitCreation(a,draft,initial);
  check(a.system.creation.complete&&a.system.securityClearance==="red"&&a.system.securityProgress.successfulMissions===0,"Creation regression");
  await a.createEmbeddedDocuments("Item",[{name:"Orange access test",type:"equipment",system:{securityClearance:"orange",quantity:1}}]);
  check(equipmentWarnings(a).includes("Orange access test"),"Missing item warning");
  const unrelated=JSON.stringify({items:a.items.map(i=>i.toObject()),credits:a.system.credits,society:a.system.secretSociety,service:a.system.service,power:a.system.mutantPower});
  const missionId=`live-${a.id}`,rows=[{actor:a,result:"success",countForPromotion:true,validSurvivor:true,delta:-1,reason:"Live report"}];
  await t.applyMissionReport(rows,{missionId});check(s.canPromote(a)&&a.system.securityClearance==="red","Report auto-promoted or progress missing");
  await t.applyMissionReport(rows,{missionId});check(a.system.securityProgress.successfulMissions===1,"Report duplicate");
  await s.promote(a,{reason:"Live promotion",notes:"CLEARANCE-PRIVATE-GM-NOTE",missionReference:missionId});
  check(a.name==="DAVID-O-ARO-1"&&a.prototypeToken.name===a.name,"Citizen/prototype identity");
  check(a.system.securityProgress.successfulMissions===0&&s.getNext(a)==="yellow","Reset/derived target");check(equipmentWarnings(a).length===0,"Item warning stale");
  check(unrelated===JSON.stringify({items:a.items.map(i=>i.toObject()),credits:a.system.credits,society:a.system.secretSociety,service:a.system.service,power:a.system.mutantPower}),"Promotion mutated unrelated fields");
  check(!JSON.stringify(a.toObject()).includes("CLEARANCE-PRIVATE-GM-NOTE")&&!JSON.stringify(game.settings.get("paranoia-2-edition","treasonLedger")).includes("CLEARANCE-PRIVATE-GM-NOTE"),"GM note exposed");
  await s.recordSuccessfulMission(a,`second-${a.id}`,{validSurvivor:true});
  const p=JSON.stringify(a.system.securityProgress),h=JSON.stringify(s.getHistory(a));
  await a.update({"system.health.status":"dead"});await game.paranoia.CloneService.activateNextClone(a,{inventory:"keep",power:"keep",silent:true});
  check(a.name==="DAVID-O-ARO-2"&&JSON.stringify(a.system.securityProgress)===p&&JSON.stringify(s.getHistory(a))===h,"Clone progression/history lost");
  await s.demote(a,{reason:"Live demotion"});check(a.name==="DAVID-R-ARO-2"&&a.system.securityProgress.successfulMissions===0,"Demotion/reset");
  await t.declareTraitor(a,"Live conviction");check(!s.canPromote(a),"Traitor promoted");
  check(!(await s.recordSuccessfulMission(a,`traitor-${a.id}`,{validSurvivor:true})).counted,"Traitor counted");await t.revokeTraitor(a,"Test pardon");
  const npc=await Actor.create({name:"Recurring",type:"npc",system:{securityClearance:"red"}});
  check(!s.isEnabled(npc),"NPC default");await s.enableTracking(npc,true,{reason:"Recurring"});await s.recordSuccessfulMission(npc,`npc-${a.id}`,{validSurvivor:true});check(s.canPromote(npc),"NPC opt-in");
  const [owner,observer]=await User.createDocuments([{name:`ClearanceOwner-${a.id}`,role:1},{name:`ClearanceObserver-${a.id}`,role:1}]);
  await a.update({ownership:{default:0,[owner.id]:3,[observer.id]:2}});
  await game.settings.set("paranoia-2-edition","showPromotionProgressToPlayers",true);
  await a.sheet.render(true);check(a.sheet.element.querySelector(".p2-clearance"),"Character panel missing");
  await npc.sheet.render(true);check(npc.sheet.element.querySelector(".p2-clearance"),"NPC panel missing");await npc.sheet.close();
  const dashboard=await openDashboard();check(dashboard.element.textContent.includes("ASCENSOS"),"Dashboard missing");await dashboard.close();
  return {version:game.version,actorId:a.id,npcId:npc.id,ownerName:owner.name,observerName:observer.name,creation:true,report:true,promotion:true,demotion:true,clone:true,GM-onlyHistory:true,itemWarnings:true,npc:true};
}
export async function checkClearancePermissions(actorId,isOwner){
  const a=game.actors.get(actorId),s=game.paranoia.SecurityClearanceService;
  check(!!s.getPromotionRequirements(a)===isOwner,"Owner/observer progress permissions");
  check(!panel(a).includes("Ascender</button>"),"Player GM controls");
  let denied=false;try{await s.promote(a,{reason:"Forbidden",override:true});}catch{denied=true;}check(denied,"Player service allowed");
  if(isOwner){
    const key=a.system.securityClearance,count=a.system.securityProgress.successfulMissions;
    await a.update({"system.securityClearance":"ultraviolet"});check(a.system.securityClearance===key,"Owner direct clearance update allowed");
    await a.update({"system.securityProgress.successfulMissions":99});check(a.system.securityProgress.successfulMissions===count,"Owner forged progress");
    await a.update({"system.creation.complete":false});check(a.system.creation.complete,"Creation bypass allowed");
  }
  await a.sheet.render(true);check(!!a.sheet.element.querySelector(".p2-clearance")===isOwner,"Sheet context privacy");
  check(!a.sheet.element.textContent.includes("CLEARANCE-PRIVATE-GM-NOTE"),"GM history in public view");
  return {isOwner,serviceDenied:true,progressVisible:isOwner,gmHistoryHidden:true};
}
