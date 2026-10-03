import {localizedRecord} from "../i18n/index.mjs";
import {VEHICLE_CATEGORIES,CONTROL_MODES,VEHICLE_STATES,CREW_ROLES,SYSTEM_STATES,SYSTEM_TYPES} from "./rules.mjs";
import {ITEM_CLEARANCES,ITEM_LABELS,ITEM_SKILLS} from "../items/config.mjs";
export const SKILLS=localizedRecord({"":"Sin especificar",...Object.fromEntries(ITEM_SKILLS.map(s=>[s.key,s.label]))});
export const CLEARANCES=localizedRecord({"":"Sin especificar",...Object.fromEntries(ITEM_CLEARANCES.map(k=>[k,ITEM_LABELS.clearances[k]]))});
export const VEHICLE_FIELDS=localizedRecord([
  {label:"Identificación y misión",fields:[["model","Modelo"],["designation","Designación"],["serial","Número de serie"],["category","Categoría (clave; admite personalizadas)","text"],["requiredClearance","Nivel de acceso","text",CLEARANCES],["assigned","Asignado","check"],["assignedTo","Asignado a"],["assignmentNotes","Misión / asignación","area"],["description","Descripción","area"],["purpose","Propósito"],["design","Diseño / apariencia","area"]]},
  {label:"Control",fields:[["control.manualAvailable","Control manual disponible","check"],["control.autopilotAvailable","Piloto automático disponible","check"],["control.electronicBrainAvailable","Cerebro electrónico disponible","check"],["control.currentMode","Control actual","text",CONTROL_MODES],["handlingSkill","Habilidad de pilotaje","text",SKILLS],["electronicBrain.name","Nombre del cerebro"],["electronicBrain.personality","Personalidad (DJ)","area"],["electronicBrain.programmingNotes","Programación (DJ)","area"],["electronicBrain.memory.capacity","Capacidad de memoria (vacío: desconocida)","number"]]},
  {label:"Ocupación y movimiento",fields:[["capacity","Capacidad normal (vacío: desconocida)","number"],["temporaryPassengerCapacity","Plazas adicionales de misión","number"],["movement.description","Método de locomoción / diseño","area"],["movement.currentMode","Modo actual (clave)"],["movement.currentSpeed","Velocidad actual (unidad del modo)","number"],["maneuverModifier","Modificador de maniobra asignado por el DJ","number"]]},
  {label:"Defensas y daños",fields:[["defense.smallArmsProtection","Advertir protección frente a armas pequeñas","check"],["defense.notes","Defensas / excepciones","area"],["damageNotes","Daños y averías","area"],["airDamageWarning","Advertir riesgo de accidente por daño en vuelo","check"]]},
  {label:"Notas del DJ",fields:[["notes","Notas públicas","area"],["gmNotes","Notas privadas","area"],["specialRules","Reglas especiales / limitaciones","area"],["specialSurprises","Sorpresas (solo DJ)","area"]]}
]);
export const ROW_FIELDS=localizedRecord({
  crew:[["actorUuid","UUID del Actor / Token"],["role","Puesto","text",CREW_ROLES],["notes","Notas","area"]],
  modes:[["key","Clave (land / water / air / personalizada)"],["label","Nombre"],["maxSpeed","Velocidad máxima (vacío: desconocida)","number"],["unit","Unidad (p. ej. km/h)"],["capacity","Capacidad propia del modo","number"],["maxSlopeDegrees","Pendiente máxima (grados)","number"],["terrain","Terreno"],["notes","Notas","area"]],
  systems:[["name","Sistema"],["category","Tipo","text",SYSTEM_TYPES],["status","Estado","text",SYSTEM_STATES],["notes","Averías / notas","area"]],
  flaws:[["name","Defecto"],["description","Descripción","area"],["hiddenFromPlayers","Oculto a jugadores","check"],["gmNotes","Notas privadas","area"]]
});
export const ROW_PATHS={crew:"crew",modes:"movement.modes",systems:"systems",flaws:"flaws"};
export {VEHICLE_CATEGORIES,VEHICLE_STATES};
