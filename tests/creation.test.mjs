import test from "node:test";
import assert from "node:assert/strict";
import { CreationSession } from "../module/creation/session.mjs";
import { serviceForRoll, powerForRoll, societyForRoll, skillMaximum } from "../module/creation/config.mjs";
import { LABELS } from "../module/sheets/labels.mjs";
import { buildCitizenId } from "../module/actors/identity.mjs";

function source() {
  return {
    identity: {name: "DAVID", sector: "ARO"}, securityClearance: "red", cloneNumber: 1,
    attributes: Object.fromEntries(Object.keys(LABELS.attributeNames).map(key => [key, {value: 0}])),
    skills: Object.fromEntries(Object.entries(LABELS.skillNames).map(([group, skills]) => [group, Object.fromEntries(Object.keys(skills).map(key => [key, {value: 0}]))])),
    mutantPower: {name: "Old power", notes: "Preserve notes"}, secretSociety: {name: "Old society", rank: "", notes: "Preserve society notes"},
    service: "", health: {status: "", notes: ""}, credits: 25, publicNotes: "Keep public", privateNotes: "Keep private"
  };
}
function session(values = Array(8).fill(5)) {
  const queue = [...values];
  return new CreationSession(source(), async () => { if (!queue.length) throw Error("Roll queue exhausted"); return queue.shift(); });
}

test("eight d20 rolls and two distinct replacement rerolls; third and repeat rejected", async () => {
  const initial = Object.keys(LABELS.attributeNames).map(key => key === "strength" ? 2 : key === "agility" ? 15 : 10);
  const s = session([...initial, 15, 2]);
  await s.generateAttributes();
  assert.equal(Object.keys(s.attributeRolls).length, 8);
  assert.ok(Object.values(s.attributeRolls).every(v => v >= 1 && v <= 20));
  await assert.rejects(s.generateAttributes());
  await s.rerollAttribute("strength");
  assert.equal(s.data.attributes.strength.value, 15);
  assert.equal(s.rerollsAvailable, 1);
  await assert.rejects(s.rerollAttribute("strength"));
  assert.equal(s.data.attributes.strength.value, 15);
  assert.equal(s.rerollsAvailable, 1);
  await s.rerollAttribute("agility");
  assert.equal(s.data.attributes.agility.value, 2);
  assert.deepEqual(s.rerolls.map(({original, rolled, result}) => [original, rolled, result]), [[2,15,15],[15,2,2]]);
  assert.equal(s.rerollsAvailable, 0);
  await assert.rejects(s.rerollAttribute("endurance"));
  assert.equal(s.data.attributes.endurance.value, 10);
  assert.equal(s.rerolls.length, 2);
});

test("Service, power and society table boundaries", () => {
  for (const [roll, service] of [[1,"SSI"],[2,"SSI"],[3,"STC"],[4,"STC"],[5,"SBD"],[8,"SBD"],[9,"SDF"],[11,"SDF"],[12,"SPL"],[14,"SPL"],[15,"SEG"],[16,"SEG"],[17,"SID"],[18,"SID"],[19,"SCP"],[20,"SCP"]]) assert.equal(serviceForRoll(roll), service);
  assert.equal(powerForRoll(1), "Control de Adrenalina");
  assert.equal(powerForRoll(20), "Vista con Rayos X");
  for (const [roll, name] of [[1,"Antimutantes"],[5,"Leopardos de la Muerte"],[18,"Club Sierra"],[19,"Club Sierra"],[20,"Otra"]]) assert.equal(societyForRoll(roll), name);
  for (const lookup of [serviceForRoll, powerForRoll, societyForRoll]) for (const invalid of [0,21,NaN,2.5]) assert.throws(() => lookup(invalid));
});

test("independent real/cover rolls, custom society, and Psiónicos review", async () => {
  const s = session([1,20,20]);
  await s.rollTable("service"); await s.rollTable("coverService"); await s.rollTable("society");
  assert.equal(s.data.service, "SSI"); assert.equal(s.data.coverService, "SCP");
  assert.throws(() => s.validateStep("society"));
  s.setSociety("Otra", "Sociedad elegida"); s.validateStep("society");
  s.setSociety("Psiónicos"); assert.throws(() => s.validateStep("society"));
  s.psychicConfirmed = true; s.validateStep("society");
  s.setPower("Telepatía"); assert.equal(s.psychicConfirmed, false);
  await assert.rejects(s.rollTable("service"));
});

test("all skills initialize to their Basic Skill rating, without double addition", async () => {
  for (const [attribute, base] of [[3,0],[4,1],[7,2],[11,3],[15,4],[18,5]]) {
    const s = session(Array(8).fill(attribute)); await s.generateAttributes();
    assert.ok(Object.values(s.data.skills).every(group => Object.values(group).every(skill => skill.value === base)));
  }
});

test("30 PD budget, refunds, normal maximum 12 and baseline floor", async () => {
  const s = session(); await s.generateAttributes();
  assert.equal(s.remaining, 30);
  const path = "agility.brawling";
  s.adjustSkill(path, 1); assert.equal(s.remaining, 29); assert.equal(s.data.skills.agility.brawling.value, 2);
  s.adjustSkill(path, -1); assert.equal(s.remaining, 30);
  assert.throws(() => s.adjustSkill(path, -1));
  for(let i=0;i<11;i++) s.adjustSkill(path, 1);
  assert.equal(s.data.skills.agility.brawling.value, 12); assert.throws(() => s.adjustSkill(path, 1));
  for(const p of Object.keys(s.increases)) while(s.remaining && s.increases[p] < 11) s.adjustSkill(p, 1);
  assert.equal(s.spent, 30); assert.equal(s.remaining, 0);
  assert.throws(() => s.adjustSkill("perception.medicine", 1));
  s.validateStep("skills");
  assert.equal(skillMaximum("SSI", "perception.medicine"), 12);
  s.setAttribute("agility", 18); assert.equal(s.remaining, 30); assert.equal(s.data.skills.agility.brawling.value, 5);
});

test("draft isolation, final identity, completion flag and unrelated data preservation", async () => {
  const original = source(); const before = structuredClone(original);
  const s = new CreationSession(original, async () => 5); await s.generateAttributes();
  s.setService("service", "SSI"); s.setService("coverService", "SCP");
  s.setPower("Telepatía"); s.data.mutantPower.registered = true; s.setSociety("Humanistas");
  const changes = s.finalSystemChanges();
  assert.deepEqual(original, before);
  assert.equal(changes.creation.complete, true);
  assert.equal(buildCitizenId(changes), "DAVID-R-ARO-1");
  assert.equal(changes.mutantPower.registered, true);
  assert.deepEqual(changes.mutantPower.points,{value:5,max:5});
  for(const key of ["health", "credits", "publicNotes", "privateNotes"]) assert.ok(!(key in changes));
  assert.ok(!("notes" in changes.mutantPower));
  assert.equal(changes.secretSociety.societyKey,"humanists");
  assert.equal(changes.secretSociety.rank.level,1);
  assert.equal(changes.secretSociety.membershipHistory[0].notes,"Preserve society notes");
});
