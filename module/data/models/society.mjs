import {textField,numberField} from "./fields.mjs";
import {MEMBERSHIP_STATUSES,MISSION_STATUSES,MISSION_CATEGORIES} from "../../societies/registry.mjs";
const choice=(values,initial)=>new foundry.data.fields.StringField({required:true,initial,choices:Object.keys(values)});
const timestamp=()=>numberField({nullable:true,initial:null,min:0});
function memberFields(){
  const {SchemaField,ArrayField,BooleanField}=foundry.data.fields;
  return {
    id:textField(),societyKey:textField(),name:textField(), // name is a legacy migration input only.
    custom:new SchemaField(Object.fromEntries(["worldKey","name","beliefs","objectives","allies","enemies","benefits","obligations","notes"].map(k=>[k,textField()]))),
    rank:new SchemaField({level:numberField({integer:true,min:0,initial:1}),label:textField()}),
    psionicLevels:new ArrayField(numberField({integer:true,min:1,initial:1}),{required:true,initial:[]}),
    status:choice(MEMBERSHIP_STATUSES,"active"),notes:textField(),joinedAt:timestamp(),exposed:new BooleanField({required:true,initial:false}),
    missions:new ArrayField(new SchemaField({id:textField(),title:textField(),description:textField(),status:choice(MISSION_STATUSES,"active"),category:choice(MISSION_CATEGORIES,"other"),
      assignedBy:textField(),rewardNotes:textField(),consequenceNotes:textField(),secretNotes:textField(),createdAt:timestamp(),resolvedAt:timestamp()}),{required:true,initial:[]}),
    contacts:new ArrayField(new SchemaField({id:textField(),name:textField(),actorUuid:textField(),role:textField(),notes:textField(),trustNotes:textField()}),{required:true,initial:[]}),
    favors:new ArrayField(new SchemaField({id:textField(),title:textField(),description:textField(),type:choice({favor:"Favor",obligation:"Obligación"},"favor"),status:choice({pending:"Pendiente",resolved:"Resuelto"},"pending"),resolved:new BooleanField({required:true,initial:false}),createdAt:timestamp()}),{required:true,initial:[]})
  };
}
export function societyFields(){
  const {SchemaField,ArrayField,ObjectField}=foundry.data.fields;
  return new SchemaField({...memberFields(),membershipHistory:new ArrayField(new SchemaField(memberFields()),{required:true,initial:[]}),
    // GM notes and rank history are shown only in GM sheet/service contexts.
    gmData:new ObjectField({required:true,nullable:true,initial:null})});
}
