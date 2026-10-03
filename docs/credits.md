# Créditos, recompensas, multas e historial

Implementación validada en Foundry VTT 14.368. Se conserva `system.credits` como único saldo; no hay otra moneda ni cuenta de deuda. Los saldos negativos son válidos.

## Auditoría previa

Ya existían el saldo de ciudadanos, los 100 créditos iniciales, compras en creación, precios estructurados del catálogo, unidades por metro, inventario asignado y conservación del sistema del ciudadano al activar un clon. El informe final ya gestionaba PT, ascensos y PD mediante un registro recuperable con ID estable.

Faltaban un servicio económico, historial persistente, permisos que impidieran editar el saldo libremente, diálogos de operaciones y créditos en el informe final. Se reutilizan el catálogo, el informe, los DataModels y el cifrado del registro del DJ.

## Servicio y datos

`game.paranoia.CreditService` se registra desde `module/credits/register.mjs`.

- `getBalance(actor)`, `getHistory(actor)`, `getPrivateDetails(actor, transactionId)`.
- `adjust(actor, delta, options)`, `reward(actor, amount, reason, options)`, `fine(actor, amount, reason, options)`.
- `spend(actor, amount, reason, options)`, `purchase(actor, catalogItemOrUuid, quantity, options)`.
- `refundPurchase(actor, transactionId, options)`, `correctTransaction(actor, transactionId, delta, options)`.
- `isEnabled(actor)`, `canView(actor)`, `enableTracking(npc, enabled)`.

Opciones habituales: `reason`, `missionReference`, `notes`, `relatedItem`, `privateNotes`, `notification` (`none`, `owner`, `public`), `showReason` y `requestId`. Las compras y gastos permiten `allowDebt` solo al DJ; las compras permiten `clearanceOverride` solo al DJ.

`system.creditLedger.history` guarda entradas con ID, fecha real, tiempo de juego, usuario, saldo previo, delta, saldo resultante, tipo, motivo, referencia de misión, `missionReportId`, objeto relacionado, notas y referencia de corrección. Tipos estables: `reward`, `fine`, `purchase`, `refund`, `adjustment`, `transfer`, `other`. Una compra del catálogo añade un snapshot para comprobar un reembolso intacto.

Las operaciones se serializan por Actor en el DJ activo coordinador. Se validan importes finitos, modelo y estado anterior. Compra y reembolso guardan inventario completo, sistema completo, saldo e historial en una misma actualización del documento padre. Las demás operaciones conservan el resto del sistema mediante cambios parciales. Los IDs de solicitud impiden repetir la misma operación.

## Interfaz y permisos

La pestaña Secreto muestra saldo, deuda si existe, Historial, Comprar y Registrar gasto. El propietario puede gastar, pero no conceder recompensas, imponer multas, corregir ni alterar directamente saldo o historial. Las solicitudes del propietario se validan en el DJ coordinador usando propiedad actual, precios del catálogo y fondos disponibles. Un observador no recibe el panel económico. El DJ dispone además de recompensa, multa, ajuste y registro opcional de pérdida de equipo.

El historial se despliega por transacción. El DJ puede corregir mediante una nueva entrada compensatoria, consultar detalles privados o revertir una compra intacta. No se borra silenciosamente la operación original. Material eliminado, consumido o modificado no se reembolsa automáticamente.

El panel del DJ incluye una vista económica con controles por ciudadano. Los PNJ tienen seguimiento económico desactivado por defecto; el DJ puede activarlo. Robots y vehículos no reciben saldo ni historial: su botón «Proponer multa» permite seleccionar al ciudadano responsable y decidir el importe.

La privacidad opcional cifra motivo, notas y fuente relacionados mediante el registro secreto existente del DJ. Requiere preparar su clave pública; consultar los detalles requiere desbloquear el registro. El Actor almacena texto visible genérico y datos cifrados. Los mensajes están desactivados por defecto; aviso privado o publicación pública requieren elección explícita. Nunca se publican notas privadas.

## Recompensas, multas e informe final

El DJ introduce importe y motivo. Una multa usa un importe positivo en el diálogo y aplica un delta negativo; puede superar el saldo disponible. No existen multas automáticas por PT, pérdidas, daños ni eliminación de equipo.

La configuración World `defaultMissionReward` tiene valor inicial 1000 y etiqueta «Recompensa sugerida de misión». Es una referencia para el diálogo de recompensa. El informe final comienza con recompensa 0 y multa 0, muestra neto y permite importes distintos por personaje, independientemente del resultado de misión.

El informe usa su ID estable y registro recuperable existente. Añade tareas económicas y escribe recompensa y multa como dos entradas en una actualización del Actor. Los reintentos comprueban `missionReportId`/ID de solicitud y no duplican pagos. El lote entre varios ciudadanos es recuperable mediante el registro del informe; no se presenta como una transacción de base de datos única entre múltiples Actores.

## Compras y conservación

La creación sigue dando 100 créditos una sola vez al confirmar el asistente y descuenta sus compras existentes. Registra el saldo inicial y las compras sin chat por objeto. El propietario no puede falsificar precios ni el historial inicial: se reconstruyen desde el catálogo autorizado. Linterna 10 y botiquín 25 dejan 65.

La compra normal consulta exclusivamente los Compendios del sistema y `item.system.price`; respeta seguridad y fondos. No añade un sistema de tiendas permanente al mundo. La arquitectura existente usa `priceUnit` y `length`: Plasticuerda sigue teniendo precio por metro, cantidad de pila 1 y longitud comprada. No se transforma en un precio plano ni se analiza texto de descripción.

Los tres objetos iniciales asignados siguen siendo gratuitos. CloneService conserva saldo e historial completos; muerte y cambio de clon no conceden otros 100 créditos. Ascensos, PD, recompensas por captura y afiliaciones no modifican dinero automáticamente. Una recompensa ofrecida por un traidor es metadato de TreasonService y no se descuenta de su saldo. Las sociedades pueden usar CreditService sin otra moneda.

## Migración

El DataModel inicializa un historial vacío cuando falta, conservando el saldo existente, incluso negativo. Se guarda con las siguientes operaciones normales. No se fabrican movimientos históricos ni se recalcula el saldo. PNJ existentes mantienen su saldo y seguimiento desactivado. Una edición directa de saldo por el DJ se registra como ajuste; se rechazan ediciones equivalentes del propietario, incluidos intentos de sustituir el sistema omitiendo los campos económicos.

## Archivos

Creado: `module/credits/rules.mjs`, `service.mjs`, `requests.mjs`, `register.mjs`, `dialogs.mjs`; `tests/credits.test.mjs`, `tests/credits.live.mjs`; `scripts/verify-credits-live.cjs`; este documento.

Modificado: `module/data/models/citizen.mjs`, `module/creation/commit.mjs`, `module/paranoia-2-edition.mjs`, `module/clearance/service.mjs`, `module/treason/dialogs.mjs`; sheets de personaje, PNJ, robot y vehículo; `templates/character-sheet.hbs`, `templates/npc/sheet.hbs`, `templates/robots/sheet.hbs`, `templates/vehicles/sheet.hbs`, `templates/treason/dashboard.hbs`; `tests/clone-service.test.mjs`.

## Validación

`node --test tests/*.test.mjs`: 171 pruebas, 171 aprobadas. Incluye creación, compras, multas negativas, recompensa desde deuda, asignaciones gratuitas, reembolso intacto, correcciones, permisos, cifrado, fallo de actualización sin cobro, informe repetido, clonado y regresiones de poderes, sociedades, traición, ascensos, PD, combate, robots y vehículos.

`scripts/verify-credits-live.cjs`, con Playwright disponible y el mundo aislado `society-fresh-validation` en puerto 30001: pruebas reales GM/propietario/observador, creación GM y propietario a 65 créditos, compra coordinada 50 → 0, deuda, reembolso, Plasticuerda, notas cifradas, clone 375 conservado, ascenso y bounty sin modificar saldo, informe repetido a 850, informe UI de misión fallida con neto +750 y diálogos de recompensa/multa/corrección. Cero errores JavaScript o de consola. El script y macro están destinados al mundo de validación, no a datos de campaña.

No se implementan salarios, descuentos, tarifas universales, seguros, bancos, conversión PD/créditos ni multas automáticas. Las transferencias entre ciudadanos son opcionales y quedan para un flujo posterior; se reserva el tipo estable sin simular atomicidad entre dos cuentas. No se modificó contenido de Compendios.
