# Combate opcional de Paranoia 2ª edición

Implementado sobre las fases, RollService, DamageService, salud y objetos existentes; no hay otro motor de combate ni otra tabla de daño. Validado en Foundry VTT 14.368.

## Activación

Todas las opciones World comienzan en `false`. `useOptionalCombatRules` es el interruptor general. Cada opción requiere además su propio interruptor:

| Clave | Regla |
| --- | --- |
| `optionalCombat.surprise` | Sorpresa |
| `optionalCombat.burstFire` | Ráfagas |
| `optionalCombat.range` | Alcance detallado |
| `optionalCombat.cover` | Cobertura |
| `optionalCombat.movement` | Modificadores de movimiento |
| `optionalCombat.hitLocation` | Localización del daño |
| `optionalCombat.polyvalentArmor` | Armadura polivalente |
| `optionalCombat.weaponHandling` | Desenfundar / enfundar |
| `optionalCombat.ammunition` | Munición / recarga |
| `optionalCombat.malfunctions` | Averías |
| `optionalCombat.repairs` | Prevención y reparación |

Instalar la actualización no activa ninguna regla ni modifica las configuraciones de mundos existentes. Con el interruptor general apagado se conservan las reglas básicas, incluido el +4 existente por bocajarro, defensa y salud. Las opciones desactivadas no bloquean por munición, preparación, averías o heridas localizadas. La salud categórica básica sigue aplicándose.

## Arquitectura y orden

`module/combat/optional/rules.mjs` centraliza la aritmética. `settings.mjs` registra y consulta opciones; `runtime.mjs` conecta declaraciones, preparación, recarga y estado de armas; `ui.mjs` genera los controles pertinentes; `wounds.mjs` y `repairs.mjs` ofrecen operaciones reutilizables.

Orden del ataque: habilidad actual → división y redondeo hacia arriba si ráfaga → multiplicador de alcance → penalización de salud → cobertura → movimiento de atacante y defensor → evasión del defensor → modificador del DJ → tirada d20 mediante RollService → avería según dado natural → daño mediante DamageService → localización manual si el resultado es Herido. No se añade dificultad genérica por el alcance ni se impone un mínimo al objetivo efectivo.

Las solicitudes usan el coordinador de combate y los mensajes nativos privados existentes. La identidad del solicitante procede del autor real de Foundry. No se transmiten documentos Actor completos en las respuestas de combate. Las instantáneas contienen consecuencias mecánicas de heridas, sin sus notas.

## Sorpresa

Antes de comenzar, el DJ usa «Turno de Sorpresa» y elige combatientes del lado que sorprende. El Combat registra `state.phase = surpriseResolution`, `surprise.surprisingIds`, `surprisedIds` y `resolved`. No se usa iniciativa ni se detectan sigilo o visión automáticamente.

El lado sorprendido declara evasión o movimiento defensivo; no ataques, recargas ni otras acciones normales, salvo excepción explícita del DJ. El lado atacante puede resolver su acción. Al terminar se limpian las declaraciones y comienza Decisión de PNJ del turno normal 1. Foundry usa internamente round 1 durante el preturno para sus documentos y controles; el turno normal no pasa a 2. El tiempo del mundo avanza unos cinco segundos al terminar Sorpresa.

## Ráfaga, alcance, cobertura y movimiento

La capacidad de ráfaga es explícita en cada arma y comienza desactivada. Una declaración RÁFAGA contiene varios `targetIds` y sigue siendo una acción con una reserva de ataque. Hasta tres objetivos reciben tiradas independientes en una tarjeta agrupada. Se comprueba su separación por parejas; si la geometría no puede verificarse, el DJ confirma ≤5 m. No se infiere capacidad por el nombre del arma.

La habilidad 14 contra tres objetivos se convierte en 5 antes de los modificadores individuales. Cada objetivo dispone de distancia/banda y cobertura propias. La tarjeta mantiene la adjudicación de daño por objetivo, incluidos los casos de ND desconocido, área o avería pendiente.

`maxRangeMeters` es nullable: no se extrae un máximo inventado del texto. La distancia automática usa `canvas.grid.measurePath` en una escena activa con unidades reconocidas en metros o pies; cualquier ausencia o error permite selección manual. Un máximo 50 produce quemarropa 0–5, corta >5–16, media >16–33, larga >33–50 y fuera de alcance >50. Las divisiones usan límites enteros hacia abajo; las distancias continuas se comparan con esos límites. Multiplicadores: ×2, ×1, ÷2 y ÷4; las divisiones de habilidad se redondean hacia abajo.

Cobertura: ninguna 0, poca −1, mitad −4, casi completa −15. Movimiento humano procede de las declaraciones: quieto/Paseo 0, Marcha −1 y Carrera −4; ambos participantes se suman. Robots y vehículos conservan su locomoción propia y adjudicación del DJ. Sprint sigue impidiendo atacar. Cobertura, movimiento y evasión −4 pueden acumularse; el DJ puede omitir movimiento o introducir su ajuste.

## Heridas localizadas

`health.wounds` añade registros actuales, no otro sistema de salud. El DJ elige brazo, pierna, pecho, abdomen o cabeza; no se tira ninguna tabla aleatoria. La tarjeta de daño ofrece localización tras Herido y las sheets permiten localización manual deliberada.

- Brazo: estado inutilizado; se respeta lado y `weapon.requiredArm`. No se eliminan objetos.
- Pierna: permite Marcha/cojear; rechaza Carrera, Sprint y Zoom. La interfaz recuerda que no permite usar bicicleta normalmente.
- Pecho/abdomen: impiden desplazamiento normal; las acciones estacionarias conservan las penalizaciones básicas.
- Cabeza: ceguera, sordera, incapacitación, deterioro cognitivo permanente, efecto permanente personalizado o narrativa. Solo la opción explícita de incapacitación cambia el estado de salud; los demás efectos quedan documentados para adjudicación, sin inventar modificadores ni automatizar visión.

Herido mantiene −4. Dos resultados Herido siguen escalando a Incapacitado. Los registros se conservan al quedar incapacitado o morir. Sanar desactiva las restricciones temporales; las consecuencias permanentes se conservan. Un clon nuevo reinicia la salud física y archiva las localizaciones del cuerpo anterior en `clones.history[].localizedWounds`.

## Armaduras

`system.protections` contiene `{type,value}` por protección. `module/items/protection.mjs` proporciona `protectionEntries`, `protectionCode` y `getProtectionFor`. ArmorData expone `armorCode` y `getProtectionFor(category, options)`.

La migración conserva `protectionType`/`protectionValue` y los interpreta como una entrada. Un código antiguo explícito como L4 sigue siendo L4. La primera entrada mantiene la representación básica compatible; el editor añade, cambia y quita entradas sin exigir una cadena combinada manual. Con polivalente activo, DamageService consulta la API central; con la opción apagada usa la protección básica original.

B3/L1 protege 3 contra cuerpo a cuerpo, 1 contra láser y 0 contra proyectiles. L4/B3/P2/PP6 conserva los cuatro valores por categoría. T se aplica a cualquier categoría; se elige el mayor valor pertinente entre T y el específico, sin sumarlos ni acumular varias armaduras.

## Manejo y munición

Preparación y progreso son flags transitorios del Combatant: `weaponReady` y `weaponProgress`. Desenfundar y enfundar son acciones de un turno; un acceso difícil puede usar `drawTurnsRequired`. Cambiar normalmente requiere enfundar primero y después desenfundar. Permiten defensa y movimiento hasta Carrera, sin otra acción normal. El DJ puede preparar un arma directamente antes de comenzar o completar el manejo con una excepción explícita. Las armas integradas no se tratan como armas enfundadas.

Recargar consume la acción normal, sin desplazamiento o evasión simultánea salvo excepción. Usa `reloadTurns`, por defecto un turno cuando no hay dato específico, y necesita munición compatible y capacidad verificadas. El progreso de varios turnos aparece en el tracker.

Se conserva `ammunition.capacity`; `ammoCurrent` representa disparos en la carga instalada, `ammoType` identifica un catálogo de munición o un Item concreto. La pistola láser canónica puede resolver la asociación con la carga existente `laser-charge` y su capacidad de seis disparos, sin crear otra definición de munición. Una recarga consume una unidad de carga transportada y llena el arma; cantidad de cargas y disparos instalados permanecen separados.

La recarga guarda inventario y carga en una actualización del Actor. `Item.flags.paranoia-2-edition.reloadReceipt` identifica combatiente, combate, turno, cuerpo y arma, permitiendo recuperar una confirmación fallida sin consumir otra unidad. Cero disparos bloquea el tiro normal. Datos desconocidos quedan manuales; no se fabrican cantidades. Un tiro normal consume uno; una ráfaga usa `burstAmmoCost` solo si está verificado. Si falta ese coste se avisa al DJ para ajuste manual, sin deducir un número supuesto.

## Averías y reparación

`reliabilityType` usa `normal`, `experimental` y `trulyExperimental`; el booleano antiguo se traduce si no existe categoría explícita. Umbrales genéricos: normal 20, experimental 19; verdaderamente experimental usa `malfunctionThreshold` o adjudicación manual si falta. Se usa el dado natural de ataque.

`malfunctioned` conserva el estado. Las reglas especiales originales se muestran para resolver su efecto; no se sustituyen las averías particulares por daño o destrucción inventados. `malfunctionShot` puede declarar resolver/cancelar el disparo si existe dato verificado; por defecto queda manual. El DJ puede forzar el estado en la ficha o ignorar la avería automática durante un ataque.

Prevención y reparación llaman a RollService. Prevenir una consecuencia no limpia `malfunctioned`; reparar con éxito sí lo limpia. Se usa `repairSkill`, o el DJ elige una habilidad existente si falta. `repairable = false` y armas verdaderamente experimentales rechazan reparación normal; una excepción explícita del DJ puede permitirla.

El propietario puede solicitar reparación por el coordinador con la habilidad ya configurada. Elegir una habilidad ausente o autorizar excepciones corresponde al DJ. Los controles de chat solo se habilitan para mensajes de ataque auténticos del DJ y armas controladas por el usuario. Cambiar directamente munición/avería desde un cliente propietario se rechaza cuando las opciones correspondientes están activas.

## API

Se mantiene `game.paranoia.combat.request(combat, operation, options, combatantId)` y `attack`. Operaciones nuevas: `surprise`, `handling`, `setReady` y la solicitud interna `weaponRepair`. Se exponen también `game.paranoia.combat.addWound(actor, options)` y `repairWeapon(weapon, options)`. Configurar Sorpresa, preparación directa y excepciones requiere DJ. Los propietarios usan sus declaraciones, ataques y operaciones permitidas mediante el coordinador.

## Archivos

Creado: los seis módulos de `module/combat/optional/`; `module/items/protection.mjs`, `protection-dialog.mjs`; `templates/combat/burst-chat.hbs`; `tests/optional-combat.test.mjs`, `optional-combat.live.mjs`; `scripts/verify-optional-combat-live.cjs`; este documento.

Modificado: `module/combat/{config,register,rules,state,service,dialogs,tracker,damage}.mjs`; modelos `weapon`, `armor`, `health`, `citizen`, `clones`; `module/clones/rules.mjs`, `module/health/{service,dialogs}.mjs`, `module/damage/service.mjs`, `module/sheets/item-sheet.mjs`; plantillas de diálogo/chat/declaración/footer/tracker de combate, Item, Character y NPC. Se añade referencia a esta documentación desde el README del combate.

## Pruebas

`node --test tests/*.test.mjs`: 186 aprobadas, ninguna fallida. Las 15 pruebas nuevas verifican cifras fuente, umbrales, independencia de opciones, armadura, heridas, manejo, consumo, falta de munición y recuperación de recargas con fallos de guardado/confirmación.

`scripts/verify-optional-combat-live.cjs`: mundo aislado `society-fresh-validation`, puerto 30001, Foundry 14.368, sesiones DJ y propietario. Verifica Sorpresa y evasión, vuelta a turno 1, ráfaga agrupada y bloqueo de repetición, orden de modificadores, fuera de alcance, desenfundado, recarga y consumo, prevención/reparación separadas, excepción verdaderamente experimental, heridas y sanación/permanencia, escalado a Incapacitado, reinicio y archivo físico al clonar, migración de armadura/arma, editor de protecciones, ataque y reparación de propietario coordinados, y salvas integradas de robot y cerebro electrónico con munición y alcance. Cero errores JavaScript o de consola.

El combate básico, creación, economía, PD, ascensos, sociedades, poderes, daño, clonado, PNJ, robots y vehículos conservan sus pruebas de regresión. No se cambió contenido ni precios de Compendios.

## Anexo B pendiente

No se inventan máximos de alcance, estadísticas de armas, probabilidades de localización, modificadores adicionales ni efectos de avería sin dato verificable. Se mantienen controles manuales del DJ, textos de reglas particulares y metadatos para incorporar datos oficiales en el futuro. No se implementa simulación de cobertura por rayos ni detección automática de sorpresa.
