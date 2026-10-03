import {localizedRecord} from "../../i18n/index.mjs";
import {optionalNumber} from "./item-fields.mjs";
import {GUIDANCE,COUNTERMEASURES} from "../../vehicles/rules.mjs";
import {textField} from "./fields.mjs";
// Only metadata explicitly supplied by the source. None of these fields apply effects.
export const SOURCE_DETAIL_LABELS=localizedRecord({
  weaponTypeCode:"Tipo impreso en la tabla",normalDamageCode:"Daño normal (código de la tabla)",chargeTurns:"Cg · carga (turnos)",tableRecharge:"RCg · recarga (valor de la tabla)",tableNotes:"Notas de la tabla (r/cf/cg/cga/a)",
  rechargeTurns:"Recarga (turnos)",shotsBeforeRecharge:"Disparos antes de recarga",fireRatePerTurn:"Disparos por turno (fuente; sin automatización)",maxFlightTurns:"Vuelo máximo (turnos)",speedMetersPerSecond:"Velocidad (m/s)",radiusKm:"Radio (km)",radiusMeters:"Radio (m)",guidance:"Guiado de misil",countermeasure:"Contramedida",
  areaRadiusMeters:"Radio de área (m)",illuminationRadiusMeters:"Radio de iluminación (m)",
  malfunctionRadiusMeters:"Radio de fallo (m)",webLengthMeters:"Longitud de telaraña (m)",
  projectileMovementMetersPerTurn:"Movimiento del proyectil (m/turno)",expansionMetersPerTurn:"Expansión (m/turno)",
  coneDegrees:"Ángulo del cono (grados)",durationTurns:"Duración (turnos)",
  durationFormula:"Duración (regla)",malfunctionDamageCode:"Daño del fallo (código de la fuente)",
  ammunitionCategory:"Categoría de munición",detonatorType:"Tipo de detonador"
});
export const SOURCE_DETAIL_NUMBERS=Object.keys(SOURCE_DETAIL_LABELS).filter(k=>!["weaponTypeCode","normalDamageCode","tableNotes","guidance","countermeasure","durationFormula","malfunctionDamageCode","ammunitionCategory","detonatorType"].includes(k));
export function sourceDetails(){
  return new foundry.data.fields.SchemaField(Object.fromEntries(Object.keys(SOURCE_DETAIL_LABELS).map(key=>[key,key==="guidance"||key==="countermeasure"?new foundry.data.fields.StringField({required:true,blank:true,initial:"",choices:Object.keys(key==="guidance"?GUIDANCE:COUNTERMEASURES)}):SOURCE_DETAIL_NUMBERS.includes(key)?optionalNumber():textField()])));
}
