import {tr} from "../i18n/index.mjs";
/** Canonical d20 order from character creation. Aliases preserve existing Actor names. */
export const POWER_DEFAULTS = Object.freeze({rangeMeters:5, areaDiameterMeters:5,
  durationType:"gm", durationFormula:null, durationNotes:"Normalmente 1–5 minutos; decide el DJ."});
export const POWER_RESULTS = Object.freeze({criticalSuccess:"Éxito crítico",success:"Éxito",failure:"Fallo",criticalFailure:"Fallo crítico"});
const define=(key,label,aliases,specialRules,results,extra={})=>Object.freeze({
  ...POWER_DEFAULTS,key,label,aliases,targetType:"object",supportsCombat:true,specialRules,
  results:Object.freeze(Object.fromEntries(Object.keys(POWER_RESULTS).map((key,i)=>[key,results[i]]))),
  ...(extra.targetType==="self"?{rangeMeters:0,areaDiameterMeters:null}:{}),...extra
});
const entries=[
  define("adrenalineControl","Control de Adrenalina",[],
    "Aumenta Fuerza, Agilidad y capacidades dependientes durante un minuto. El DJ determina los incrementos, nunca se alteran los valores base. Al acabar: agotamiento equivalente a Herido; repetir sin descansar causa agotamiento equivalente a Incapacitado durante horas.",
    ["Capacidad extraordinaria; el DJ fija la magnitud.","Mejora temporal determinada por el DJ.","No se logra la mejora deseada.","Consecuencia adversa que debe adjudicar el DJ."],{durationType:"minutes",durationFormula:"1",durationNotes:"1 minuto, seguido de agotamiento hasta descanso suficiente.",targetType:"self"}),
  define("charisma","Carisma",[],
    "Influencia química sobre humanos: confianza, simpatía y apertura. Quien reconozca el efecto puede resistir mediante Cinismo y fingir que sigue influido.",
    ["Influencia especialmente eficaz.","Confianza y apertura; el DJ interpreta la reacción.","Influencia inadecuada o inexistente.","Reacción no deseada; adjudicación del DJ."],{targetType:"actor",resistance:"cynicism"}),
  define("mindReading","Lectura mental",["Lectura Mental"],
    "Requiere contacto físico. Es doloroso y agotador para ambos; el uso prolongado puede exigir adjudicación de agotamiento/heridas. El DJ proporciona la información según profundidad y cantidad; nunca se leen notas privadas automáticamente.",
    ["Información coherente y útil.","Información útil, posiblemente incompleta.","Información distorsionada y recuerdos irrelevantes.","Resultado especialmente confuso o irrelevante."],{rangeMeters:0,targetType:"actor"}),
  define("electroshock","Electroshock",[],
    "Gran resistencia a descargas eléctricas. Descarga a unos 5 m con efecto semejante a un aturdidor. No existe ND verificado; el DJ puede aplicar Aturdido mediante Salud. No se inventa una duración de aturdidor.",
    ["Descarga especialmente eficaz.","Efecto de aturdidor, adjudicado por el DJ.","Efectos secundarios indeseados.","Autodescarga o interferencia eléctrica/electrónica insólita."],{targetType:"actor",durationType:"instantaneous",durationNotes:"La consecuencia de aturdimiento se adjudica aparte."}),
  define("empathy","Empatía",[],
    "Percibe y proyecta emociones. Más preciso sobre una persona que sobre una multitud. Un uso adecuado y exitoso permite +5 temporal a habilidades de Cinismo; activar solo en la situación aprobada por el DJ.",
    ["Impresión emocional exagerada e intensa.","Influencia emocional lograda; +5 contextual a habilidades de Cinismo.","Sin efecto.","La emoción rebota sobre el mutante con intensidad adversa."],{targetType:"actor"}),
  define("energyField","Campo de Energía",[],
    "Campo luminoso a unos 20 cm del cuerpo, durante aproximadamente un minuto. Absorbe energía, con interacciones peligrosas ante fuentes intensas. Protección exacta no suministrada. Después produce agotamiento equivalente a Herido hasta varias horas de reposo o una siesta; no es una herida permanente.",
    ["Protección corporal completa; magnitud a determinar por el DJ.","Campo funcionando normalmente.","Funcionamiento parcial o indeseado.","La energía puede dirigirse hacia el interior del cuerpo."],{durationType:"minutes",durationFormula:"1",durationNotes:"1 minuto; después agotamiento temporal.",targetType:"self"}),
  define("superSense","Hipersentido",["Supersentido"],
    "Visión distante y con poca luz, oído, tacto y olfato muy sensibles. Permite concentrarse en una sensación. No altera permanentemente Percepción.",
    ["Percepción extraordinariamente precisa.","Sensación amplificada clara y útil.","Sensaciones confusas o poco útiles.","Sobrecarga sensorial o alucinaciones."],{targetType:"self"}),
  define("levitation","Levitación",[],
    "Campo de unos 20 cm, incluyendo ropa y efectos personales. Flotación controlada; desplazamiento impulsándose en superficies. Éxito crítico: capacidad cercana al vuelo durante 1d20 turnos. Sin simulación física.",
    ["Casi vuelo; duración sugerida 1d20 turnos.","Flotación controlada, ascenso y descenso.","Sin efecto.","Campo gravitatorio peligroso o incontrolable."],{targetType:"self",criticalDurationFormula:"1d20"}),
  define("mechanicalEmpathy","Empatía Mecánica",[],
    "Comunión con máquinas, robots y ordenadores. Mutación especialmente traidora según la fuente. El DJ decide cooperación e interpretación de órdenes; no se automatiza la conducta.",
    ["Rapport extraordinario con la máquina.","Confianza y cooperación de la máquina.","Reacción negativa o falta de cooperación.","Reacción mecánica extremadamente desfavorable."]),
  define("superMetabolism","Adaptación metabólica",["Supermetabolismo"],
    "Digiere y obtiene alimento de casi cualquier materia orgánica, incluso tóxica; puede digerir algunos objetos inorgánicos sin nutrirse. No se implementa nutrición.",
    ["Digestión especialmente eficaz.","Funciona normalmente.","Dolor intestinal agudo.","Herido, Incapacitado o Muerto según gravedad decidida por el DJ."],{targetType:"self"}),
  define("mechanicalIntuition","Intuición Mecánica",[],
    "Comprende funcionamiento y diseño básico de dispositivos, incluidos desconocidos, antiguos o experimentales. Información privada proporcionada por el DJ, sin modificar Items.",
    ["Conclusiones muy precisas; quizá puede operar el dispositivo.","Comprende principios y funcionamiento general.","Comprensión parcial o incompleta.","Conclusiones totalmente falsas y engañosas."]),
  define("mentalBlast","Rayo mental",["Rayo Mental"],
    "Afecta criaturas a unos 5 m, excepto el usuario. Cada objetivo tira Resistencia con modificador determinado por el DJ según el éxito del poder. Fallar permite supresión mental/aturdimiento; superar puede ser desagradable. Sin ND físico.",
    ["Supresión especialmente intensa; el DJ fija la resistencia.","Los objetivos realizan una tirada de Resistencia.","Efecto inadecuado.","Puede aturdir o dejar inconsciente al propio mutante."],{targetType:"actor",resistance:"endurance",durationType:"instantaneous",durationNotes:"Consecuencias mentales según adjudicación."}),
  define("polymorphism","Polimorfismo",[],
    "Altera apariencia; imitar humanos es más fácil que cambiar estructura o masa. No cambia automáticamente retrato ni Token.",
    ["Apariencia perfecta.","Apariencia aproximadamente deseada.","Cambio escaso o inútil.","Cambio inesperado, quizá nueva forma natural permanente a juicio del DJ."],{durationType:"minutes",durationNotes:"Aproximadamente 1–5 minutos; excepción permanente solo por decisión explícita del DJ.",targetType:"self"}),
  define("precognition","Precognición",[],
    "Intuiciones limitadas sobre planes, riesgos o beneficios. El DJ interpreta; no hay profecía determinista ni acceso automático a datos ocultos.",
    ["Intuición muy exacta y útil.","Intuición generalmente útil.","Intuición errónea o inútil.","Intuición espectacularmente engañosa."],{targetType:"self"}),
  define("pyrokinesis","Pirokinesis",[],
    "Prende materia inflamable a unos 5 m. Intensidad y propagación dependen del combustible y el resultado. El DJ describe fuego y consecuencias; sin simulación ni ND inventado.",
    ["Fuego intenso de rápida propagación.","Fuego normal.","No prende.","Fuego en un lugar indeseado, quizá sobre el mutante o su equipo."],{durationType:"instantaneous",durationNotes:"El fuego resultante depende del entorno."}),
  define("regeneration","Regeneración",[],
    "Puede intentarse estando Herido o Incapacitado. El DJ decide rapidez y aspecto. Nunca revive Muerto o Vaporizado. La recuperación usa Salud: Incapacitado → Herido o Herido → Sano, cuando corresponda.",
    ["Curación instantánea; el DJ confirma la transición.","Curación en horas o días según gravedad; no se cura de inmediato automáticamente.","Solo recuperación normal.","Regeneración aberrante, tejidos u órganos duplicados o mal situados."],{targetType:"self",durationType:"gm",durationNotes:"Instantánea con EC; horas/días con éxito normal."}),
  define("telekinesis","Telekinesis",["Telequinesis"],
    "Levantar unos 10 kg es una tarea normal sin modificador. El DJ ajusta por peso, distancia y complejidad. No se automatiza física ni movimiento de objetos.",
    ["Manipulación mejor de lo esperado.","Efecto deseado.","Sin efecto.","Efecto inesperado: dirección opuesta o fuerza excesiva, entre otros."],{baselineWeightKg:10}),
  define("telepathy","Telepatía",[],
    "Lee pensamientos conscientes superficiales de un humano visible; requiere concentración. Cambiar de mente requiere otra tirada y no permite leer varias claramente. El DJ comunica la información, nunca notas privadas del Actor.",
    ["Lectura completa y coherente.","Pensamientos con lagunas o inconsistencias.","Pensamientos mezclados o de otra persona cercana.","Pensamientos confusos o de una persona lejana/equivocada."],{targetType:"actor"}),
  define("teleportation","Teleportación",[],
    "Campo de unos 20 cm transporta ropa y objetos llevados. Familiaridad y visualización determinan dificultad. Puede manifestarse involuntariamente ante peligro mortal, solo por decisión del DJ. No mueve Tokens sin confirmación explícita del DJ.",
    ["Traslado preciso y seguro, incluso a gran distancia.","Llega al lugar elegido.","Fallo o pérdida parcial de objetos según el DJ.","Destino muy indeseado."],{rangeMeters:null,durationType:"instantaneous",durationNotes:"Instantánea; destino confirmado por el DJ.",targetType:"location"}),
  define("xRayVision","Vista con Rayos X",["Visión de Rayos-X","Visión de Rayos X"],
    "Percepción de amplio espectro electromagnético. Depende de materiales, densidad, conocimiento y habilidades técnicas/médicas. El DJ revela información, no se descubre la Escena automáticamente.",
    ["Percepción especialmente precisa.","Impresiones coherentes y útiles.","Impresiones confusas o ininteligibles.","Imágenes interiores absurdas o engañosas."])
];
export const POWER_REGISTRY=Object.freeze(Object.fromEntries(entries.map(p=>[p.key,p])));
export const POWER_TABLE=Object.freeze(entries.map(p=>p.key));
export const POWER_NAMES=Object.freeze(entries.map(p=>p.label));
const normalize=value=>String(value??"").normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().trim();
export function identifyPower(name){return entries.find(p=>[p.key,p.label,tr(p.label),...p.aliases].some(alias=>normalize(alias)===normalize(name)))??null;}
