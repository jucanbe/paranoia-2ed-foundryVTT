# Retirada del antiguo almacenamiento privado

Se eliminan module/treason/store.mjs, module/treason/crypto.mjs, scripts/import-legacy-vault.mjs y scripts/legacy-vault-conversion.mjs. Sus nombres aparecen aquí únicamente como inventario histórico de archivos retirados.

TreasonService ya no expone unlock, lock, isUnlocked, importLegacyNative ni exportLegacyBundle. Dejan de registrarse los ajustes treasonVault y treasonLegacyVault. No hay pantallas de preparación, importación o contraseña. No se han eliminado estilos compartidos ni el dashboard de juego: dashboard.hbs se reutiliza sin la pantalla bloqueada ni sus botones.

## Archivos

Nuevo: module/treason/ledger.mjs y scripts/verify-native-privacy-live.cjs.

Modificados: module/treason/{service,register,dialogs}.mjs; module/clearance/service.mjs; module/credits/service.mjs; module/societies/{service,dialogs}.mjs; module/clones/service.mjs; module/data/models/society.mjs; templates/treason/dashboard.hbs; templates/societies/panel.hbs; lang/es.json y lang/en.json; README.md, documentación y to_github_instructions.md.

Pruebas reescritas: treason, clearance, credits, societies y clone-service; fixtures live de créditos, sociedades y ascensos; scripts/verify-release-live.cjs. Se retiran dos pruebas exclusivas de la antigua protección/importación y se añaden conservación del ledger y reintentos sin duplicar PT o tiradas. 26 mensajes obsoletos retirados de ambos idiomas.

## Datos y funcionamiento

El ledger normal de TreasonService usa treasonLedger. Conserva PT, estado de traidor, historial, confianza, anuncios pendientes y operaciones reanudables de informe final/ascenso. Los registros nativos anteriores se trasladan una sola vez y su origen se retira tras guardar. Los datos antiguos opacos quedan ignorados e intactos; no se ofrece recuperación ni importación.

Las acusaciones/solicitudes solo persisten en Chat, con estado de revisión en sus flags. Públicas: sin destinatarios whisper. Privadas: todos los DJ y el remitente. Respuestas del Ordenador: mismos destinatarios según visibilidad, sin PT ni cálculo oculto. Las notas del DJ de sociedades/créditos usan datos ordinarios del Actor y controles de presentación.

## Validación

209 pruebas automáticas pasan. 2858 mensajes bilingües y 32 templates validados. Build completo y ZIP generados. En Foundry V14.368 sobre HTTP, con tres sesiones separadas: acusación pública/privada, solicitud pública/privada, respuesta privada, ajuste de PT y panel sin controles antiguos pasan. El jugador ajeno no ve privados en Chat. Clon conserva créditos, ledger y sociedad con misión/contacto/historial de rango. No hubo errores de navegador.

La búsqueda final no encuentra referencias de la función retirada en código ejecutable, templates o idiomas. Este inventario es la única documentación que conserva los nombres históricos; los enlaces HTTPS a GitHub/licencias no son requisitos de conexión. Diagnósticos y respaldos históricos anteriores se archivaron fuera del repositorio.

Foundry-native privacy is intended to prevent accidental/table-level disclosure, not to defend against an authorized player deliberately inspecting synchronized client data.
