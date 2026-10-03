import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {messageKey,tr,trHTML,localizedRecord} from "../module/i18n/index.mjs";
import {documentText,documentView,preserveTranslatedFields} from "../module/i18n/documents.mjs";
import {LABELS} from "../module/sheets/labels.mjs";
import {ITEM_SKILLS,canonicalSkill} from "../module/items/config.mjs";
import {SOCIETY_REGISTRY,identifySociety,societyDisplayName} from "../module/societies/registry.mjs";
import {identifyPower,POWER_NAMES} from "../module/powers/registry.mjs";
const dictionaries={};
for(const lang of ["es","en"])dictionaries[lang]=JSON.parse(await readFile(new URL(`../lang/${lang}.json`,import.meta.url),"utf8"));
function use(lang){globalThis.game={i18n:{lang,localize:key=>key.split(".").reduce((v,k)=>v?.[k],dictionaries[lang])??key}};}
test("Spanish and English have identical keys, stable IDs and complete original native keys",()=>{
  function keys(value,prefix=""){return Object.entries(value).flatMap(([k,v])=>typeof v==="object"?keys(v,prefix+k+"."):[prefix+k]);}
  assert.deepEqual(keys(dictionaries.es).sort(),keys(dictionaries.en).sort());
  assert.ok(Object.keys(dictionaries.en.P2.Text).length>2700);
  for(const [key,value]of Object.entries(dictionaries.es.P2.Text))assert.equal(messageKey(value),"P2.Text."+key);
});
test("language selected after module load changes labels and computed skill choices, never skill keys",()=>{
  use("en");assert.equal(LABELS.credits,"Credits");assert.equal(ITEM_SKILLS.find(s=>s.key==="agility.grenade").groupLabel,"Agility");
  const key=ITEM_SKILLS[0].key;assert.equal(canonicalSkill(key),key);
  use("es");assert.equal(LABELS.credits,"Créditos");assert.equal(ITEM_SKILLS.find(s=>s.key==="agility.grenade").groupLabel,"Agilidad");
  delete globalThis.game;
});
test("tagged HTML translates static text across interpolated attributes and leaves private user text verbatim",()=>{
  use("en");const reason="<p>Créditos</p>",id="Sociedad Secreta";
  const html=trHTML`<label data-id="${id}">Nombre<input name="name" value="${reason}"></label><p>${reason}</p>`;
  assert.equal(html,`<label data-id="${id}">Name<input name="name" value="${reason}"></label><p>${reason}</p>`);
  assert.equal(tr("Un nombre inventado por el jugador"),"Un nombre inventado por el jugador");delete globalThis.game;
});
test("canonical society and power identities accept English presentation without rewriting Spanish values",()=>{
  use("en");assert.equal(societyDisplayName({societyKey:"sierraClub"}),"Sierra Club");assert.equal(SOCIETY_REGISTRY.sierraClub.displayName,"Club Sierra");
  assert.equal(identifySociety("Sierra Club").key,"sierraClub");assert.equal(identifyPower("Telepathy").key,"telepathy");assert.ok(POWER_NAMES.includes("Telepatía"));
  assert.equal(societyDisplayName({societyKey:"custom",custom:{name:"Club Sierra"}}),"Club Sierra");delete globalThis.game;
});
test("catalogue translation is reversible presentation; user changes and unrelated form data survive",()=>{
  use("en");const doc={name:"Pistola Láser",flags:{"paranoia-2-edition":{catalogId:"laser-pistol"}},system:{description:"Pistola con cargas láser desmontables y codificadas por color."}};
  assert.equal(documentText(doc),"Laser Pistol");
  const submission={name:"Laser Pistol",system:{description:documentText(doc,"system.description"),quantity:2}};preserveTranslatedFields(doc,submission);
  assert.equal(submission.name,doc.name);assert.equal(submission.system.description,doc.system.description);assert.equal(submission.system.quantity,2);
  const renamed={...doc,name:"Mi Pistola Láser"};assert.equal(documentText(renamed),"Mi Pistola Láser");
  const custom={name:"Pistola Láser",system:{}};assert.equal(documentText(custom),"Pistola Láser");
  const edited={name:"My special weapon",system:{description:"Player description"}};preserveTranslatedFields(doc,edited);assert.equal(edited.name,"My special weapon");
  use("es");assert.equal(documentText(doc),doc.name);delete globalThis.game;
});
test("getter-backed records preserve selectors and numeric metadata",()=>{
  use("en");const source={id:"sierraClub",label:"Club Sierra",cost:0.5},record=localizedRecord(source);
  assert.equal(record.id,"sierraClub");assert.equal(record.label,"Sierra Club");assert.equal(record.cost,0.5);assert.equal(source.label,"Club Sierra");delete globalThis.game;
});

test("nested vehicle views and template embedded Items translate without mutating source or custom text",async()=>{
  use("en");const entries=JSON.parse(await readFile(new URL("../packs-source/vehicles.json",import.meta.url),"utf8")),entry=entries.find(e=>e.system.vehicle.movement.modes.some(m=>m.label==="Tierra"));
  const doc={...entry,flags:{"paranoia-2-edition":{catalogId:entry.catalogId}}},view=documentView(doc,"system.vehicle");
  assert.equal(view.movement.modes.find(m=>m.key==="land").label,"Land");assert.equal(doc.system.vehicle.movement.modes.find(m=>m.key==="land").label,"Tierra");
  doc.system.vehicle.movement.modes.find(m=>m.key==="land").notes="Mi nota personalizada";assert.equal(documentView(doc,"system.vehicle").movement.modes.find(m=>m.key==="land").notes,"Mi nota personalizada");
  const robots=JSON.parse(await readFile(new URL("../packs-source/robots.json",import.meta.url),"utf8")),robot=robots.find(e=>e.items.some(i=>i.name==="Medicina 4")),item={...robot.items.find(i=>i.name==="Medicina 4"),id:"test-program"},index=robot.items.findIndex(i=>i.name==="Medicina 4");
  const contents=robot.items.map((i,n)=>n===index?item:{...i,id:String(n)});item.parent={flags:{"paranoia-2-edition":{catalogId:robot.catalogId}},items:{contents}};
  assert.equal(documentText(item),"Medicine 4");assert.equal(item.name,"Medicina 4");assert.equal(preserveTranslatedFields(item,{name:"Medicine 4"}).name,"Medicina 4");delete globalThis.game;
});

test("settings registered before i18n loads retain native message IDs and resolve in either language",async()=>{
  const registered=[];globalThis.game={settings:{register:(namespace,key,options)=>registered.push({key,...options})}};
  const {registerOptionalSettings}=await import("../module/combat/optional/settings.mjs");registerOptionalSettings();
  assert.equal(registered.length,12);use("en");for(const setting of registered){assert.ok(setting.name.startsWith("P2.Text."));assert.notEqual(game.i18n.localize(setting.name),setting.name);assert.notEqual(game.i18n.localize(setting.hint),setting.hint);}
  assert.ok(game.i18n.localize(registered.find(s=>s.key==="optionalCombat.burstFire").name).startsWith("Optional combat:"));use("es");assert.equal(game.i18n.localize(registered[0].name),"Reglas de combate opcionales");delete globalThis.game;
});
