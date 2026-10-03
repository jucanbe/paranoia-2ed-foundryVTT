import {textField,numberField} from "./fields.mjs";
import {HEALTH_STATES} from "../../health/rules.mjs";
export function cloneFields(){
  const {SchemaField,ArrayField,StringField,BooleanField,NumberField}=foundry.data.fields;
  return new SchemaField({history:new ArrayField(new SchemaField({
    number:numberField({integer:true,min:1}),citizenId:textField(),
    deathType:new StringField({required:true,initial:"dead",choices:Object.keys(HEALTH_STATES)}),
    causeOfDeath:textField(),notes:textField(),gmNotes:textField(),appearanceNotes:textField(),
    timestamp:numberField(),worldTime:numberField(),credits:numberField(),
    localizedWounds:new ArrayField(new foundry.data.fields.ObjectField({required:true,nullable:false}),{required:true,initial:[]}),
    equipmentDisposition:textField(),inventoryPolicy:textField(),
    inventorySnapshot:new ArrayField(new SchemaField({
      name:textField(),type:textField(),catalogId:textField(),quantity:numberField(),
      assigned:new BooleanField({required:true,initial:false}),
      length:new NumberField({required:true,nullable:true,initial:null})
    }),{required:true,initial:[]})
  }),{required:true,initial:[]})});
}
