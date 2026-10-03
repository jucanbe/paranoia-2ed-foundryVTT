import { CharacterData } from "./character.mjs";
import {NPCData} from "./npc.mjs";
import { EquipmentData } from "./equipment.mjs";
import { WeaponData } from "./weapon.mjs";
import { ArmorData } from "./armor.mjs";
import {RobotData} from "./robot.mjs";
import {VehicleData} from "./vehicle.mjs";
import {RobotProgramData,RobotPeripheralData} from "./robot-items.mjs";
import {ParanoiaItem} from "../../robots/item-document.mjs";

export function registerDataModels() {
  Object.assign(CONFIG.Actor.dataModels, {character: CharacterData,npc:NPCData,robot:RobotData,vehicle:VehicleData});
  CONFIG.Item.documentClass=ParanoiaItem;
  Object.assign(CONFIG.Item.dataModels, {
    equipment: EquipmentData,
    weapon: WeaponData,
    armor: ArmorData,robotProgram:RobotProgramData,robotPeripheral:RobotPeripheralData
  });
}
