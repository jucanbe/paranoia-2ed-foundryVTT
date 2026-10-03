import {LegacyDataModel,legacyField} from "./legacy.mjs";
import { textField } from "./fields.mjs";
import {sourceDetails} from "./source-details.mjs";
import { WEAPON_CATEGORIES,normalizeWeaponCategory,canonicalSkill } from "../../items/config.mjs";
import { commonItemFields,counterFields,optionalNumber } from "./item-fields.mjs";
import {enabled} from "../../combat/optional/settings.mjs";

export class WeaponData extends LegacyDataModel {
  async _preUpdate(changes,options,user){
    if(await super._preUpdate(changes,options,user)===false)return false;
    if(user.isGM)return;
    const incoming=foundry.utils.expandObject(changes).system;if(!incoming)return;
    for(const [key,rule] of [["ammoCurrent","ammunition"],["malfunctioned","malfunctions"]])if(enabled(rule)&&(Object.hasOwn(incoming,`-=${key}`)||(incoming[key]!==undefined&&incoming[key]!==this[key])||(options.recursive===false&&!Object.hasOwn(incoming,key)))){
      ui.notifications.warn("Usa las acciones de combate; solo el DJ puede ajustar munición o averías directamente.");return false;
    }
  }
  static defineSchema() {
    return {
      ...commonItemFields(),
      integrated:new foundry.data.fields.BooleanField({required:true,initial:false}),
      sourceDetails:sourceDetails(),
      weaponType: textField(),
      weaponCategory: new foundry.data.fields.StringField({required: true, blank:true, initial: "", choices: ["", ...Object.keys(WEAPON_CATEGORIES)]}),
      area: new foundry.data.fields.BooleanField({required: true, initial: false}),
      // Canonical Character skill path, also resolved from integrated robot/vehicle programs.
      skill: textField(),
      // Unknown numeric damage/range remains manual; preserve printed source notation.
      damageNumber: new foundry.data.fields.NumberField({required: true, nullable: true, initial: null}),
      damageNotation: textField(),
      range: textField(),
      charges: counterFields(),
      ammunition: new foundry.data.fields.SchemaField({capacity:optionalNumber(),notes:textField()}),
      ammunitionProfile:textField(),
      ammunitionProfiles:new foundry.data.fields.ArrayField(new foundry.data.fields.ObjectField(),{required:true,initial:[]}),
      reloadInfo: textField(), areaNotes: textField()
      ,maxRangeMeters:optionalNumber(),burstCapable:new foundry.data.fields.BooleanField({required:true,initial:false}),
      burstMaxTargets:new foundry.data.fields.NumberField({required:true,initial:3,min:1,max:3,integer:true}),burstMaxTargetSeparationMeters:new foundry.data.fields.NumberField({required:true,initial:5,min:0}),burstAmmoCost:optionalNumber(),
      ammoCurrent:optionalNumber(),ammoType:textField(),reloadTurns:optionalNumber(),drawTurnsRequired:optionalNumber(),requiredArm:new foundry.data.fields.StringField({required:true,initial:"unspecified",choices:["unspecified","left","right","both","none"]}),
      reliabilityType:new foundry.data.fields.StringField({required:true,initial:"normal",choices:["normal","experimental","trulyExperimental"]}),malfunctionThreshold:optionalNumber(),malfunctioned:new foundry.data.fields.BooleanField({required:true,initial:false}),
      repairSkill:textField(),malfunctionShot:new foundry.data.fields.StringField({required:true,initial:"manual",choices:["manual","resolve","cancel"]}),repairable:new foundry.data.fields.BooleanField({required:true,initial:true})
    };
  }

  static migrateData(source) {
    if (typeof source.damageNumber === "string") {
      const raw = source.damageNumber.trim();
      const number = raw ? Number(raw) : NaN;
      if (raw && !source.damageNotation) source.damageNotation = source.damageNumber;
      source.damageNumber = Number.isFinite(number) ? number : null;
    }
    // Foundry also migrates partial updates. Notes/price edits must not clear category.
    if(Object.hasOwn(source,"weaponCategory")||Object.hasOwn(source,"weaponType")){
      const category=normalizeWeaponCategory(source.weaponCategory)||normalizeWeaponCategory(source.weaponType);
      if (source.weaponCategory && !category) source.weaponType ||= source.weaponCategory;
      source.weaponCategory=category;
    }
    if(source.skill)source.skill=canonicalSkill(source.skill);
    if(!Object.hasOwn(source,"reliabilityType")&&Object.hasOwn(source,"experimental"))source.reliabilityType=source.experimental?"experimental":"normal";
    if(!Object.hasOwn(source,"ammoCurrent")&&typeof source.charges?.value==="number")source.ammoCurrent=source.charges.value;
    return super.migrateData(source);
  }
}
