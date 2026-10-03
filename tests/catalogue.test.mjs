import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {purchaseSummary,canPurchase} from "../module/creation/purchases.mjs";
import {STARTER_IDS} from "../module/items/catalog.mjs";
import {creationInventory} from "../module/creation/commit.mjs";
const packs=await Promise.all(["weapons","armor","equipment"].map(async name=>JSON.parse(await readFile(new URL(`../packs-source/${name}.json`,import.meta.url)))));
const entries=packs.flat().map(e=>({...e,flags:{"paranoia-2-edition":{catalogId:e.catalogId,startingPurchase:e.startingPurchase,purchaseMinimumClearance:e.startingPurchase?"red":""}}}));

test("catalogue has unique stable IDs, complete starters, 13 priced purchases, and source-only damage",()=>{
  assert.deepEqual(packs.map(p=>p.length),[41,11,44]);
  assert.equal(new Set(entries.map(e=>e.catalogId)).size,entries.length);
  for(const id of STARTER_IDS)assert.equal(entries.filter(e=>e.catalogId===id).length,1);
  assert.equal(entries.filter(e=>e.startingPurchase).length,13);
  const laser=entries.find(e=>e.catalogId==="laser-pistol");
  assert.equal(laser.system.damageNumber,8);assert.equal(laser.system.maxRangeMeters,50);
  assert.equal(laser.system.price,100);assert.equal(laser.system.securityClearance,"red");
  assert.equal(entries.find(e=>e.catalogId==="axe").system.damageNumber,null);
  assert.equal(entries.find(e=>e.catalogId==="reflect-armor").system.protectionValue,4);
  assert.equal(entries.find(e=>e.catalogId==="standard-troubleshooter-uniform").system.protectionValue,null);
  assert.equal(entries.find(e=>e.catalogId==="flamethrower").system.sourceDetails.malfunctionDamageCode,"C9");
});
test("purchase budget, refunds, exact prices and meters",()=>{
  assert.equal(purchaseSummary({},entries,"red").remaining,100);
  assert.equal(purchaseSummary({flashlight:1,"first-aid-kit":2,plasticord:3},entries,"red").remaining,31);
  assert.equal(purchaseSummary({flashlight:0,plasticord:3},entries,"red").remaining,91);
  assert.throws(()=>purchaseSummary({flashlight:11},entries,"red"));
  assert.equal(purchaseSummary({flashlight:11},entries,"red",true).remaining,-10);
  assert.throws(()=>purchaseSummary({flashlight:-1},entries,"red"));
  assert.throws(()=>purchaseSummary({flashlight:1.5},entries,"red"));
  assert.throws(()=>purchaseSummary({"laser-charge":1},entries,"red"));
  assert.throws(()=>purchaseSummary({missing:1},entries,"red"));
  const prices=[2,2,50,10,100,50,25,100,25,3,25,25,5];
  assert.deepEqual(packs[2].filter(e=>e.startingPurchase).map(e=>e.system.price),prices);
});
test("purchase clearance and explicit GM override",()=>{
  const item=entries.find(e=>e.catalogId==="flashlight");
  assert.equal(canPurchase(item,"infrared"),false);
  assert.equal(canPurchase(item,"red"),true);
  assert.equal(canPurchase({...item,system:{...item.system,securityClearance:"blue"}},"red"),false);
  assert.equal(canPurchase(item,"infrared",true),true);
  assert.throws(()=>purchaseSummary({flashlight:1},entries,"infrared"));
});
test("inventory copies preserve source, do not duplicate starters, and keep meters separate from item quantity",()=>{
  let id=0;globalThis.foundry={utils:{randomID:()=>String(++id).padStart(16,"0")}};
  const documents=entries.map(e=>({...e,uuid:`Compendium.test.${e.catalogId}`,toObject(){return structuredClone({name:e.name,type:e.type,system:e.system,flags:e.flags});}}));
  const actor={items:[]};
  const purchases=purchaseSummary({flashlight:2,plasticord:3},documents,"red");
  const result=creationInventory(actor,documents,purchases);
  assert.equal(result.length,5);
  for(const item of result.slice(0,3))assert.equal(item.system.assigned,true);
  assert.equal(result[3].system.quantity,2);
  assert.equal(result[4].system.quantity,1);assert.equal(result[4].system.length,3);
  assert.equal(documents.find(e=>e.catalogId==="plasticord").system.length,null);
  actor.items=result.map(e=>({toObject:()=>structuredClone(e)}));
  assert.equal(creationInventory(actor,documents,{rows:[]}).length,5);
  assert.throws(()=>creationInventory({items:[]},documents.filter(e=>e.catalogId!==STARTER_IDS[0]),{rows:[]}));
});
