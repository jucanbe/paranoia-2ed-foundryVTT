import {SOCIETY_REGISTRY,validateSocietyRegistry,societyName} from "../module/societies/registry.mjs";
import {societyReferenceHTML} from "../module/societies/reference.mjs";
import {CreationSession} from "../module/creation/session.mjs";
import {commitCreation} from "../module/creation/commit.mjs";
import {NPCGenerator} from "../module/npc/service.mjs";
import {unlock} from "../module/treason/store.mjs";
import {panel} from "../module/societies/dialogs.mjs";

const check=(condition,message)=>{if(!condition)throw Error(message);};
/** Writes only disposable fixtures in the explicitly named isolated fresh-install World. */
export async function runSocietyIntegrationChecks(){
  check((game.world.id==="society-fresh-validation"||game.world.id.startsWith("release-audit-"))&&game.user.isGM,"Requires the isolated validation World and GM");
  check(validateSocietyRegistry(),"Registry relationships");
  await unlock("isolated society verification passphrase");
  const society=game.paranoia.SecretSocietyService,powers=game.paranoia.MutantPowerService;
  const legacy=await Actor.create({name:"LEGACY-R-TEST-1",type:"character",system:{secretSociety:{name:"Club Sierra",rank:"2",notes:"Preserved legacy note"}}});
  check(legacy.system.secretSociety.societyKey==="sierraClub"&&legacy.system.secretSociety.rank.level===2&&legacy.system.secretSociety.notes==="Preserved legacy note","Legacy Actor data loss");
  const stringActor=await Actor.create({name:"STRING-R-TEST-1",type:"character",system:{secretSociety:"Sociedad desconocida"}});
  check(societyName(stringActor.system.secretSociety)==="Sociedad desconocida","Custom string migration");
  const created=await Actor.create({name:"NEW-R-TEST-1",type:"character",system:{identity:{name:"NEW",sector:"TEST"},securityClearance:"red",mutantPower:{points:{value:0,max:0}}}});
  const initial=JSON.stringify(created.toObject()),session=new CreationSession(created.system.toObject(),async()=>10);
  await session.generateAttributes();session.setService("service","SSI");session.setService("coverService","SCP");session.setPower("Telepatía");session.setSociety("Humanistas");
  await commitCreation(created,session,initial);
  check(created.system.secretSociety.societyKey==="humanists"&&created.system.secretSociety.name==="","Creation canonical key");
  check(!Object.hasOwn(created.system.secretSociety,"beliefs"),"Definition copied into Actor");
  await society.assignMembership(created,"psionics");
  const clearance=created.system.securityClearance,ptBefore=game.paranoia.treason.getPoints(created);
  await society.changeRank(created,{level:2,label:""},{reason:"Verified new level"});
  check(powers.psionicTrainingLevels(created).includes(2),"Missing instruction");
  await powers.learnPsionicPower(created,"mindReading",2);
  check(created.system.mutantPower.name==="Telepatía"&&created.system.mutantPower.learned.length===1,"Original power replaced");
  const pointsBefore=created.system.mutantPower.points.value;
  const useResult=await powers.usePower(created,{powerKey:"mindReading",cost:1,difficulty:"normal",modifier:0,intent:"Disposable learned-power verification"});
  check(useResult.result.powerKey==="mindReading"&&created.system.mutantPower.points.value===pointsBefore-1,"Learned power did not use the existing PM workflow");
  const powerMessage=game.messages.get(useResult.messageId);
  check(powerMessage.whisper.length>0&&powerMessage.whisper.every(id=>game.users.get(id)?.isGM||created.testUserPermission(game.users.get(id),"OWNER")),"Public learned-power message");
  await society.changeRank(created,{level:1,label:""},{reason:"Demotion"});
  await society.changeRank(created,{level:2,label:""},{reason:"Restoration"});
  let repeated=false;try{await powers.learnPsionicPower(created,"mentalBlast",2);}catch{repeated=true;}
  check(repeated&&powers.psionicTrainingLevels(created).length===0,"Repeated level grant");
  await society.assignMission(created,{title:"Member-visible test mission",description:"Private member instruction",gmNotes:"Encrypted mission GM note"});
  await society.addContact(created,{name:"Missing contact",actorUuid:"Actor.deleted"});
  const mission=created.system.secretSociety.missions[0];
  await society.editMission(created,mission.id,{title:mission.title,description:"Updated instruction"});
  check(!JSON.stringify(created.toObject()).includes("Encrypted mission GM note"),"Plaintext GM note");
  const html=await panel(created);check(html.includes("Misiones")&&html.includes("Elegir nuevo poder psiónico")===false,"Panel render or pending instruction");
  await society.resolveMission(created,mission.id,"completed");
  check(created.system.secretSociety.missions[0].status==="completed","Mission resolution persistence");
  await society.markExposed(created);
  check(game.paranoia.treason.getPoints(created)===ptBefore,"Automatic treason points");
  check(created.system.securityClearance===clearance,"Rank changed clearance");
  const membership=JSON.stringify(created.system.secretSociety),learned=JSON.stringify(created.system.mutantPower.learned);
  await created.update({"system.health.status":"dead"});
  await game.paranoia.CloneService.activateNextClone(created,{inventory:"keep",power:"keep",silent:true});
  check(JSON.stringify(created.system.secretSociety)===membership&&JSON.stringify(created.system.mutantPower.learned)===learned,"Clone membership/power loss");
  const [npc]=await NPCGenerator.generate({societyMode:"choose",societyKey:"sierraClub",basicEquipment:false,randomEquipment:false});
  check(npc.system.secretSociety.societyKey==="sierraClub","NPC canonical key");
  const [owner,observer]=await User.createDocuments([{name:`Owner-${created.id}`,role:1},{name:`Observer-${created.id}`,role:1}]);
  await created.update({ownership:{default:0,[owner.id]:3,[observer.id]:2}});
  await npc.update({ownership:{default:0,[owner.id]:3,[observer.id]:2}});
  check(!societyReferenceHTML(SOCIETY_REGISTRY.firstChurchChristProgrammer).includes("infiltración significativa"),"GM note in member reference");
  await created.sheet.render(true);
  return {legacyMigration:true,stringMigration:true,creation:true,missions:true,psionicAdvancement:true,privateLearnedPowerUse:true,noRepeatedGrant:true,clonePreservation:true,noAutomaticPT:true,npc:true,actorId:created.id,npcId:npc.id,ownerName:owner.name,observerName:observer.name};
}

export async function checkPlayerViews(actorId,npcId,isOwner){
  const actor=game.actors.get(actorId),npc=game.actors.get(npcId),service=game.paranoia.SecretSocietyService;
  check(!game.user.isGM,"Requires test player session");
  check(!!(await panel(actor))===isOwner,"Character panel permission mismatch");
  check((await panel(npc))===""&&!service.canView(npc),"NPC information exposed to player");
  const pack=game.packs.get("paranoia-2-edition.societies");
  check(!pack.visible,"GM pack visible to player");
  await actor.sheet.render(true);
  const context=await actor.sheet._prepareContext({});
  check(!!context.secret===isOwner&&!!context.societyPanel===isOwner,"Public sheet context leaked society");
  if(isOwner){
    check(service.getMembership(actor).missions[0].status==="completed","Owner mission view missing");
    let denied=false;try{await game.paranoia.MutantPowerService.learnPsionicPower(actor,"mentalBlast",3);}catch{denied=true;}
    check(denied,"Player power grant accepted");
  }
  return {role:isOwner?"owner":"observer",characterView:isOwner,npcView:false,packVisible:false};
}
