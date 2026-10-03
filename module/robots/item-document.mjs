import {tr} from "../i18n/index.mjs";
import {validateMemory,programSummary} from "./rules.mjs";
/** V14 batch preflight covers sheets, native drops, and multi-document program changes. */
export class ParanoiaItem extends foundry.documents.Item{
  static checkRobot(parent,items,operation,user){
    if(!["robot","vehicle"].includes(parent?.type))return;
    if(!user.isGM)throw Error(tr("Solo el DJ puede configurar programas y periféricos."));
    const swap=parent.system.robot?.cardSwap??{};
    const activating=items.filter(i=>i.type==="robotProgram"&&i.system.storageMode==="card"&&i.system.active&&!parent.items.get(i.id??i._id)?.system.active);
    const activeCombat=game.combats.find(c=>c.round>0&&c.combatants.some(p=>p.actor?.uuid===parent.uuid));
    if(activating.length&&parent.system.robot?.type==="robomechanic"&&activeCombat&&!operation.robotMemoryOverride){
      if(!swap.toId||swap.combatId!==activeCombat.id||activeCombat.round<swap.readyRound||activating.some(i=>(i.id??i._id)!==swap.toId))throw Error(tr("Usa Cambiar tarjeta: el Robomecánico necesita tres turnos en combate."));
    }
    const capacity=(parent.system.robot?.memory??parent.system.vehicle.electronicBrain.memory).capacity;
    validateMemory(items,capacity,{override:operation.robotMemoryOverride===true&&user.isGM,previousUsed:programSummary(parent.items,capacity).used});
  }
  static async _preCreateOperation(documents,operation,user){
    if(await super._preCreateOperation(documents,operation,user)===false)return false;
    this.checkRobot(operation.parent,[...(operation.parent?.items??[]),...documents],operation,user);
  }
  static async _preUpdateOperation(documents,operation,user){
    if(await super._preUpdateOperation(documents,operation,user)===false)return false;
    const parent=operation.parent;if(!["robot","vehicle"].includes(parent?.type))return;
    const items=parent.items.map(i=>foundry.utils.mergeObject(i.toObject(),foundry.utils.expandObject(operation.updates.find(u=>u._id===i.id)??{}),{inplace:false}));
    this.checkRobot(parent,items,operation,user);
  }
}
