
# Auditoría final · 0.2.0-rc.1

## Estado y alcance

Candidato para Foundry VTT **14.368**, sistema `paranoia-2-edition`. Auditoría del árbol, manifiesto, importaciones, modelos, plantillas, estilos, ajustes, hooks, packs, fuentes, pruebas y documentación. Se conservaron los subsistemas existentes; no se añadieron nuevas reglas de juego ni valores no verificados. No se publicó una versión externa ni se modificó un Mundo de campaña.

Lista interna inicial: DONE — cuatro Actors, cinco Items, servicios de reglas, packs y suites; PARTIAL — normalización antigua, documentación de entrega y pruebas dependientes del Mundo de desarrollo; MISSING — versionado de Mundo, empaquetador, build aislado reproducible, caché de catálogo y prueba del ZIP en otro Mundo; BROKEN/INCONSISTENT — validación de vehículos sin control al migrar y uso de conversión a objeto en un subcampo que ya es un objeto simple. Estas carencias se repararon.

## Tipos y APIs

Actors/fichas V14: `character`/CharacterSheet, `npc`/NPCSheet, `robot`/RobotSheet, `vehicle`/VehicleSheet. Items/ficha SimpleItemSheet: `weapon`, `armor`, `equipment`, `robotProgram`, `robotPeripheral`. Todos abrieron, guardaron y volvieron a abrir; todos los documentos de los packs y sus Items embebidos validaron contra sus modelos reales.

Servicios conservados: tiradas (`rollCheck`, `rollAttributeDuel`), combate (`game.paranoia.combat`), DamageService, HealthService, CloneService, MutantPowerService, TreasonService, SecretSocietyService, SecurityClearanceService, DevelopmentService, CreditService, NPCGenerator, RobotService y VehicleService. Se añadió MigrationService; no hay servicios paralelos. Se revisaron ApplicationV2/ActorSheetV2, DialogV2, DocumentSheetConfig, hooks, UUIDs y APIs de documentos. No se encontraron llamadas antiguas que necesitaran sustituirse.

## Packs reconstruidos

| ID exacto | Tipo | Entradas |
|---|---|---:|
| paranoia-2-edition.societies | JournalEntry | 16 |
| paranoia-2-edition.robots | Actor | 13 |
| paranoia-2-edition.robot-programs | Item | 3 |
| paranoia-2-edition.weapons | Item | 35 |
| paranoia-2-edition.armor | Item | 2 |
| paranoia-2-edition.equipment | Item | 44 |
| paranoia-2-edition.vehicles | Actor | 2 |

Total: **115**. Dos builds consecutivos produjeron contenidos funcionalmente idénticos, incluidos IDs, páginas y relaciones embebidas. Fuentes JSON y registro de sociedades permanecen canónicos. Se comprobaron las relaciones de las 16 sociedades, los 13 robots y ambos vehículos; no se rellenaron estadísticas desconocidas. El ZIP usa una lista explícita de carpetas de ejecución y documentación; no incluye fuentes del manual, scans, dependencias, tests, scripts, credenciales ni datos de Mundos.

## Migración

Versión de datos **1** en ajuste World y flags de documentos. El DJ activo realiza la migración, con respaldo previo en un Journal de propiedad privada, registro de resultados y reintentos de documentos fallidos. La segunda ejecución no cambia documentos ya migrados. No se fabrica historial económico ni gasto de PD.

Se conservan saldos negativos, habilidades >20, atributos, CS, clones, notas, rangos y sociedad personalizada. Armor L4/pareja antigua → protecciones; Weapon categorías/códigos, ND textual cero, cargas y experimental → campos actuales. Hipersentido/Supersentido → clave `superSense`, manteniendo nombre visible y pool. Campos desconocidos se guardan bajo `system.legacyData` antes de la limpieza de Foundry, incluidos paths anidados. PT antiguos válidos se importan al registro privados para el DJ al consultar los datos o al importar un ciudadano; no sustituyen registros ya autoritativos.

La migración se probó únicamente sobre fixtures desechables. Los datos del usuario no se migraron en esta sesión.

## Cambios

- Caché del catálogo por documentos de packs del sistema; copia del array al consultar, invalidación por cambios relevantes y reintento tras fallo.
- Build con `PACK_OUTPUT`, independiente de packs instalados abiertos; empaquetador portable sin dependencias npm nuevas.
- Helper de sanación movido a reglas neutrales, eliminando el ciclo Salud ↔ Heridas; los ciclos diferidos de coordinador/servicio existentes se revisaron y conservaron al no producir fallos de inicialización.
- Referencia de artillero inválida sigue una ruta de error comprensible; las fichas toleran tripulantes borrados.
- Validación del control de vehículo comprueba cambios efectivos de modo, permitiendo guardar/migrar un vehículo aún sin configurar.
- Etiquetas de tipos y tres ajustes principales en catálogo de localización. Texto largo y foco de teclado mejorados, sin rediseño.
- Normalización de poderes mantiene etiquetas visibles. Consultar el registro no lo vuelve a guardar si no hay ciudadanos pendientes de importar.

## Pruebas efectuadas

**189 unitarias: PASS.** Sintaxis/importaciones, rutas de manifiesto y plantillas, unicidad de catálogo, registro de sociedades y build determinista: PASS.

Pruebas reales automatizadas en navegador sobre nuevos Mundos V14 sin módulos activos: arranque del ZIP, contenido disponible sin importación manual, todos los tipos y modelos, importación de robots/vehículos y asistente de nueve pasos. Equipo inicial gratuito y compras 10+25 dejan 65 créditos. Se revisó visualmente la ficha Secreto.

Regresión real: sociedades/misiones/rangos/Psiónicos/poderes aprendidos, clones y secretos privados para el DJ; informe final, PT, ascenso/degradación e identidad DAVID-R-ARO-1 → DAVID-O-ARO-1 → DAVID-O-ARO-2; PD, habilidades >20, coste Sierra y reembolso; deuda, compra, devolución, corrección, bounty y concesiones idempotentes. Combate básico/opcional: cuatro fases, sorpresa, ráfagas, alcance, cobertura, movimiento, manejo, recarga, averías/reparación, heridas y armadura polivalente, salvas de robot/cerebro de vehículo. Memoria 20 con programas 8+7 deja 5 libres. Piloto y artillero humanos, daño de robot/vehículo, ataque→daño, daño duplicado, muerte→clon y confianza d20>PT: PASS.

Privacy and access: see [the native tabletop model](native-privacy-audit.md).

Comprobaciones adicionales en `release-audit-rc`: lote de tres PNJ con nombres únicos, equipo inicial y sociedad desde packs; contextos de Robot/Vehicle sin internos ni defecto oculto para observador; declaración rechazada mediante Token no enlazado sin propiedad; creación de propietario a 65 créditos y compra coordinada de dos unidades de 25 desde saldo 50 a 0. Cero errores. La importación real de PT antiguos 8 conserva 8 en el ledger. La migración final procesó 52 documentos; repetirla procesó 0. La instalación final usa exclusivamente este sistema, sin módulos activos.

**Instalación limpia: PASS para arranque y los flujos comprobados. Consola: cero excepciones/errores del sistema.** Los avisos de denegación esperados al intentar operaciones ilegales forman parte de las pruebas; no se encontraron avisos de APIs obsoletas o esquemas inválidos.

## Archivos

Creados: README, guía rápida DJ, este informe, `lang/es.json`, modelos/helper de preservación `module/data/models/legacy.mjs`, `module/migrations/{legacy,register}.mjs`, `scripts/{audit-system,package-system,verify-pack-build,verify-release-live}`, `tests/{migrations,legacy-preservation}.test.mjs`.

Modificados: manifiesto y arranque; modelos Citizen/Weapon/Armor/Equipment/Robot/Vehicle/RobotItems y campos comunes; catálogo; Salud y helper de heridas; combate de vehículos; ficha Character y registro de fichas; registro/almacén de Traición; registros de CS/PD/créditos; build de packs/sociedades; pruebas live; CSS general y nota histórica de auditoría de sociedades. Los packs del ZIP se regeneraron; no se sustituyeron manualmente bases de campaña.

## Datos pendientes / diferidos

Privacy and access: see [the native tabletop model](native-privacy-audit.md).
