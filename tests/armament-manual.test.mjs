import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {weaponProfileUpdate,selectWeaponProfile} from "../module/items/weapon-profiles.mjs";
import {ITEM_SKILLS,ITEM_CLEARANCES,WEAPON_CATEGORIES} from "../module/items/config.mjs";
const weapons=JSON.parse(await readFile(new URL("../packs-source/weapons.json",import.meta.url)));
const armor=JSON.parse(await readFile(new URL("../packs-source/armor.json",import.meta.url)));
const weapon=id=>weapons.find(w=>w.catalogId===id);
test("manual distinguishes normal damage, malfunction damage, area and range",()=>{
  assert.equal(weapon("flamethrower").system.damageNotation,"E11");
  assert.equal(weapon("flamethrower").system.sourceDetails.malfunctionDamageCode,"C9");
  assert.equal(weapon("neural-whip").system.damageNotation,"E10");
  assert.equal(weapon("water-gun").name,"Lanzaagujas");
  assert.equal(weapon("water-gun").system.damageNotation,"PP8");
  assert.equal(weapon("web-launcher").system.maxRangeMeters,50);
  assert.equal(weapon("web-launcher").system.sourceDetails.webLengthMeters,4);
  assert.equal(weapon("web-launcher").system.damageNumber,0);
  assert.equal(weapon("gauss-cannon").system.damageNotation,"E9");
});
test("all ten armor rows use their printed codes without inferring the starter uniform",()=>{
  const expected={"insulating-suit":["all",1],"asbestos-suit":["campaign",4],"combat-armor":["all",7],"plate-armor":["projectile",3],"chainmail-armor":["projectile",2],"leather-armor":["projectile",1],"faraday-suit":["energy",4],"kevlar-armor":["projectile",3],"reflect-armor":["laser",4],"battle-suit":["all",4]};
  for(const [id,[type,value]]of Object.entries(expected)){const s=armor.find(a=>a.catalogId===id).system;assert.deepEqual(s.protections,[{type,value}]);}
  assert.equal(armor.find(a=>a.catalogId==="standard-troubleshooter-uniform").system.protectionValue,null);
});
test("ammo selection preserves inventory and reports unknown gas damage rather than inventing it",()=>{
  const system={...weapon("cone-rifle").system,ammoCurrent:4,charges:{value:4,max:6}};
  const before=JSON.stringify(system),update=weaponProfileUpdate(system,"piercing");
  assert.equal(update["system.damageNumber"],17);assert.equal(update["system.weaponCategory"],"piercingProjectile");assert.equal(update["system.maxRangeMeters"],200);
  assert.equal(update["system.ammoCurrent"],undefined);assert.equal(update["system.charges"],undefined);assert.equal(JSON.stringify(system),before);
  assert.equal(weaponProfileUpdate(system,"gas")["system.damageNumber"],null);
  assert.equal(weaponProfileUpdate(system,"tacnuke")["system.damageNumber"],30);
  assert.throws(()=>weaponProfileUpdate(system,"missing"));
});
test("profiles require ownership and an editable sheet",async()=>{
  let writes=0;const item={isOwner:false,system:weapon("cone-rifle").system,update:async()=>writes++};
  await assert.rejects(()=>selectWeaponProfile.call({item,isEditable:true},null,{dataset:{profile:"piercing"}}));
  item.isOwner=true;await assert.rejects(()=>selectWeaponProfile.call({item,isEditable:false},null,{dataset:{profile:"piercing"}}));
  assert.equal(writes,0);await selectWeaponProfile.call({item,isEditable:true},null,{dataset:{profile:"piercing"}});assert.equal(writes,1);
});
test("catalogue uses existing canonical skill, clearance and damage categories",()=>{
  for(const item of [...weapons,...armor]){const s=item.system;if(s.skill)assert.ok(ITEM_SKILLS.some(k=>k.key===s.skill),item.catalogId);if(s.securityClearance)assert.ok(ITEM_CLEARANCES.includes(s.securityClearance),item.catalogId);if(s.weaponCategory)assert.ok(Object.hasOwn(WEAPON_CATEGORIES,s.weaponCategory),item.catalogId);}
});
