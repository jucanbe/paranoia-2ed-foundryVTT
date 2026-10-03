# Nivel de Seguridad: ascensos y degradaciones

Se reutilizan `module/actors/identity.mjs` (orden, abreviaturas e identidad), el informe final de `module/treason/dialogs.mjs`, TreasonService y su almacén cifrado. No se añade otro enum ni otro registro de traición.

## Requisitos proporcionados

Tabla central: `module/clearance/rules.mjs`, `PROMOTION_REQUIREMENTS`. Los requisitos corresponden al **nivel de destino**.

| Destino | Requisito |
| --- | --- |
| Rojo | Denunciar a su mejor amigo de la infancia; confirmación del DJ |
| Naranja | 1 misión exitosa |
| Amarillo | 1 misión exitosa |
| Verde | 2 misiones exitosas |
| Azul | 2 misiones exitosas |
| Índigo | 3 misiones exitosas |
| Violeta | 3 misiones exitosas |
| Ultravioleta | Requisito especial / decisión del Máster; sin contador inventado |

No hay ascensos, degradaciones, recompensas, cambios de Servicio, poderes ni equipo automáticos. Un traidor declarado queda bloqueado aunque sus PT hayan descendido. Los PT no nulos por sí solos no bloquean el ascenso.

## Datos, migración e identidad

El modelo Citizen añade `securityProgress` con `successfulMissions`, `requirementSatisfied` y `countedMissionIds`. El próximo nivel se deriva del CS actual. Los valores iniciales del DataModel incorporan cero misiones a personajes antiguos sin cambiar su CS, identidad ni otros datos; no se deduce progreso pasado. No se ejecutó una migración de los Mundos del usuario.

`clearanceProgressionEnabled` comienza en false para PNJ. Los personajes siempre tienen seguimiento. Robots y vehículos quedan excluidos.

Al ascender se reinician contador y confirmación especial. Las referencias de misiones contadas se conservan durante toda la vida del ciudadano, también después de ascensos y clones. Un cambio de clon conserva el CS, el progreso y el historial externo por UUID. Las degradaciones reinician progreso por defecto; el DJ puede conservarlo.

El servicio actualiza únicamente CS/progreso/seguimiento mediante Actor.update. El hook Citizen existente construye Actor.name y prototypeToken.name en la misma actualización. Su helper de Tokens ligados mantiene los alias manuales y no renombra copias desligadas.

## API y controles

API: `game.paranoia.SecurityClearanceService`, implementada en `module/clearance/service.mjs`.

- `getCurrent`, `getNext`, `getPrevious`, `getPromotionRequirements`, `canPromote`.
- `promote(actor, {reason, missionReference, notes, override, announce})`.
- `demote(actor, {target, reason, notes, preserveProgress, confirmMultiLevel, announce})`.
- `setClearance(actor, key, options)` para correcciones del DJ.
- `correctProgress(actor, {successfulMissions, requirementSatisfied, reason, notes})`.
- `recordSuccessfulMission(actor, missionId, {validSurvivor, countForPromotion, override, reason})`; también acepta un objeto de opciones con missionId.
- `enableTracking`, `getHistory`, `resumeAction`, `resumeMissionReport`.

Requiere desbloquear el **registro de traición** para guardar cambios y comprobar la condición de traidor. El DJ coordinador realiza las escrituras. Las fichas ofrecen Ascender, Degradar, Cambiar nivel, Corregir progreso e Historial de CS. Para Rojo/UV se confirma el requisito especial en Corregir progreso o se registra una excepción expresa en Ascender. Degradar varios niveles exige una segunda confirmación. El panel existente del DJ añade ASCENSOS.

`showPromotionProgressToPlayers` es una opción de Mundo, visible en español y activada por defecto. Solo el propietario puede ver progreso; observadores no lo reciben en el contexto de ficha. Jugadores no tienen controles ni acceso al historial cifrado, y el DataModel bloquea cambios de CS/progreso, borrado de esos campos y el intento de reiniciar creación para eludir permisos. La creación inicial conserva su selector; recrear un personaje terminado conserva su CS y progreso.

El ajuste limita la presentación de progreso en la ficha; los contadores son datos ordinarios del Actor, no un almacén secreto frente a herramientas de desarrollo. Las notas del DJ y el historial sí están cifrados y no se guardan en el Actor.

## Informe final, historial y recuperación

`TreasonService.applyMissionReport(rows, {missionId})` amplía el flujo existente. Cada fila lleva Actor, delta de PT, motivo y resultado (`success`, `failure`, `none`, `custom`), además de `countForPromotion`, `validSurvivor` y `override`. El DJ confirma supervivencia; la salud solo propone un valor inicial, porque podría haberse activado otro clon. Éxito y ajuste de PT son independientes. Un PNJ con ascensos activos y Traición desactivada admite progreso con delta PT cero.

El informe conserva la transacción única de PT. En esa misma transacción cifrada se registran las acciones de progreso pendientes. Después se actualizan los Actors y se confirman sus recibos. **No es una transacción distribuida entre Actors y ajustes de Mundo**: si una escritura falla, el registro conserva la operación pendiente. Se puede reanudar desde Historial de CS o mediante la API, sin repetir PT ni contar de nuevo. Un cambio incompatible del Actor bloquea la reanudación para revisión. Reenviar la misma referencia con datos diferentes se rechaza.

Los cambios de CS y las correcciones usan ese mismo diario recuperable. Cada entrada incluye niveles anterior/nuevo, tipo, motivo, referencia, notas, fecha, tiempo de juego, DJ, estado y progreso anterior/nuevo. Todo se guarda en el registro cifrado ya existente. El anuncio de chat es opcional y está apagado por defecto: solo contiene identidad anterior, nuevo CS e identidad nueva.

Los avisos de inventario se recalculan a partir del CS actual; no se modifican Items. Los filtros de compra existentes consultan el CS del borrador y permanecen vigentes.

## Validación

Archivos creados: `module/clearance/{rules,service,dialogs,register}.mjs`, `tests/clearance.test.mjs`, `tests/clearance.live.mjs`, `scripts/verify-clearance-live.cjs` y este documento.

Archivos modificados: `module/data/models/citizen.mjs`, `module/paranoia-2-edition.mjs`, `module/treason/{store,service,dialogs}.mjs`, `module/sheets/{character-sheet,npc-sheet}.mjs`, `module/creation/{commit,wizard}.mjs`, `templates/{character-sheet,character-creation}.hbs`, `templates/npc/sheet.hbs`, `templates/treason/dashboard.hbs` y `tests/clone-service.test.mjs`. No se modificaron Compendios, CloneService, poderes ni la tabla canónica de identidades.

`node --test tests/*.test.mjs`: 146 pruebas, incluyendo requisitos, dos/tres misiones, excepciones, traidor declarado, referencias duplicadas, reinicios, identidad, alias, degradación, límites, auditoría cifrada, fallos/reintentos, informe atómico de PT, PNJ optativo, permisos y conservación al clonar. La regresión incluye creación, sociedades, poderes, Traición, clones, combate, Items, robots y vehículos.

Prueba real mantenida: `scripts/verify-clearance-live.cjs` y `tests/clearance.live.mjs`, restringidos al Mundo desechable `society-fresh-validation` en localhost:30001. Comprueba Foundry V14.368, creación, valores iniciales para datos antiguos, informe desde UI, confirmación de ascenso, historial, degradación por API, equipo, clones, PNJ y sesiones separadas propietario/observador, incluida la opción para ocultar progreso.

No se añaden PD, salarios, recompensas automáticas, reglas universales de degradación ni un número de misiones para UV. Estos últimos permanecen bajo decisión expresa del DJ.
