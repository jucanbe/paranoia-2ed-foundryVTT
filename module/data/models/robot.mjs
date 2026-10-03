import {LegacyDataModel,legacyField} from "./legacy.mjs";
import {textField,numberField} from "./fields.mjs";
import {ROBOT_STATES,ASIMOV,programSummary,validateMemory} from "../../robots/rules.mjs";
import {CLEARANCE_CODES} from "../../actors/identity.mjs";
const choice=(values,initial)=>new foundry.data.fields.StringField({required:true,blank:true,choices:values,initial});
export class RobotData extends LegacyDataModel{
  static defineSchema(){
    const {SchemaField,BooleanField}=foundry.data.fields,b=initial=>new BooleanField({required:true,initial}),n=()=>numberField({nullable:true,initial:null,min:0});
    return {legacyData:legacyField(),robot:new SchemaField({type:textField(),model:textField(),serial:textField(),designation:textField(),description:textField(),notes:textField(),
      ucp:new SchemaField({model:textField(),notes:textField(),status:choice(["operational","damaged","removed","destroyed"],"operational")}),
      memory:new SchemaField({capacity:numberField({nullable:true,initial:null,min:0,integer:true})}),
      asimovStatus:choice(Object.keys(ASIMOV),"functional"),minimumCommandClearance:choice(["",...Object.keys(CLEARANCE_CODES)],""),
      authorizedOperatorActorId:textField(),secondaryOperatorActorId:textField(),erratic:b(false),erraticNotes:textField(),damagedPeripherals:textField(),salvageNotes:textField(),
      requiresVehicleSystem:b(false),movement:new SchemaField({mode:textField(),metersPerTurn:n()}),
      cardSwap:new SchemaField({fromId:textField(),toId:textField(),combatId:textField(),startedRound:n(),readyRound:n()})}),
      health:new SchemaField({status:choice(Object.keys(ROBOT_STATES),"operational"),stunned:b(false),stunCombatId:textField(),stunnedUntilRound:n(),lastDamageId:textField(),salvageAvailable:b(true)})};
  }
  prepareDerivedData(){super.prepareDerivedData();const s=programSummary(this.parent?.items??[],this.robot.memory.capacity);this.skills=s.skills;this.robot.memory.used=s.used;this.robot.memory.free=s.free;this.health.salvageAvailable=this.health.status!=="vaporized";}
  async _preCreate(data,options,user){
    if(!user.isGM)return false;await super._preCreate(data,options,user);
    const used=programSummary(this.parent.items,this.robot.memory.capacity).used;
    // Source templates have verified preinstalled knowledge but no supplied memory capacity.
    validateMemory(this.parent.items,this.robot.memory.capacity,{previousUsed:this.robot.memory.capacity==null?used:0,override:options.robotMemoryOverride===true});
    this.parent.updateSource({prototypeToken:{name:data.name,actorLink:false}});
  }
  async _preUpdate(changes,options,user){
    if(!user.isGM){ui.notifications.warn("La configuración del robot requiere al DJ.");return false;}
    await super._preUpdate(changes,options,user);
    const expanded=foundry.utils.expandObject(changes),next=foundry.utils.mergeObject(this.parent.toObject(),expanded,{inplace:false});
    if(expanded.system?.health?.status&&expanded.system.health.status!==this.health.status){
      const health=expanded.system.health;
      health.salvageAvailable=health.status!=="vaporized";
      if(!Object.hasOwn(health,"stunned"))Object.assign(health,{stunned:health.status==="shortCircuit",stunCombatId:"",stunnedUntilRound:null});
      Object.keys(changes).forEach(k=>delete changes[k]);Object.assign(changes,expanded);
    }
    if(expanded.items||expanded.system?.robot?.memory){
      const previous=programSummary(this.parent.items,this.robot.memory.capacity).used;
      const cap=next.system.robot.memory.capacity,used=programSummary(next.items,cap).used;
      if(!options.robotMemoryOverride&&(used>previous||cap!==this.robot.memory.capacity)&&(cap==null||used>cap)&&used>0)throw Error("Memoria insuficiente");
    }
    if(expanded.name&&this.parent.prototypeToken.name===this.parent.name)changes.prototypeToken={...expanded.prototypeToken,name:expanded.name};
  }
}
