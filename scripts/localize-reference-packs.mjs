import fs from "node:fs";
import {SKILL_REFERENCES} from "../module/references/skills.mjs";
import {SERVICE_REFERENCES} from "../module/creation/service-reference.mjs";
import {messageKey} from "../module/i18n/index.mjs";
const additional={
  "Granadas":"Grenades","Soborno":"Bribery",
  "Paranoia 2ª Edición - Servicios":"Paranoia 2nd Edition - Services",
  "Paranoia 2ª Edición - Poderes Mutantes":"Paranoia 2nd Edition - Mutant Powers",
  "Descripción":"Description","Habilidades del Servicio":"Service Skills","Reglas":"Rules","Alcance":"Range","Duración":"Duration","Resultados":"Results",
  "Según adjudicación del DJ":"As adjudicated by the GM",
  "Lista de referencia del manual; esta entrada no modifica automáticamente las habilidades del personaje.":"Rulebook reference list; this entry does not automatically change the character's skills.",
  "Fuente: manual español, páginas 43–46 y Anexo A.":"Source: Spanish rulebook, pages 43–46 and Annex A.",
  "Fuente: registro canónico de poderes mutantes; manual español, Poderes Mutantes.":"Source: canonical mutant power registry; Spanish rulebook, Mutant Powers.",
  "Pelea (porra)":"Fighting (truncheon)","Láser":"Laser","Robobasurero":"Garbagebot","Armas Blancas Primitivas":"Primitive Melee Weapons","Armas Proyectil":"Projectile Weapons","Roboaviones Cóndor":"Condor Roboplanes","Ingeniería":"Engineering","Bioingeniería":"Bioengineering"
};
for(const s of SERVICE_REFERENCES){additional[s.name]=s.englishName;additional[`${s.key} — ${s.name}`]=`${s.key} — ${s.englishName}`;additional[s.description]=s.englishDescription;}
for(const s of SKILL_REFERENCES){additional[s.description]=s.englishDescription;if(s.englishLabel)additional[s.label]=s.englishLabel;additional[`Fuente: manual español, páginas ${s.page}.`]=`Source: Spanish rulebook, pages ${s.page}.`;}
Object.assign(additional,{"Paranoia 2ª Edición - Atributos y Habilidades":"Paranoia 2nd Edition - Attributes and Skills","Atributo asociado":"Associated Attribute","Para qué sirve":"What it is used for","Guía":"Guide","Atributo":"Attribute","Habilidad":"Skill","Capacidad":"Capability","Referencia del manual":"Rulebook Reference"});
for(const lang of ["es","en"]){const path=new URL(`../lang/${lang}.json`,import.meta.url),data=JSON.parse(fs.readFileSync(path));
  for(const [source,english] of Object.entries(additional))data.P2.Text[messageKey(source).split(".").pop()]=lang==="es"?source:english;
  fs.writeFileSync(path,JSON.stringify(data,null,2)+"\n");
}
