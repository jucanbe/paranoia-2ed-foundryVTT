import {legacyField} from "./legacy.mjs";
import {numberField,textField} from "./fields.mjs";
import {ITEM_CLEARANCES} from "../../items/config.mjs";
export const optionalNumber = () => new foundry.data.fields.NumberField({required:true,nullable:true,initial:null,min:0});
export const counterFields = () => new foundry.data.fields.SchemaField({value:optionalNumber(),max:optionalNumber()});
export function commonItemFields() {
  const {StringField,BooleanField}=foundry.data.fields;
  return {
    legacyData:legacyField(),description:textField(),notes:textField(),specialRules:textField(),sourceReference:textField(),
    quantity:numberField({integer:true,min:0,initial:1}),weight:optionalNumber(),price:optionalNumber(),
    priceUnit:new StringField({required:true,blank:false,initial:"item",choices:["item","bottle","meter"]}),
    length:optionalNumber(),
    securityClearance:new StringField({required:true,blank:true,initial:"",choices:["",...ITEM_CLEARANCES]}),
    assigned:new BooleanField({required:true,initial:false}),assignmentNotes:textField(),
    experimental:new BooleanField({required:true,initial:false}),experimentalNotes:textField()
  };
}
