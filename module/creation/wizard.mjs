import {documentText} from "../i18n/documents.mjs";
import {tr,trHTML} from "../i18n/index.mjs";
import { CharacterData, SECURITY_CLEARANCES } from "../data/models/character.mjs";
import { buildCitizenId } from "../actors/identity.mjs";
import { BASIC_SKILL_ATTRIBUTES } from "../data/derived-capabilities.mjs";
import { LABELS } from "../sheets/labels.mjs";
import { capabilityRows } from "../sheets/capabilities.mjs";
import { CreationSession, hasMeaningfulCharacterData } from "./session.mjs";
import {rollCreationD20} from "./dice.mjs";
import { CREATION_STEPS, SERVICES, MUTANT_POWERS, SOCIETIES, DEVELOPMENT_POINTS, serviceLabel, skillMaximum, requiresPsychicReview, PSYCHIC_WARNING } from "./config.mjs";
import { commitCreation } from "./commit.mjs";
import {ItemCatalog,STARTER_IDS,catalogId} from "../items/catalog.mjs";
import {purchaseSummary,canPurchase} from "./purchases.mjs";

const OPEN_WIZARDS = new Map();
const confirm = content => foundry.applications.api.DialogV2.confirm({
  window: {title: tr("Crear personaje")}, content: `<p>${content}</p>`, yes: {label: tr("Continuar")}, no: {label: tr("Cancelar")}
});
const routeAction = function(event, target) { return this.runAction(target.dataset.action, target); };

export async function openCharacterCreation(actor) {
  if (!actor.isOwner || !actor.canUserModify(game.user, "update") || (actor.pack && game.packs.get(actor.pack)?.locked)) return;
  if (OPEN_WIZARDS.has(actor.uuid)) return OPEN_WIZARDS.get(actor.uuid).bringToFront();
  if (hasMeaningfulCharacterData(actor) && !await confirm(tr("Este personaje ya contiene datos. Al confirmar se sustituirán sus atributos, habilidades, Servicios, poder, registro mutante, sociedad/rango y créditos (100 menos las compras). Se conservan notas, salud y objetos. El equipo inicial asignado no se duplica. Cancelar no modifica el personaje. ¿Iniciar una nueva creación?"))) return;
  // Recheck after the modal, including another launch while it was open.
  if (!actor.isOwner || OPEN_WIZARDS.has(actor.uuid)) return;
  const wizard = new CharacterCreationWizard(actor);
  OPEN_WIZARDS.set(actor.uuid, wizard);
  await wizard.render({force: true});
  return wizard;
}

export class CharacterCreationWizard extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "form", classes: ["paranoia-sheet", "paranoia-creation"],
    window: {title: "Crear personaje", resizable: true}, position: {width: 920, height: 820},
    form: {handler: function() {}, submitOnChange: false, closeOnSubmit: false},
    actions: Object.fromEntries(["next", "back", "cancel", "generateAttributes", "rerollAttribute", "rollTable", "increase", "decrease", "buy", "refund", "togglePurchaseOverride", "finish"].map(key => [key, routeAction]))
  };
  static PARTS = {body: {template: "systems/paranoia-2-edition/templates/character-creation.hbs", scrollable: [".p2-creation-scroll"]}};

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.initialSource = JSON.stringify(actor.toObject());
    this.session = new CreationSession(actor.system.toObject(), rollCreationD20);
    this.step = 0;
    this.busy = false;
    this.finished = false;
    this.error = "";
    this._permissionHook = Hooks.on("updateActor", changed => {
      if (changed.uuid === actor.uuid && !this.canEdit) this.render();
    });
  }

  get title(){return tr(super.title);}

  get canEdit() { return this.actor.isOwner && this.actor.canUserModify(game.user, "update") && !(this.actor.pack && game.packs.get(this.actor.pack)?.locked); }
  get stepId() { return CREATION_STEPS[this.step][0]; }

  async close(options = {}) {
    if (this.busy && !this.finished) return this;
    return super.close(options);
  }

  _onClose(options) {
    Hooks.off("updateActor", this._permissionHook);
    if (OPEN_WIZARDS.get(this.actor.uuid) === this) OPEN_WIZARDS.delete(this.actor.uuid);
    super._onClose(options);
  }

  async confirmAllocationReset() {
    return !this.session.spent || await confirm(tr("Cambiar atributos o Servicio real reinicia la asignación de habilidades y devuelve los 30 PD. ¿Continuar?"));
  }

  async captureFields() {
    const values = new foundry.applications.ux.FormDataExtended(this.element).object;
    const s = this.session;
    if (this.stepId === "identity") {
      s.data.identity.name = String(values.personalName ?? "");
      s.data.identity.sector = String(values.sector ?? "");
      s.data.securityClearance = values.clearance;
      if(game.user.isGM)s.data.cloneNumber = Number(values.cloneNumber);
    }
    if (this.stepId === "attributes" && game.user.isGM) {
      const changes = Object.keys(s.data.attributes).filter(key => Number(values[`attribute.${key}`]) !== s.data.attributes[key].value);
      if (changes.length && !await this.confirmAllocationReset()) return false;
      for (const key of changes) s.setAttribute(key, Number(values[`attribute.${key}`]));
    }
    if (this.stepId === "service" && game.user.isGM) {
      if (values.service && values.service !== s.data.service && !await this.confirmAllocationReset()) return false;
      for (const key of ["service", "coverService"]) if (values[key]) s.setService(key, values[key]);
    }
    if (this.stepId === "mutation") {
      if (game.user.isGM && values.powerName) s.setPower(values.powerName);
      s.data.mutantPower.registered = !!values.registered;
    }
    if (this.stepId === "society") {
      if (game.user.isGM && values.societyChoice) s.setSociety(values.societyChoice, values.customSociety ?? "");
      else if (s.societyChoice === "Otra") s.setSociety(tr("Otra"), values.customSociety ?? "");
      if (game.user.isGM) s.data.secretSociety.rank = {level:Number(values.rankLevel??1),label:String(values.rankLabel??"")};
      if ("psychicConfirmed" in values) s.psychicConfirmed = !!values.psychicConfirmed;
    }
    return true;
  }

  async runAction(action, target) {
    if (this.busy) return;
    if (action === "cancel") return this.close();
    this.busy = true;
    this.error = "";
    try {
      if (!this.canEdit) throw new Error(tr("Solo el propietario y el DJ pueden crear este personaje."));
      if (await this.captureFields() === false) return;
      const s = this.session;
      if (action === "next") {
        s.validateStep(this.stepId);
        if(this.stepId==="equipment")purchaseSummary(s.purchases,await ItemCatalog.entries(),s.data.securityClearance,game.user.isGM&&s.purchaseOverride);
        this.step = Math.min(8, this.step + 1);
      }
      else if (action === "back") this.step = Math.max(0, this.step - 1);
      else if (action === "generateAttributes") { if (await this.confirmAllocationReset()) await s.generateAttributes(); }
      else if (action === "rerollAttribute") { if (await this.confirmAllocationReset()) await s.rerollAttribute(target.dataset.attribute); }
      else if (action === "rollTable") {
        if (target.dataset.table !== "service" || await this.confirmAllocationReset()) await s.rollTable(target.dataset.table);
      }
      else if (action === "increase" || action === "decrease") s.adjustSkill(target.dataset.skill, action === "increase" ? 1 : -1);
      else if(action==="togglePurchaseOverride") {
        if(!game.user.isGM)throw new Error(tr("Solo el DJ puede autorizar excepciones."));
        s.purchaseOverride=!s.purchaseOverride;
      }
      else if(action==="buy"||action==="refund") {
        const id=target.dataset.catalogId;
        const purchases={...s.purchases,[id]:Math.max(0,(s.purchases[id]??0)+(action==="buy"?1:-1))};
        // Always permit refunds, including after an override is revoked or clearance reduced.
        if(action==="buy")purchaseSummary(purchases,await ItemCatalog.entries(),s.data.securityClearance,game.user.isGM&&s.purchaseOverride);
        s.purchases=purchases;
      }
      else if (action === "finish") {
        if (this.stepId !== "review") return;
        s.finalSystemChanges();
        if (s.remaining && !await confirm(trHTML`Quedan ${s.remaining} PD sin asignar. ¿Confirmar el personaje de todos modos?`)) return;
        await commitCreation(this.actor, s, this.initialSource);
        this.finished = true;
        await this.close();
        await this.actor.sheet.render({force: true});
      }
    } catch (error) { this.error = error.message; }
    finally {
      this.busy = false;
      if (!this.finished) await this.render();
    }
  }

  async _prepareContext() {
    if (!this.canEdit) return {denied: true};
    const s = this.session;
    const d = s.data;
    const model = new CharacterData({attributes: d.attributes}, {strict: true});
    model.prepareDerivedData();
    const selectOptions = (values, selected, label = value => tr(value)) => values.map(value => ({value, label: label(value), selected: value === selected}));
    let equipment={};
    if(["equipment","review"].includes(this.stepId)){
      try{
        const entries=await ItemCatalog.entries();
        const override=game.user.isGM&&s.purchaseOverride;
        const summary=purchaseSummary(s.purchases,entries,d.securityClearance,true);
        let purchaseError="";
        try{purchaseSummary(s.purchases,entries,d.securityClearance,override);}catch(error){purchaseError=error.message;}
        const starters=STARTER_IDS.map(id=>{const item=entries.find(i=>catalogId(i)===id);if(!item)throw new Error(trHTML`Equipo inicial no disponible: ${id}`);return {name:documentText(item)};});
        equipment={starters,purchaseOverride:override,purchaseError,credits:summary,selectedEquipment:summary.rows,
          catalogue:entries.filter(i=>i.flags?.["paranoia-2-edition"]?.startingPurchase&&(canPurchase(i,d.securityClearance,override)||s.purchases[catalogId(i)]>0))
            .sort((a,b)=>a.name.localeCompare(b.name,"es"))
            .map(i=>{const id=catalogId(i),quantity=s.purchases[id]??0;return {id,name:documentText(i),price:i.system.price,unit:i.system.priceUnit==="meter"?tr("/ metro"):i.system.priceUnit==="bottle"?tr("/ botella"):"",quantity,subtotal:i.system.price*quantity,canDecrease:quantity>0,canIncrease:canPurchase(i,d.securityClearance,override)&&(override||summary.remaining>=i.system.price)};})};
      }catch(error){equipment={purchaseError:error.message};}
    }
    return {
      labels: LABELS, error: this.error, isGM: game.user.isGM, data: d,clearanceLocked:!!this.actor.system.creation?.complete,
      citizenId: buildCitizenId(d, this.actor.name), stepTitle: tr(CREATION_STEPS[this.step][1]), stepNumber: this.step + 1,
      steps: CREATION_STEPS.map(([id, label], index) => ({label:tr(label), active: index === this.step, number: index + 1})),
      views: {[this.stepId]: true}, first: this.step === 0, last: this.step === 8,
      clearances: selectOptions(SECURITY_CLEARANCES, d.securityClearance, key => LABELS.clearances[key]),
      attributes: Object.entries(d.attributes).map(([key, attr]) => ({
        key, label: LABELS.attributeNames[key], value: attr.value,
        original: s.attributeRolls[key] ?? "—",
        canReroll: Object.hasOwn(s.attributeRolls, key) && s.rerollsAvailable > 0 && !s.rerolls.some(r => r.key === key)
      })),
      canGenerate: !Object.keys(s.attributeRolls).length,
      rerollsAvailable: s.rerollsAvailable,
      rerolls: s.rerolls.map(r => ({...r, label: LABELS.attributeNames[r.key]})),
      capabilities: capabilityRows(model),
      serviceOptions: selectOptions(Object.keys(SERVICES), d.service, serviceLabel),
      coverOptions: selectOptions(Object.keys(SERVICES), d.coverService, serviceLabel),
      serviceLabel: serviceLabel(d.service), coverLabel: serviceLabel(d.coverService),
      powerOptions: selectOptions(MUTANT_POWERS, d.mutantPower.name),
      societyOptions: selectOptions(SOCIETIES, s.societyChoice),
      canCustomSociety: game.user.isGM || s.societyChoice === "Otra",
      customSociety: s.societyChoice === "Otra" ? d.secretSociety.name : "",
      psychicWarning: requiresPsychicReview(d.secretSociety.name) ? tr(PSYCHIC_WARNING) : "",
      psychicConfirmed: s.psychicConfirmed, rolls: s.tableRolls,
      points: {total: DEVELOPMENT_POINTS, spent: s.spent, remaining: s.remaining},
      skillGroups: BASIC_SKILL_ATTRIBUTES.map(group => ({
        label: LABELS.attributeNames[group], skills: Object.entries(d.skills[group]).map(([key, skill]) => {
          const path = `${group}.${key}`;
          const base = model.basicSkills[group];
          const maximum = skillMaximum(d.service, path);
          return {path, label: LABELS.skillNames[group][key], base, value: skill.value, maximum,
            canIncrease: s.remaining > 0 && skill.value < maximum, canDecrease: skill.value > base};
        })
      })),
      ownedEquipment: this.actor.items.map(item => ({name:documentText(item), quantity: item.system.quantity, type: item.type})),
      ...equipment
    };
  }
}
