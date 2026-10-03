import {LegacyDataModel,legacyField} from "./legacy.mjs";
import {textField,numberField} from "./fields.mjs";
import {ITEM_CLEARANCES} from "../../items/config.mjs";
import {VEHICLE_STATES,CONTROL_MODES,CREW_ROLES,SYSTEM_STATES,SYSTEM_TYPES,controlAvailable} from "../../vehicles/rules.mjs";
import {programSummary,validateMemory} from "../../robots/rules.mjs";
export class VehicleData extends LegacyDataModel{
  static defineSchema(){
    const {SchemaField:S,ArrayField:A,StringField,BooleanField}=foundry.data.fields;
    const b=(initial=false)=>new BooleanField({required:true,initial}),n=()=>numberField({nullable:true,initial:null,min:0}),arr=fields=>new A(new S(fields),{initial:[]});
    const choice=(values,initial)=>new StringField({required:true,blank:true,choices:values,initial});
    return {legacyData:legacyField(),vehicle:new S({category:textField(),model:textField(),designation:textField(),serial:textField(),description:textField(),purpose:textField(),design:textField(),
      requiredClearance:choice(["",...ITEM_CLEARANCES],""),assigned:b(),assignedTo:textField(),assignmentNotes:textField(),capacity:n(),temporaryPassengerCapacity:n(),
      crew:arr({actorUuid:textField(),role:choice(Object.keys(CREW_ROLES),"passenger"),notes:textField()}),
      control:new S({manualAvailable:b(),autopilotAvailable:b(),electronicBrainAvailable:b(),currentMode:choice(Object.keys(CONTROL_MODES),"manual")}),
      electronicBrain:new S({name:textField(),personality:textField(),programmingNotes:textField(),memory:new S({capacity:n()})}),handlingSkill:textField(),
      movement:new S({description:textField(),currentMode:textField(),currentSpeed:n(),modes:arr({key:textField(),label:textField(),maxSpeed:n(),unit:textField(),terrain:textField(),notes:textField(),capacity:n(),maxSlopeDegrees:n()})}),
      systems:arr({name:textField(),category:choice(Object.keys(SYSTEM_TYPES),"other"),status:choice(Object.keys(SYSTEM_STATES),"operational"),notes:textField()}),
      flaws:arr({name:textField(),description:textField(),hiddenFromPlayers:b(true),gmNotes:textField()}),
      defense:new S({smallArmsProtection:b(),smokeActive:b(),notes:textField()}),
      maneuverModifier:numberField({integer:true}),damageNotes:textField(),notes:textField(),gmNotes:textField(),specialSurprises:textField(),specialRules:textField(),
      airDamageWarning:b(),accidentPending:b(),lastAccident:textField()}),
      health:new S({kind:choice(["vehicle"],"vehicle"),status:choice(Object.keys(VEHICLE_STATES),"operational"),stunned:b(),lastDamageId:textField()})};
  }
  prepareDerivedData(){super.prepareDerivedData();const brain=this.vehicle.electronicBrain,summary=programSummary(this.parent?.items??[],brain.memory.capacity);this.skills=summary.skills;brain.memory.used=summary.used;brain.memory.free=summary.free;}
  async _preCreate(data,options,user){
    if(!user.isGM)return false;await super._preCreate(data,options,user);
    const cap=this.vehicle.electronicBrain.memory.capacity,used=programSummary(this.parent.items,cap).used;
    validateMemory(this.parent.items,cap,{previousUsed:cap==null?used:0,override:options.robotMemoryOverride===true});
    this.parent.updateSource({prototypeToken:{name:data.name,actorLink:false}});
  }
  async _preUpdate(changes,options,user){
    if(!user.isGM){ui.notifications.warn("La configuración del vehículo requiere al DJ.");return false;}
    await super._preUpdate(changes,options,user);
    const expanded=foundry.utils.expandObject(changes),next=foundry.utils.mergeObject(this.parent.toObject(),expanded,{inplace:false}),v=next.system.vehicle;
    if(expanded.system?.vehicle?.control?.currentMode&&v.control.currentMode!==this.vehicle.control.currentMode&&!controlAvailable(v))throw Error("Ese modo de control no está disponible.");
    if(expanded.items||expanded.system?.vehicle?.electronicBrain?.memory){
      const cap=v.electronicBrain.memory.capacity,previous=this.vehicle.electronicBrain.memory.capacity;
      validateMemory(next.items,cap,{previousUsed:cap===previous?programSummary(this.parent.items,previous).used:0,override:options.robotMemoryOverride===true});
    }
    if(expanded.name&&this.parent.prototypeToken.name===this.parent.name)changes.prototypeToken={...expanded.prototypeToken,name:expanded.name};
  }
}
