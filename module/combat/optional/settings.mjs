import {localizedRecord,messageKey} from "../../i18n/index.mjs";
const NS="paranoia-2-edition";
const OPTIONAL_RULE_NAMES=Object.freeze({surprise:"Sorpresa",burstFire:"Ráfagas",range:"Alcance detallado",cover:"Cobertura",movement:"Modificadores de movimiento",hitLocation:"Localización del daño",polyvalentArmor:"Armadura polivalente",weaponHandling:"Desenfundar / enfundar",ammunition:"Munición / recarga",malfunctions:"Averías de armas",repairs:"Reparación de armas"});
export const OPTIONAL_RULES=localizedRecord(OPTIONAL_RULE_NAMES);
export function enabled(key){try{return game.settings.get(NS,"useOptionalCombatRules")===true&&game.settings.get(NS,`optionalCombat.${key}`)===true;}catch{return false;}}
export function registerOptionalSettings(){
  game.settings.register(NS,"useOptionalCombatRules",{name:messageKey("Reglas de combate opcionales"),hint:messageKey("Activa solo las opciones seleccionadas abajo. Desactivado conserva el combate básico."),scope:"world",config:true,type:Boolean,default:false});
  for(const [key,label] of Object.entries(OPTIONAL_RULE_NAMES))game.settings.register(NS,`optionalCombat.${key}`,{name:messageKey("Combate opcional: "+label),hint:messageKey("Requiere activar las reglas de combate opcionales. Sin tablas inventadas del Anexo B."),scope:"world",config:true,type:Boolean,default:false});
}
