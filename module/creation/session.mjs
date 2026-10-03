import {tr} from "../i18n/index.mjs";
import { basicSkillForAttribute, isGeneratedAttribute } from "../data/derived-capabilities.mjs";
import {initialPoints} from "../powers/rules.mjs";
import {identifySociety} from "../societies/registry.mjs";
import {newMembership,replaceMembership} from "../societies/migration.mjs";
import { CLEARANCE_CODES, normalizeIdentityText } from "../actors/identity.mjs";
import { DEVELOPMENT_POINTS, SERVICES, skillMaximum, serviceForRoll, powerForRoll, societyForRoll, validateD20, requiresPsychicReview } from "./config.mjs";

/** Local draft only. No Foundry documents are mutated here. rollD20 is injectable for tests. */
export class CreationSession {
  constructor(source, rollD20) {
    this.data = structuredClone(source);
    this.previousMembership=structuredClone(source.secretSociety);
    this.rollD20 = rollD20;
    this.data.cloneNumber ||= 1;
    this.data.service = "";
    this.data.coverService = "";
    this.data.mutantPower.name = "";
    this.data.mutantPower.registered = false;
    this.data.secretSociety.name = "";
    this.data.secretSociety.rank = {level:1,label:""};
    for (const attribute of Object.values(this.data.attributes)) attribute.value = 0;
    this.attributeRolls = {};
    this.rerolls = [];
    this.tableRolls = {};
    this.societyChoice = "";
    this.psychicConfirmed = false;
    this.purchases = {};
    this.purchaseOverride = false;
    this.busy = false;
    this.resetSkills();
  }

  get spent() { return Object.values(this.increases).reduce((sum, value) => sum + value, 0); }
  get remaining() { return DEVELOPMENT_POINTS - this.spent; }
  get rerollsAvailable() { return 2 - this.rerolls.length; }
  get attributesReady() { return Object.values(this.data.attributes).every(a => isGeneratedAttribute(a.value)); }

  resetSkills() {
    this.increases = {};
    for (const [group, skills] of Object.entries(this.data.skills)) {
      const base = basicSkillForAttribute(this.data.attributes[group].value) ?? 0;
      for (const [key, skill] of Object.entries(skills)) {
        skill.value = base;
        this.increases[`${group}.${key}`] = 0;
      }
    }
  }

  async generateAttributes() {
    if (this.busy || Object.keys(this.attributeRolls).length) throw new Error(tr("Los ocho atributos ya se han generado."));
    this.busy = true;
    try {
      const results = {};
      for (const key of Object.keys(this.data.attributes)) results[key] = validateD20(await this.rollD20());
      this.attributeRolls = results;
      for (const [key, value] of Object.entries(results)) this.data.attributes[key].value = value;
      this.resetSkills();
    } finally { this.busy = false; }
  }

  async rerollAttribute(key) {
    if (this.busy || !Object.hasOwn(this.attributeRolls, key) || !this.rerollsAvailable
        || this.rerolls.some(r => r.key === key)) throw new Error(tr("Solo se permiten dos repeticiones, en atributos distintos."));
    this.busy = true;
    try {
      const original = this.data.attributes[key].value;
      const rolled = validateD20(await this.rollD20());
      const result = rolled;
      this.rerolls.push({key, original, rolled, result});
      this.data.attributes[key].value = result;
      this.resetSkills();
    } finally { this.busy = false; }
  }

  setAttribute(key, value) {
    if (!Object.hasOwn(this.data.attributes, key)) throw new Error(tr("Atributo desconocido."));
    validateD20(value);
    if (this.data.attributes[key].value !== value) {
      this.data.attributes[key].value = value;
      this.resetSkills();
    }
  }

  setService(key, value) {
    if (!["service", "coverService"].includes(key) || !Object.hasOwn(SERVICES, value)) throw new Error(tr("Servicio no válido."));
    if (this.data[key] !== value) {
      this.data[key] = value;
      if (key === "service") this.resetSkills();
    }
  }

  setPower(value) {
    if (this.data.mutantPower.name !== value) this.psychicConfirmed = false;
    this.data.mutantPower.name = value;
  }

  setSociety(choice, custom = "") {
    const name = choice === "Otra" ? custom.trim() : choice;
    if (this.data.secretSociety.name !== name) this.psychicConfirmed = false;
    this.societyChoice = choice;
    this.data.secretSociety.name = name;
  }

  async rollTable(key) {
    const tables = {service: serviceForRoll, coverService: serviceForRoll, mutation: powerForRoll, society: societyForRoll};
    if (!Object.hasOwn(tables, key) || this.busy || Object.hasOwn(this.tableRolls, key)) throw new Error(tr("Esta tirada ya se ha realizado."));
    this.busy = true;
    try {
      const rolled = validateD20(await this.rollD20());
      const result = tables[key](rolled);
      this.tableRolls[key] = {rolled, result};
      if (key === "mutation") this.setPower(result);
      else if (key === "society") this.setSociety(result);
      else this.setService(key, result);
    } finally { this.busy = false; }
  }

  adjustSkill(path, delta) {
    if (!this.attributesReady || !Object.hasOwn(this.increases, path) || ![1, -1].includes(delta)) throw new Error(tr("Asignación no válida."));
    const [group, key] = path.split(".");
    const skill = this.data.skills[group][key];
    if (delta > 0 && (!this.remaining || skill.value >= skillMaximum(this.data.service, path))) throw new Error(tr("Sin PD o habilidad en su máximo."));
    if (delta < 0 && this.increases[path] <= 0) throw new Error(tr("No puedes reducir la Habilidad Básica."));
    this.increases[path] += delta;
    skill.value += delta;
  }

  validateStep(step) {
    const d = this.data;
    if (step === "identity") {
      if (!normalizeIdentityText(d.identity.name) || !normalizeIdentityText(d.identity.sector)) throw new Error(tr("Introduce nombre y sector."));
      if (!Object.hasOwn(CLEARANCE_CODES, d.securityClearance) || !Number.isInteger(d.cloneNumber) || d.cloneNumber < 1) throw new Error(tr("Revisa nivel y número de clon."));
    }
    if (["attributes", "derived", "skills"].includes(step) && !this.attributesReady) throw new Error(tr("Establece los ocho atributos (1–20)."));
    if (step === "service" && (!Object.hasOwn(SERVICES, d.service) || !Object.hasOwn(SERVICES, d.coverService))) throw new Error(tr("Determina el Servicio real y el de cobertura."));
    if (step === "mutation" && !d.mutantPower.name.trim()) throw new Error(tr("Determina el Poder Mutante."));
    if (step === "society") {
      if (!d.secretSociety.name.trim()) throw new Error(tr("Determina la Sociedad Secreta o introduce Otra."));
      if (requiresPsychicReview(d.secretSociety.name) && !this.psychicConfirmed) throw new Error(tr("Revisa y confirma la compatibilidad psíquica de Psiónicos."));
    }
    if (step === "skills") {
      let spent = 0;
      for (const [group, skills] of Object.entries(d.skills)) for (const [key, skill] of Object.entries(skills)) {
        const base = basicSkillForAttribute(d.attributes[group].value);
        if (!Number.isInteger(skill.value) || skill.value < base || skill.value > skillMaximum(d.service, `${group}.${key}`)) throw new Error(tr("Valor de habilidad no válido."));
        spent += skill.value - base;
      }
      if (spent !== this.spent || spent < 0 || spent > DEVELOPMENT_POINTS) throw new Error(tr("Presupuesto de PD no válido."));
    }
  }

  finalSystemChanges() {
    for (const step of ["identity", "attributes", "service", "mutation", "society", "skills"]) this.validateStep(step);
    const d = this.data;
    // This handles character fields; commitCreation sets credits and catalogue equipment.
    // Preserve unrelated notes, health and other manual data.
    return {
      identity: structuredClone(d.identity), securityClearance: d.securityClearance, cloneNumber: d.cloneNumber,
      attributes: structuredClone(d.attributes), skills: structuredClone(d.skills), service: d.service, coverService: d.coverService,
      mutantPower: {name: d.mutantPower.name, registered: d.mutantPower.registered,points:initialPoints(d.attributes.mutantPower.value)},
      secretSociety: replaceMembership(this.previousMembership,{...newMembership(identifySociety(d.secretSociety.name)?.key??"custom",{name:d.secretSociety.name,joinedAt:Date.now()}),rank:structuredClone(d.secretSociety.rank)}), creation: {complete: true}
    };
  }
}

export function hasMeaningfulCharacterData(actor) {
  const d = actor.system;
  return !!(d.creation?.complete || Object.values(d.attributes).some(a => a.value !== 0)
    || Object.values(d.skills).some(group => Object.values(group).some(s => s.value !== 0))
    || d.service || d.coverService || d.mutantPower.name || d.secretSociety.societyKey || d.secretSociety.name || actor.items.size);
}
