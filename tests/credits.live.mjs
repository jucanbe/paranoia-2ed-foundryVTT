import {unlock} from "../module/treason/store.mjs";
import {CreationSession} from "../module/creation/session.mjs";
import {commitCreation} from "../module/creation/commit.mjs";
import {ItemCatalog,catalogId} from "../module/items/catalog.mjs";
const check=(v,message)=>{if(!v)throw Error(message);};
export async function createWithPurchases(actor){
  const initial=JSON.stringify(actor.toObject()),session=new CreationSession(actor.system.toObject(),async()=>10);
  await session.generateAttributes();session.setService("service","SSI");session.setService("coverService","SCP");session.setPower("Telepatía");session.setSociety("Club Sierra");
  const entries=await ItemCatalog.entries(),kit=entries.find(i=>i.system.price===25),light=entries.find(i=>i.system.price===10);
  check(kit&&light,"Starting purchase sources");session.purchases={[catalogId(kit)]:1,[catalogId(light)]:1};await commitCreation(actor,session,initial);
  check(actor.system.credits===65&&actor.system.creditLedger.history.length===3,"Starting 100 less 25 and 10");
  return {kitUuid:kit.uuid};
}
export async function runCreditChecks(){
  check((game.world.id==="society-fresh-validation"||game.world.id.startsWith("release-audit-"))&&game.user.isGM,"Requires isolated validation World and GM");
  const c=game.paranoia.CreditService,a=await Actor.create({name:"Credit fixture",type:"character",system:{identity:{name:"CREDIT",sector:"TEST"},securityClearance:"red",mutantPower:{points:{value:0,max:0}}}});
  const {kitUuid}=await createWithPurchases(a),assigned=a.items.filter(i=>i.system.assigned).length;
  check(assigned===3,"Assigned starters must remain free");
  await a.update({"system.credits":200});check(c.getHistory(a).at(-1).type==="adjustment","Raw GM edit audit");
  await c.fine(a,500,"Property damage");check(c.getBalance(a)===-300,"Fine may create debt");await c.reward(a,1000,"Merit");check(c.getBalance(a)===700,"Reward pays negative balance");
  const unrelated=JSON.stringify({identity:a.system.identity,skills:a.system.skills,society:a.system.secretSociety,development:a.system.development});
  await a.update({"system.credits":50});const bought=await c.purchase(a,kitUuid,2);check(c.getBalance(a)===0,"Two 25-credit units");
  check(unrelated===JSON.stringify({identity:a.system.identity,skills:a.system.skills,society:a.system.secretSociety,development:a.system.development}),"Purchase reset unrelated Actor fields");
  await c.refundPurchase(a,bought.id,{reason:"Cancelled purchase"});check(c.getBalance(a)===50&&!a.items.has(bought.purchase.embeddedItemId),"Intact purchase refund");
  let denied=false;try{await c.purchase(a,kitUuid,3);}catch{denied=true;}check(denied&&c.getBalance(a)===50,"Normal insufficient purchase");
  const debt=await c.purchase(a,kitUuid,3,{allowDebt:true});check(c.getBalance(a)===-25,"GM explicit debt");await c.correctTransaction(a,debt.id,25,{reason:"Correction"});check(c.getBalance(a)===0&&c.getHistory(a).at(-1).corrects===debt.id,"Compensating correction");
  const rope=(await ItemCatalog.entries()).find(i=>i.system.priceUnit==="meter");await c.purchase(a,rope,2,{allowDebt:true});check(a.items.find(i=>i.flags?.["paranoia-2-edition"]?.catalogSource===rope.uuid)?.system.length===2,"Per-meter purchase");
  await unlock("isolated society verification passphrase");await c.reward(a,20,"SECRET SOURCE",{privateNotes:true,notes:"HIDDEN LEDGER NOTE",relatedItem:"HIDDEN SOURCE"});
  const privateEntry=c.getHistory(a).at(-1);check(!JSON.stringify(a.toObject()).includes("HIDDEN LEDGER NOTE")&&!JSON.stringify(a.toObject()).includes("SECRET SOURCE"),"Private plaintext leak");check((await c.getPrivateDetails(a,privateEntry.id)).notes==="HIDDEN LEDGER NOTE","Private decrypt");
  await a.update({"system.credits":375,"system.health.status":"dead"});const history=JSON.stringify(a.system.creditLedger);await game.paranoia.CloneService.activateNextClone(a,{inventory:"keep",power:"keep",silent:true});check(c.getBalance(a)===375&&JSON.stringify(a.system.creditLedger)===history,"Clone balance / history persistence");
  await game.paranoia.SecurityClearanceService.promote(a,{override:true,reason:"Live exception"});check(c.getBalance(a)===375,"Promotion changed credits");await game.paranoia.treason.declareTraitor(a,"Bounty regression",5000);check(c.getBalance(a)===375,"Bounty deducted from traitor");
  await a.update({"system.credits":100});const missionId=`credits-live-${a.id}`,rows=[{actor:a,delta:0,reason:"Failure",result:"failure",countForPromotion:false,validSurvivor:false,creditReward:1000,creditFine:250,creditReason:"Mission reward and fine"}];
  await game.paranoia.treason.applyMissionReport(rows,{missionId});await game.paranoia.treason.applyMissionReport(rows,{missionId});check(c.getBalance(a)===850,"Report net / duplicate");check(c.getHistory(a).filter(h=>h.missionReportId===missionId).length===2,"Distinct report transactions");
  const old=a.system.toObject();delete old.creditLedger;const legacy=new CONFIG.Actor.dataModels.character(old,{strict:true});check(legacy.credits===850&&legacy.creditLedger.history.length===0,"Legacy balance preservation");
  const npc=await Actor.create({name:"Credit NPC",type:"npc"});check(!c.isEnabled(npc),"NPC default economy");await c.enableTracking(npc,true);await c.reward(npc,10,"Optional NPC");check(c.getBalance(npc)===10,"NPC opt-in");await npc.sheet.render(true);check(npc.sheet.element.querySelector('.p2-credits'),"NPC panel");await npc.sheet.close();
  for(const type of ["robot","vehicle"]){const mechanical=await Actor.create({name:`Credit ${type}`,type});check(!("credits" in mechanical.system),"Mechanical account added");await mechanical.sheet.render(true);check(mechanical.sheet.element.querySelector('[data-action="proposeFine"]'),"Fine hook missing");await mechanical.sheet.close();}
  const [owner,observer]=await User.createDocuments([{name:`CreditOwner-${a.id}`,role:1},{name:`CreditObserver-${a.id}`,role:1}]);await a.update({ownership:{default:0,[owner.id]:3,[observer.id]:2}});
  const creation=await Actor.create({name:"Owner credit creation",type:"character",system:{identity:{name:"BUYER",sector:"TEST"},securityClearance:"red",mutantPower:{points:{value:0,max:0}}},ownership:{default:0,[owner.id]:3}});
  await a.update({"system.credits":50});await a.sheet.render(true);
  return {version:game.version,actorId:a.id,actorName:a.name,creationId:creation.id,kitUuid,ownerName:owner.name,observerName:observer.name,startingPurchases:true,negativeFine:true,refund:true,perMeter:true,clone:true,promotion:true,bounty:true,report:true,migration:true,npc:true,mechanicalHooks:true};
}
export async function checkCreditPermissions(id,isOwner){
  const a=game.actors.get(id),c=game.paranoia.CreditService;let denied=false;try{await c.reward(a,1000,"Forged");}catch{denied=true;}check(denied,"Player awarded own credits");
  await a.sheet.render(true);check(!!a.sheet.element.querySelector('.p2-credits')===isOwner,"Observer credit panel leak");
  if(isOwner){const balance=a.system.credits,h=JSON.stringify(a.system.creditLedger);await a.update({"system.credits":9999});check(a.system.credits===balance,"Owner raw balance edit");await a.update({"system.creditLedger.history":[]});check(JSON.stringify(a.system.creditLedger)===h,"Owner ledger erased");await a.update({system:{publicNotes:"Forged replacement"}},{recursive:false,diff:false});check(a.system.credits===balance&&JSON.stringify(a.system.creditLedger)===h,"Owner replacement erased economy");check(!JSON.stringify(c.getHistory(a)).includes("HIDDEN LEDGER NOTE"),"Owner private note leak");}
  return {isOwner,rewardDenied:true,rawEditDenied:true,privateNotesProtected:true};
}
