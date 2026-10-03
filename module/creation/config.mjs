import {POWER_NAMES} from "../powers/registry.mjs";
import {SOCIETY_TABLE,SOCIETY_REGISTRY,societyKeyForRoll,identifySociety} from "../societies/registry.mjs";
export const CREATION_STEPS = [
  ["identity", "Identidad"], ["attributes", "Atributos"], ["derived", "Capacidades"],
  ["service", "Servicio"], ["mutation", "Mutación"], ["society", "Sociedad Secreta"],
  ["skills", "Habilidades"], ["equipment", "Equipo inicial"], ["review", "Revisar y confirmar"]
];

export const SERVICES = Object.freeze({SSI: null, STC: null, SBD: null, SDF: null, SPL: null, SEG: null, SID: null, SCP: null});
const SERVICE_TABLE = [[2, "SSI"], [4, "STC"], [8, "SBD"], [11, "SDF"], [14, "SPL"], [16, "SEG"], [18, "SID"], [20, "SCP"]];
export const MUTANT_POWERS = POWER_NAMES;
export const SOCIETIES = Object.freeze(SOCIETY_TABLE.map(([, key]) => SOCIETY_REGISTRY[key]?.displayName??"Otra"));
export const DEVELOPMENT_POINTS = 30;

// TODO: Fill only after verifying the Service-to-skill table in the rulebook.
// Keys are real Services; entries must be full paths such as "perception.medicine".
// Empty lists deliberately grant no unverified maximum-14 exceptions.
export const SERVICE_SKILLS = Object.freeze(Object.fromEntries(Object.keys(SERVICES).map(key => [key, Object.freeze([])])));

export function validateD20(value) {
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error("El resultado debe ser un entero entre 1 y 20.");
  return value;
}
export function serviceForRoll(value) { return SERVICE_TABLE.find(([max]) => validateD20(value) <= max)[1]; }
export function powerForRoll(value) { return MUTANT_POWERS[validateD20(value) - 1]; }
export function societyForRoll(value) { return SOCIETY_REGISTRY[societyKeyForRoll(value)]?.displayName??"Otra"; }
export function serviceLabel(code) { return SERVICES[code] ? `${code} — ${SERVICES[code]}` : code; }
export function skillMaximum(service, path) { return SERVICE_SKILLS[service]?.includes(path) ? 14 : 12; }

// No verified list of qualifying psychic powers was supplied. Never change a power
// automatically or pretend to certify it. Require a deliberate rulebook/GM review.
export function requiresPsychicReview(name) { return identifySociety(name)?.key === "psionics"; }
export const PSYCHIC_WARNING = "Psiónicos exige un poder mutante psíquico apropiado. Revisad la compatibilidad con el DJ y el manual antes de confirmar. El DJ puede corregir el poder en el paso Mutación. No se cambia ni se repite automáticamente.";
