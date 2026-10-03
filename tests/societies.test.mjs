import test from "node:test";
import assert from "node:assert/strict";
import {SOCIETY_REGISTRY,SOCIETY_TABLE,identifySociety,societyKeyForRoll,societyName,rankLabel,validateSocietyRegistry} from "../module/societies/registry.mjs";
import {societyReferenceHTML} from "../module/societies/reference.mjs";
import {migrateMembership,newMembership,replaceMembership} from "../module/societies/migration.mjs";
import {requiresPsychicReview,societyForRoll} from "../module/creation/config.mjs";
import {generateProfile,generationOptions} from "../module/npc/generation.mjs";
import * as service from "../module/societies/service.mjs";
import * as store from "../module/treason/ledger.mjs";
import * as treason from "../module/treason/service.mjs";

test("sixteen definitions and one complete society roll table",()=>{
  assert.equal(Object.keys(SOCIETY_REGISTRY).length,16);assert.equal(SOCIETY_TABLE.length,17);
  for(let roll=1;roll<=20;roll++){const key=societyKeyForRoll(roll);assert.ok(key==="custom"||SOCIETY_REGISTRY[key]);assert.equal(societyForRoll(roll),SOCIETY_REGISTRY[key]?.displayName??"Otra");}
  assert.equal(societyKeyForRoll(15),"psionics");assert.equal(societyKeyForRoll(20),"custom");
  assert.ok(requiresPsychicReview("Psiónicos"));assert.ok(requiresPsychicReview("psionics"));
  assert.equal(validateSocietyRegistry(),true);
  assert.equal(service.areAllies("humanists","sierraClub"),false);
  assert.equal(service.areAllies("sierraClub","humanists"),true);
  assert.equal(service.areEnemies("antimutants","psionics"),true);
  assert.deepEqual(SOCIETY_REGISTRY.communists.enemies,[]);
});
test("legacy aliases, numeric and descriptive ranks, custom names and notes survive migration",()=>{
  for(const [name,key] of [["Leopardo de la Muerte","deathLeopards"],["Iglesia Primitiva","firstChurchChristProgrammer"],["Purgadores Cristo Programador","purgers"]]){
    assert.equal(identifySociety(name).key,key);
    const m=migrateMembership({name,rank:"2",notes:"Keep"});assert.equal(m.societyKey,key);assert.equal(m.name,"");assert.deepEqual(m.rank,{level:2,label:""});assert.equal(m.notes,"Keep");
  }
  const custom=migrateMembership({name:"Mi grupo",rank:"Veterano",notes:"Historia"});assert.equal(custom.custom.name,"Mi grupo");assert.equal(custom.rank.label,"Veterano");assert.equal(societyName(custom),"Mi grupo");
  assert.deepEqual(migrateMembership({notes:"Only patch"}),{notes:"Only patch"});
  assert.deepEqual(migrateMembership(custom),custom);
  assert.equal(migrateMembership("Club Sierra").societyKey,"sierraClub");
  assert.equal(migrateMembership("Los nuevos").custom.name,"Los nuevos");
  assert.equal(migrateMembership({societyKey:"Club Sierra",rank:3,notes:"Keep"}).societyKey,"sierraClub");
  assert.equal(migrateMembership({societyKey:"unknown",notes:"Keep"}).custom.name,"unknown");
  const favor=migrateMembership({favors:[{description:"Old",resolved:true}]}).favors[0];
  assert.equal(favor.status,"resolved");assert.equal(favor.type,"favor");
});
test("society-specific ranks and future development metadata resolve centrally",()=>{
  assert.equal(rankLabel({societyKey:"deathLeopards",rank:{level:2,label:""}}),"Persona Auténtica");
  assert.equal(rankLabel({societyKey:"humanists",rank:{level:2,label:""}}),"");
  assert.equal(rankLabel({societyKey:"deathLeopards",rank:{level:2,label:"Custom"}}),"Custom");
  assert.equal(SOCIETY_REGISTRY.sierraClub.development.skillCostMultipliers["perception.survival"],0.5);
  assert.deepEqual(SOCIETY_REGISTRY.psionics.rankHooks,["additionalPsionicPowerAccess"]);
  assert.equal(SOCIETY_REGISTRY.psionics.advancement.oncePerLevel,true);
  assert.deepEqual(SOCIETY_REGISTRY.computerPhreaks.development.allowedSkills,["computerSecurity","programming"]);
  assert.deepEqual(SOCIETY_REGISTRY.romantics.development.allowedSkills,["ancientCultures"]);
});
test("all references render readable HTML and keep SSI infiltration out of member views",()=>{
  for(const society of Object.values(SOCIETY_REGISTRY)){
    const html=societyReferenceHTML(society,{isGM:true});
    assert.ok(html.includes(society.displayName));assert.ok(html.includes("Estructura"));assert.ok(html.includes("Jerarquía"));
    assert.equal(html.includes("undefined"),false);assert.equal(html.includes('"key":'),false);
  }
  const church=SOCIETY_REGISTRY.firstChurchChristProgrammer;
  assert.equal(societyReferenceHTML(church).includes("infiltración significativa"),false);
  assert.ok(societyReferenceHTML(church,{isGM:true}).includes("infiltración significativa"));
  assert.equal(societyReferenceHTML({name:"<script>"}).includes("<script>"),false);
});
test("changing affiliations archives membership without recursively copying its private cipher",()=>{
  const old={...newMembership("sierraClub"),rank:{level:2,label:""},notes:"Keep",missions:[{id:"mission"}],contacts:[{id:"contact"}],favors:[{description:"Owed"}],exposed:true,gmData:{cipher:"secret"}};
  const next=replaceMembership(old,newMembership("communists"));
  assert.equal(next.membershipHistory[0].status,"former");assert.equal(next.membershipHistory[0].rank.level,2);assert.equal(next.membershipHistory[0].missions[0].id,"mission");
  assert.equal(next.membershipHistory[0].gmData,undefined);assert.deepEqual(next.gmData,old.gmData);assert.equal(next.exposed,false);assert.equal(next.custom.name,"");
});
test("NPC none, random and choose reuse canonical definitions",async()=>{
  const defaults={attributes:{agility:{value:0},mutantPower:{value:0}},skills:{agility:{club:{value:0}}},identity:{},npc:{},mutantPower:{},secretSociety:{name:""}};
  const none=await generateProfile(defaults,generationOptions(),async()=>5);assert.equal(none.secretSociety.societyKey,undefined);
  const random=await generateProfile({...defaults,attributes:{agility:{value:0},mutantPower:{value:0}}},generationOptions({societyMode:"random"}),async()=>15);assert.equal(random.secretSociety.societyKey,"psionics");assert.match(random.secretSociety.notes,/verificar/);
  const chosen=await generateProfile({...defaults,attributes:{agility:{value:0},mutantPower:{value:0}}},generationOptions({societyMode:"choose",societyKey:"sierraClub"}),async()=>5);assert.equal(chosen.secretSociety.societyKey,"sierraClub");
  assert.throws(()=>generationOptions({societyMode:"choose",societyKey:"invented"}));
});

let serial=0,persisted={};const gm={id:"gm",isGM:true},owner={id:"owner",isGM:false},observer={id:"observer",isGM:false};
const actors=[],messages=[],users=[gm,owner,observer];users.activeGM=gm;
globalThis.game={user:gm,users,actors,messages,time:{worldTime:23},settings:{get:()=>structuredClone(persisted),set:async(_ns,_key,value)=>{persisted=structuredClone(value);}},paranoia:{treason}};
globalThis.Hooks={callAll(){}};
globalThis.CONFIG={Actor:{dataModels:{character:class{},npc:class{}}}};
globalThis.foundry={utils:{randomID:()=>`id${++serial}`,escapeHTML:s=>s},documents:{ChatMessage:{create:async data=>{messages.push(data);return data;}}}};
function actor(type="character"){
  let data={secretSociety:{...newMembership("sierraClub"),membershipHistory:[],gmData:null},health:{status:"healthy"},credits:100};
  const a={uuid:`Actor.${++serial}`,name:"DAVID-R-ARO-1",type,items:[],testUserPermission:u=>u.id===owner.id,
    get system(){return {...data,toObject:()=>structuredClone(data)};},
    async update(change){data.secretSociety=structuredClone(change["system.secretSociety"]);return this;}};
  actors.push(a);return a;
}
test("membership services keep GM history GM-only and never add automatic penalties or rewards",async t=>{
  const a=actor(),npc=actor("npc");
  await t.test("GM promotes with append-only private history; owner cannot",async()=>{
    await service.changeRank(a,{level:2,label:""},{reason:"Servicio leal",gmNotes:"GM RANK SECRET"});
    assert.equal(a.system.secretSociety.rank.level,2);assert.equal(JSON.stringify(a.system.toObject()).includes("GM RANK SECRET"),true);
    const secret=await service.privateData(a);assert.equal(service.memberPrivate(secret,a.system.secretSociety).rankHistory[0].oldRank.level,1);
    game.user=owner;assert.equal(service.getMembership(a).rank.level,2);assert.throws(()=>service.changeRank(a,{level:5},{reason:"No"}));await assert.rejects(service.privateData(a));assert.throws(()=>service.getMembership(npc));
    game.user=observer;assert.equal(service.canView(a),false);assert.throws(()=>service.getMembership(a));game.user=gm;
  });
  await t.test("secret mission, contact and favors store member data separately from GM notes",async()=>{
    await service.assignMission(a,{title:"Robar prototipo",description:"Recuperar el prototipo",gmNotes:"GM MISSION SECRET",rewardNotes:"Favor narrativo"});
    await service.addContact(a,{name:"Contacto",role:"Informante",gmNotes:"GM CONTACT SECRET"});
    await service.addFavor(a,"Debe un favor al Club Sierra");
    await service.editMission(a,a.system.secretSociety.missions[0].id,{title:"Nuevo título",description:"Nueva instrucción",gmNotes:"EDITED PRIVATE"});
    assert.equal(a.system.secretSociety.missions[0].title,"Nuevo título");
    assert.equal(JSON.stringify(a.system.toObject()).includes("EDITED PRIVATE"),true);
    const missionPrivate=service.memberPrivate(await service.privateData(a),a.system.secretSociety);
    assert.equal(missionPrivate.missions[a.system.secretSociety.missions[0].id].gmNotes,"EDITED PRIVATE");
    const m=service.getMembership(a);assert.equal(m.missions.length,1);assert.equal(m.contacts.length,1);assert.equal(m.favors.length,1);
    assert.equal(JSON.stringify(a.system.toObject()).includes("GM MISSION SECRET"),false);
    assert.equal(JSON.stringify(a.system.toObject()).includes("GM CONTACT SECRET"),true);
    await service.resolveMission(a,m.missions[0].id,"completed");assert.equal(a.system.secretSociety.missions[0].status,"completed");
    await assert.rejects(service.resolveMission(a,m.missions[0].id,"failed"));assert.equal(treason.getPoints(a),1);assert.equal(a.system.credits,100);assert.equal(a.system.secretSociety.rank.level,2);assert.equal(messages.length,0);
  });
  await t.test("exposure is explicit, one public message, Treason declaration separately chosen",async()=>{
    await service.assignMembership(a,"communists");assert.equal(treason.getPoints(a),1);assert.equal(a.system.secretSociety.membershipHistory.length,1);
    await service.markExposed(a,{publish:true});await service.markExposed(a,{publish:true});assert.equal(messages.length,1);assert.equal(treason.getPoints(a),1);
    await treason.declareTraitor(a,"Afiliación comunista descubierta");assert.equal(treason.getPoints(a),20);assert.equal(treason.checkTraitorStatus(a),true);assert.equal(a.system.health.status,"healthy");
  });
  await t.test("expulsion and replacement preserve former missions and GM-only history",async()=>{
    await service.removeMembership(a);assert.equal(a.system.secretSociety.status,"expelled");
    const archived=a.system.secretSociety.membershipHistory[0];assert.equal(archived.missions.length,1);assert.equal(archived.contacts.length,1);
    const secret=await service.privateData(a);assert.equal(service.memberPrivate(secret,archived).rankHistory.length,1);
    await service.assignMembership(a,"custom",{custom:{name:"Los archivistas"}});assert.equal(a.system.secretSociety.membershipHistory[1].status,"expelled");
    await service.setCustomDefinition(a,{name:"Los archivistas",beliefs:"Conservar documentos"});assert.equal(a.system.secretSociety.custom.beliefs,"Conservar documentos");
  });
});
test("contact references fail safely and favors retain type and resolution",async()=>{
  game.user=gm;const a=actor();
  await service.addContact(a,{name:"Deleted",actorUuid:"Actor.deleted"});
  globalThis.fromUuid=async()=>{throw Error("Deleted");};
  assert.equal(await service.resolveContact(a,a.system.secretSociety.contacts[0].id),null);
  await service.addFavor(a,{title:"Debt",description:"Return equipment",type:"obligation"});
  const favor=a.system.secretSociety.favors[0];assert.equal(favor.type,"obligation");
  await service.resolveFavor(a,favor.id);assert.equal(a.system.secretSociety.favors[0].status,"resolved");
});
test("world custom definitions persist separately and rank hooks run after successful save",async()=>{
  game.user=gm;const a=actor();
  const previousSettings=game.settings,previousHooks=Hooks.callAll;
  let world={},event;
  game.settings={get:(ns,key)=>key==="customSocieties"?structuredClone(world):previousSettings.get(ns,key),set:async(ns,key,value)=>key==="customSocieties"?(world=structuredClone(value)):previousSettings.set(ns,key,value)};
  Hooks.callAll=(name,actor,payload)=>{event={name,actor,payload,persisted:actor.system.secretSociety.rank.level};};
  try{
    await service.saveWorldDefinition("world-archivists",{displayName:"Archivistas",beliefs:"Conservar"});
    await service.assignMembership(a,"world-archivists");
    assert.equal(a.system.secretSociety.societyKey,"custom");
    assert.equal(a.system.secretSociety.custom.worldKey,"world-archivists");
    assert.equal(service.getDefinition("world-archivists").beliefs,"Conservar");
    game.user=owner;await assert.rejects(service.saveWorldDefinition("world-forged",{name:"Forged"}));game.user=gm;
    await service.assignMembership(a,"psionics");
    await service.changeRank(a,{level:2,label:""},{reason:"Avance"});
    assert.equal(event.name,"paranoiaSocietyRankChanged");assert.equal(event.persisted,2);
    assert.equal(event.payload.previousRank.level,1);assert.deepEqual(event.payload.hooks,["additionalPsionicPowerAccess"]);
    assert.deepEqual(a.system.secretSociety.psionicLevels,[2]);
    await service.changeRank(a,{level:1,label:""},{reason:"Descenso"});
    await service.changeRank(a,{level:2,label:""},{reason:"Recuperación"});
    assert.deepEqual(a.system.secretSociety.psionicLevels,[2]);
    assert.equal(a.system.securityClearance,undefined);assert.equal(a.system.credits,100);
  }finally{game.settings=previousSettings;Hooks.callAll=previousHooks;game.user=gm;}
});
