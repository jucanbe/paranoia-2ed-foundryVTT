# Desarrollo posterior a las aventuras

## Auditoría y arquitectura

Antes de este cambio existían los 30 PD del borrador de creación, sus límites, los campos de habilidades sin máximo d20, tiradas sin recorte a 20, el informe final con Traición/ascensos, CloneService y metadatos de sociedades. No había saldo ni servicio de PD posteriores a aventuras.

API canónica: `game.paranoia.DevelopmentService`, en `module/development/service.mjs`. Reutiliza `ITEM_SKILLS` de `module/items/config.mjs` y las definiciones resueltas por SecretSocietyService. No se duplica el registro de habilidades. La política posterior a creación está en `module/development/rules.mjs`.

- `getAvailable`, `getHistory`, `preview`, `canImprove`.
- `award(actor, amount, {reason, missionReference, awardId, restriction, eligibleSkills, resetUsage, notification})`.
- `awardBatch(rows, options)`, con validación previa de todas las filas. Proporcionar awardId estable por fila para reintentos.
- `spend(actor, skillKey, increase, options)` y `spendBatch(actor, [{skillKey,increase,overrideCost?}], options)`.
- `correct(actor, delta, {reason})`; cambia explícitamente el saldo sin alterar silenciosamente los totales históricos.
- `refund(actor, expenditureId, {reason})`; restaura valores y devuelve el coste realmente pagado, conserva la entrada original y rechaza una mejora ya revertida o modificada después.
- `restrictSkills`, `recordSkillUse`, `resetUsage`, `enableTracking`.

Las mutaciones se serializan por Actor en el DJ coordinador. Saldo, habilidades y auditoría se validan antes de una sola actualización del Actor. Un gasto inválido o una escritura fallida no deja un gasto parcial. Las concesiones ordinarias no necesitan desbloquear Traición: son independientes.

## Datos, creación y migración

Citizen recibe `development` con `available`, `lifetimeEarned`, `lifetimeSpent`, `lifetimeRefunded`, `restricted`, `eligibleSkills`, `usage` e `history`. Los totales gastados son acumulativos; los reembolsos tienen su propio total, de modo que el gasto neto es gastados menos reembolsados. El historial registra concesiones, gastos por habilidad, correcciones, restricciones, reinicios de usos y devoluciones, con fecha, tiempo de juego y usuario.

Los valores iniciales del DataModel incorporan saldo/totales cero e historial vacío a datos antiguos. No se deducen PD de habilidades existentes ni se modifican esas habilidades. No se realizó una migración de los Mundos del usuario; las pruebas escribieron únicamente fixtures en un Mundo desechable.

Los 30 PD del CreationSession permanecen en su borrador y mantienen sus máximos de generación. No se convierten en saldo posterior. La creación nueva termina con cero PD de aventura; los datos de desarrollo existentes se preservan al reconstruir el sistema del Actor. Recrear habilidades de un personaje ya terminado requiere al DJ, porque los cambios posteriores del propietario deben pasar por el gasto validado.

## Concesión e informe final

`defaultDevelopmentAward`, visible como «PD sugeridos al final de una aventura», comienza en 4. Es una sugerencia editable; no hay evaluación automática de diversión, éxito, supervivencia, CS ni Traición.

El informe existente incluye una columna DESARROLLO por personaje, con cantidad editable, motivo visible al propietario, restricción opcional a habilidades usadas y reinicio opcional de usos. Los personajes se incluyen por defecto también si murió el clon. La concesión no depende del resultado de misión: un fracaso puede conceder los 4 PD sugeridos. PNJ solo participan en Desarrollo si el DJ activa su seguimiento.

Todas las concesiones del informe se validan antes de confirmar su transacción de PT. El diario recuperable del informe almacena tareas de concesión con awardId estable. Después se actualizan los Actors; reenviar el mismo informe reanuda tareas pendientes sin duplicar concesiones, PT ni ascensos. No existe una transacción distribuida entre todos los Actors: una interrupción puede dejar algunos actualizados y otros pendientes. Se recuperan con el mismo informe/API `SecurityClearanceService.resumeMissionReport(missionId)`.

Las concesiones individuales ofrecen ningún chat (por defecto), aviso privado propietario/DJ o anuncio público deliberado. Los avisos contienen solo cantidad y saldo; no motivos, notas ni comparaciones entre jugadores. Motivos y `options.notes` son datos del historial del propietario, no notas privadas del DJ; el formulario los identifica así. No se copian comentarios secretos de Traición ni de sociedades.

## Mejoras, sociedades y restricciones

«Mejorar habilidades» abre un diálogo agrupado, con incrementos de varios puntos, vista actual → nuevo, costes y saldo restante. Aplicar valida todo el lote; Cancelar no escribe. Se señalan los PD pendientes y se anima a gastarlos al terminar, sin bloquear el Actor si quedan puntos.

Un PD aumenta una habilidad en uno, sin máximo posterior de 12, 14 ni 20. No mejora atributos ni habilidades básicas derivadas. Las tiradas mantienen los objetivos superiores a 20 y sus modificadores habituales.

Las membresías activas usan `development.skillCostMultipliers`. Club Sierra ya contiene `perception.survival: 0.5`: +2 cuesta 1 PD, +1 cuesta 1 y +3 cuesta 2. Se redondea hacia arriba por habilidad y lote, sin fracciones ni créditos de descuento sobrantes entre gastos. El DJ puede fijar un coste entero excepcional con motivo. La auditoría guarda el coste real y la regla aplicada.

Piratas Informáticos/Románticos conservan sus metadatos de acceso inicial; no reciben descuentos posteriores inventados. Los poderes psiónicos por rango siguen fuera del gasto de PD. Las sociedades del Mundo pueden guardar multiplicadores positivos para claves canónicas; scope creation se excluye de esta política. Los metadatos no crean habilidades nuevas: Programación/Culturas Antiguas solo podrán aparecer si un futuro registro/modelo las incorpora.

Por defecto están disponibles todas las habilidades. El DJ puede limitar a las usadas o seleccionar claves manualmente, y posteriormente añadir/quitar permisos. Las restricciones son una lista explícita guardada al conceder/configurar; nuevos usos no las amplían automáticamente.

RollService incrementa un contador por habilidad intentada, con independencia de éxito y de si se publica el resultado. No cuenta atributos, no envía chat extra y no crea historial por cada tirada. Los usos son una ayuda administrativa declarada por el cliente del propietario, no evidencia antifraude. Un reinicio borra solo contadores, conservando habilidades y restricciones.

## Permisos y clones

El propietario ve su panel/historial y puede gastar mediante una solicitud privada al DJ conectado. El coordinador vuelve a validar autor, propiedad, saldo, claves y reglas, y guarda la operación. El Actor DataModel bloquea concesiones/correcciones, borrado de historial y cambios directos de habilidades posteriores a creación por jugadores. Solo permite un incremento canónico de uso de habilidad en cada actualización de seguimiento. Otros jugadores no reciben el contexto del panel ni pueden gastar. Correcciones, concesiones, restricciones, descuentos excepcionales y reembolsos corresponden al DJ.

`developmentEnabled` es false para PNJ por defecto. Personajes tienen seguimiento; robots y vehículos quedan excluidos. CloneService ya copiaba el sistema completo: se verificó que preserva habilidades, saldo, restricciones, usos e historial sin modificar su implementación.

## Archivos

Creado: `module/development/{rules,service,requests,register,dialogs}.mjs`, `module/data/models/development.mjs`, `tests/development.test.mjs`, `tests/development.live.mjs`, `scripts/verify-development-live.cjs` y este documento.

Modificado: `module/data/models/citizen.mjs`, `module/paranoia-2-edition.mjs`, `module/societies/service.mjs`, `module/rolls/service.mjs`, `module/clearance/service.mjs`, `module/treason/dialogs.mjs`, `module/sheets/{character-sheet,npc-sheet}.mjs`, `templates/character-sheet.hbs`, `templates/npc/sheet.hbs`, `styles/treason.css` y `tests/clone-service.test.mjs`.

## Validación

159 pruebas automatizadas pasan, incluyendo saldo, totales, lotes atómicos, errores de escritura, 19 → 22, límites de creación intactos, Club Sierra normal/impar/reembolso, costes normales, restricciones, usos, correcciones, permisos, sociedades personalizadas, PNJ optativos, robots/vehículos excluidos, fracaso con PD e idempotencia del informe. La regresión cubre creación, tiradas, sociedades, clones, Traición, ascensos, combate, Items, robots y vehículos.

En Foundry V14.368 se verificaron creación con saldo cero, 19 → 22, objetivo de tirada 22, contadores de uso, descuento/reembolso, restricciones, misión fallida con PD, datos antiguos, clones y PNJ. Sesiones independientes comprobaron propietario/observador y bloqueo de falsificación de PD/habilidades/historial. El formulario real del informe concede 4 PD ante fracaso; el diálogo del propietario previsualiza y guarda Medicina 22 → 25 por 3 PD mediante el coordinador. Sin errores de consola.

No se implementan salarios, premios/multas de créditos, entrenamiento temporal, avance de atributos, clases ni reglas de combate opcionales.
