import {LegacyDataModel,legacyField} from "./legacy.mjs";
import { textField } from "./fields.mjs";
import {sourceDetails} from "./source-details.mjs";
import {commonItemFields,counterFields} from "./item-fields.mjs";
import {EQUIPMENT_CATEGORIES} from "../../items/config.mjs";

export class EquipmentData extends LegacyDataModel {
  static defineSchema() {
    return {
      ...commonItemFields(),
      sourceDetails:sourceDetails(),
      category:new foundry.data.fields.StringField({required:true,initial:"general",choices:Object.keys(EQUIPMENT_CATEGORIES)}),
      model:textField(),charges:counterFields(),uses:counterFields(),
      consumable:new foundry.data.fields.BooleanField({required:true,initial:false})
    };
  }
}
