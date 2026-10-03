import {tr} from "../i18n/index.mjs";
import {documentText} from "../i18n/documents.mjs";
import { SECURITY_CLEARANCES } from "../data/models/character.mjs";
import { LABELS } from "./labels.mjs";
import { createItem, editItem, deleteItem, changeQuantity } from "./item-actions.mjs";
import {ITEM_LABELS,WEAPON_CATEGORIES,EQUIPMENT_CATEGORIES,skillLabel,armorCode} from "../items/config.mjs";
import { openCharacterCreation } from "../creation/wizard.mjs";
import { capabilityRows } from "./capabilities.mjs";
import { sheetCheck, sheetDuel } from "../rolls/dialogs.mjs";
import { ROLL_LABELS } from "../rolls/rules.mjs";
import {healthAction,toggleArmor} from "../health/dialogs.mjs";
import {healthView} from "../health/service.mjs";
import {activateClone,cloneHistoryView} from "../clones/dialog.mjs";
import {isTerminal} from "../clones/rules.mjs";
import {powerAction,powerView} from "../powers/dialogs.mjs";
import {identifyPower} from "../powers/registry.mjs";
import {treasonAction,panelHTML} from "../treason/dialogs.mjs";
import {societyAction,panel as societyPanel} from "../societies/dialogs.mjs";
import {clearanceAction,panel as clearancePanel} from "../clearance/dialogs.mjs";
import {clearanceIndex} from "../clearance/rules.mjs";
import {developmentAction,panel as developmentPanel} from "../development/dialogs.mjs";
import {creditAction,panel as creditPanel} from "../credits/dialogs.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class CharacterSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["paranoia-sheet", "paranoia-character"],
    position: {width: 1020, height: 860},
    window: {resizable: true},
    form: {submitOnChange: true, closeOnSubmit: false},
    actions: {creditAction,developmentAction,clearanceAction,societyAction,treasonAction,powerAction,activateClone,healthAction,toggleArmor,changeQuantity,rollCheck: sheetCheck, attributeDuel: sheetDuel, createItem, editItem, deleteItem, createCharacter: async function() {
      if (this.isEditable) await openCharacterCreation(this.actor);
    }}
  };

  static PARTS = {
    body: {template: "systems/paranoia-2-edition/templates/character-sheet.hbs", scrollable: [".p2-scroll"]}
  };

  static TABS = {
    primary: {initial: "character", tabs: [
      {id: "character", label: LABELS.character}, {id: "secret", label: LABELS.secret}
    ]}
  };

  get canViewSecret() {
    return game.user.isGM || this.actor.testUserPermission(game.user, "OWNER");
  }

  _getTabsConfig(group) {
    const config = super._getTabsConfig(group);
    if (group !== "primary" || this.canViewSecret) return config;
    this.tabGroups.primary = "character";
    return {...config, tabs: config.tabs.filter(tab => tab.id !== "secret")};
  }

  // Standard ActorSheetV2 handles Item UUID drops and embedded Item sorting.
  _canDragStart() { return this.isEditable; }
  _canDragDrop() { return this.isEditable; }

  async _prepareContext(options) {
    const {tabs, editable} = await super._prepareContext(options);
    const system = this.actor.system;
    const capabilities = capabilityRows(system);
    const inventory = {weapon: [], armor: [], equipment: []};
    for (const item of [...this.actor.items].sort((a,b)=>a.sort-b.sort)) {
      if (!Object.hasOwn(inventory, item.type)) continue;
      if (item.type === "equipment" && !this.canViewSecret) continue;
      const row = {id: item.id, name:documentText(item), ...item.system.toObject()};
      row.unauthorized=clearanceIndex(row.securityClearance)>clearanceIndex(system.securityClearance);
      if (item.type === "weapon") {
        row.skillLabel = skillLabel(row.skill);
        row.categoryLabel=WEAPON_CATEGORIES[row.weaponCategory]?.code || row.weaponType || "—";
        row.damageDisplay=row.damageNumber ?? (row.damageNotation || "—");
        row.experimentalLabel = row.experimental ? LABELS.yes : LABELS.no;
      }
      if(item.type==="armor")row.protectionSummary=armorCode(row.protectionType,row.protectionValue);
      if(item.type==="equipment"){
        row.categoryLabel=EQUIPMENT_CATEGORIES[row.category]??row.category;
        row.lengthLabel=row.priceUnit==="meter"&&row.length!=null?`${row.length} m`:"";
      }
      row.canDecrease=row.quantity>0;
      inventory[item.type].push(row);
    }
    // Only explicit public data reaches public markup; secret context is owner/GM-only.
    return {
      tabs, editable, clearancePanel:clearancePanel(this.actor),clearanceLabel:LABELS.clearances[system.securityClearance],treasonPanel:panelHTML(this.actor), rootId:this.actor.id, labels: ITEM_LABELS, rollLabels: ROLL_LABELS, isGM: game.user.isGM, name: this.actor.name, canViewSecret: this.canViewSecret,
      identity: {...system.identity, service: system.service, cloneNumber: system.cloneNumber},
      legacyIdentity: !system.identity.name,
      clearances: SECURITY_CLEARANCES.map(value => ({value, label: LABELS.clearances[value], selected: value === system.securityClearance})),
      attributes: Object.keys(system.attributes).map(key => ({
        key, label: LABELS.attributeNames[key], path: `system.attributes.${key}.value`, value: system.attributes[key].value
      })),
      skillGroups: Object.entries(system.skills).map(([group, skills]) => ({
        label: LABELS.attributeNames[group],
        skills: Object.entries(skills).map(([key, data]) => ({
          key: `${group}.${key}`, label: LABELS.skillNames[group][key], path: `system.skills.${group}.${key}.value`, value: data.value
        }))
      })),
      capabilities, inventory, developmentPanel:developmentPanel(this.actor),canEditSkills:game.user.isGM||(!system.creation.complete&&!system.development.history.length),societyPanel:await societyPanel(this.actor), publicNotes: system.publicNotes, healthView:this.canViewSecret?healthView(this.actor):null,
      secret: this.canViewSecret ? {
        creditPanel:creditPanel(this.actor),
        powerView:powerView(this.actor),
        cloneHistory:cloneHistoryView(this.actor),terminal:isTerminal(system.health),cloneNumber:system.cloneNumber,
        mutantPower: {...system.mutantPower,name:identifyPower(system.mutantPower.name)?tr(identifyPower(system.mutantPower.name).label):system.mutantPower.name},
        health: system.health, credits: system.credits, privateNotes: system.privateNotes, coverService: system.coverService
      } : null
    };
  }
}
