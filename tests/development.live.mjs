import {unlock} from "../module/treason/store.mjs";
import {CreationSession} from "../module/creation/session.mjs";
import {commitCreation} from "../module/creation/commit.mjs";
const check=(v,message)=>{if(!v)throw Error(message);};
export async function runDevelopmentChecks(){
  check((game.world.id==="society-fresh-validation"||game.world.id.startsWith("release-audit-"))&&game.user.isGM,"Requires isolated validation World and GM");
  const d=game.paranoia.DevelopmentService;
  check(game.settings.get("paranoia-2-edition","defaultDevelopmentAward")===4,"Suggested award");
  const a=await Actor.create({name:"Development fixture",type:"character",system:{identity:{name:"DEVELOP",sector:"TEST"},securityClearance:"red",mutantPower:{points:{value:0,max:0}}}});
  const initial=JSON.stringify(a.toObject()),session=new CreationSession(a.system.toObject(),async()=>10);
  await session.generateAttributes();session.setService("service","SSI");session.setService("coverService","SCP");session.setPower("Telepatía");session.setSociety("Club Sierra");await commitCreation(a,session,initial);
  check(d.getAvailable(a)===0&&a.system.development.lifetimeEarned===0,"Creation 30 leaked into development");
  await a.update({"system.skills.perception.medicine.value":19,"system.skills.perception.survival.value":6,"system.skills.dexterity.laserWeapons.value":8});
  await d.award(a,4,{reason:"Live development"});await d.spend(a,"perception.medicine",3);
  check(a.system.skills.perception.medicine.value===22&&d.getAvailable(a)===1,"High skill cap / PD spending");
  await d.spend(a,"perception.survival",2);check(a.system.skills.perception.survival.value===8&&d.getAvailable(a)===0,"Sierra cost");
  const expense=d.getHistory(a).at(-1);await d.refund(a,expense.id,{reason:"Live refund"});check(a.system.skills.perception.survival.value===6&&d.getAvailable(a)===1,"Actual paid refund");
  const before=JSON.stringify(a.toObject());let denied=false;try{await d.spend(a,"perception.medicine",3);}catch{denied=true;}check(denied&&JSON.stringify(a.toObject())===before,"Overspend partially changed Actor");
  const roll=await game.paranoia.rollCheck({actor:a,type:"skill",key:"perception.medicine",createMessage:false});check(roll.finalTarget===22,"Roll clamped");
  check(a.system.development.usage.some(r=>r.skillKey==="perception.medicine"&&r.count===1),"Roll did not count skill use");
  await game.paranoia.rollCheck({actor:a,type:"attribute",key:"strength",createMessage:false});check(a.system.development.usage.length===1,"Attribute counted as skill");
  await d.award(a,0,{reason:"Used-only check",restriction:"used",resetUsage:true});check(a.system.development.restricted&&!d.canImprove(a,"dexterity.laserWeapons"),"Usage restriction");
  await d.restrictSkills(a,[],false,{reason:"Allow all"});await d.correct(a,-1,{reason:"Balance adjustment"});
  await unlock("isolated society verification passphrase");
  const missionId=`dev-failed-${a.id}`,rows=[{actor:a,delta:1,reason:"Failure",result:"failure",countForPromotion:true,validSurvivor:false,developmentAward:4,developmentReason:"Adventure enjoyment"}];
  await game.paranoia.treason.applyMissionReport(rows,{missionId});await game.paranoia.treason.applyMissionReport(rows,{missionId});
  check(d.getAvailable(a)===4&&a.system.securityProgress.successfulMissions===0,"Failure award / duplicate / clearance independence");
  const dev=JSON.stringify(a.system.development),skill=a.system.skills.perception.medicine.value;
  await a.update({"system.health.status":"dead"});await game.paranoia.CloneService.activateNextClone(a,{inventory:"keep",power:"keep",silent:true});
  check(JSON.stringify(a.system.development)===dev&&a.system.skills.perception.medicine.value===skill,"Clone lost development");
  const source=a.system.toObject();delete source.development;const legacy=new CONFIG.Actor.dataModels.character(source,{strict:true});check(legacy.development.available===0&&legacy.skills.perception.medicine.value===22,"Legacy defaults changed skills");
  const npc=await Actor.create({name:"Development NPC",type:"npc"});check(!d.isEnabled(npc),"NPC auto-enabled");await d.enableTracking(npc,true);await d.award(npc,2,{reason:"Recurring NPC"});check(d.getAvailable(npc)===2,"NPC optional development");
  const [owner,observer]=await User.createDocuments([{name:`DevOwner-${a.id}`,role:1},{name:`DevObserver-${a.id}`,role:1}]);await a.update({ownership:{default:0,[owner.id]:3,[observer.id]:2}});
  await a.sheet.render(true);check(a.sheet.element.querySelector(".p2-development"),"Development panel missing");
  return {version:game.version,actorId:a.id,ownerName:owner.name,observerName:observer.name,highSkills:true,creationSeparation:true,rollUsage:true,restriction:true,sierra:true,refund:true,failedMissionAward:true,clone:true,npc:true};
}
export async function checkDevelopmentPermissions(actorId,isOwner){
  const a=game.actors.get(actorId),d=game.paranoia.DevelopmentService;
  let denied=false;try{await d.award(a,100,{reason:"Forged"});}catch{denied=true;}check(denied,"Player award allowed");
  await a.sheet.render(true);check(!!a.sheet.element.querySelector(".p2-development")===isOwner,"Observer received development context");
  if(isOwner){
    const pd=d.getAvailable(a),skill=a.system.skills.perception.medicine.value;
    await a.update({"system.development.available":100});check(d.getAvailable(a)===pd,"Owner forged PD");
    await a.update({"system.skills.perception.medicine.value":100});check(a.system.skills.perception.medicine.value===skill,"Owner bypassed spending");
    await a.update({"system.development.history":[]});check(a.system.development.history.length>0,"Owner erased audit");
    const row=a.sheet.element.querySelector('[name="system.skills.perception.medicine.value"]');check(row?.readOnly,"Post-creation skill field editable");
  }
  return {isOwner,awardDenied:true,observerContextProtected:true};
}
