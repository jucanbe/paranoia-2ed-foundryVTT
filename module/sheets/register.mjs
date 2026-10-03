import {tr} from "../i18n/index.mjs";
import { CharacterSheet } from "./character-sheet.mjs";
import { NPCSheet } from "./npc-sheet.mjs";
import {VehicleSheet} from "./vehicle-sheet.mjs";
import {RobotSheet} from "./robot-sheet.mjs";
import { SimpleItemSheet } from "./item-sheet.mjs";
import { LABELS } from "./labels.mjs";

export function registerSheets() {
  for(const type of ["character","npc","robot","vehicle"])CONFIG.Actor.typeLabels[type]=`P2.Actor.${type}`;
  for(const type of ["weapon","armor","equipment","robotProgram","robotPeripheral"])CONFIG.Item.typeLabels[type]=`P2.Item.${type}`;
  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.registerSheet(foundry.documents.Actor,"paranoia-2-edition",VehicleSheet,{types:["vehicle"],makeDefault:true,label:()=>tr("Vehículo")});
  DocumentSheetConfig.registerSheet(foundry.documents.Actor,"paranoia-2-edition",RobotSheet,{types:["robot"],makeDefault:true,label:()=>tr("Robot")});
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "paranoia-2-edition", NPCSheet, {
    types: ["npc"], makeDefault: true, label: ()=>tr("PNJ — ficha compacta")
  });
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "paranoia-2-edition", CharacterSheet, {
    types: ["character"], makeDefault: true, label: ()=>LABELS.sheet
  });
  DocumentSheetConfig.registerSheet(foundry.documents.Item, "paranoia-2-edition", SimpleItemSheet, {
    types: ["equipment", "weapon", "armor","robotProgram","robotPeripheral"], makeDefault: true, label: ()=>LABELS.edit
  });
}
