import {LegacyDataModel,legacyField} from "./legacy.mjs";
import {textField,numberField} from "./fields.mjs";
import {ITEM_SKILLS} from "../../items/config.mjs";
import {PERIPHERALS} from "../../robots/rules.mjs";
export class RobotProgramData extends LegacyDataModel{
  static defineSchema(){const {StringField,BooleanField}=foundry.data.fields;return {legacyData:legacyField(),
    skill:new StringField({required:true,blank:true,initial:"",choices:["",...ITEM_SKILLS.map(s=>s.key)]}),level:numberField({min:0,integer:true}),
    storageMode:new StringField({required:true,initial:"resident",choices:["resident","card"]}),active:new BooleanField({required:true,initial:false}),
    description:textField(),source:textField(),notes:textField()};}
  get memoryCost(){return this.level;}
}
export class RobotPeripheralData extends LegacyDataModel{
  static defineSchema(){return {legacyData:legacyField(),category:new foundry.data.fields.StringField({required:true,initial:"other",choices:Object.keys(PERIPHERALS)}),operational:new foundry.data.fields.BooleanField({required:true,initial:true}),description:textField(),notes:textField()};}
}
