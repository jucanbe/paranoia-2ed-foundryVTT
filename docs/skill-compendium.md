# Atributos y habilidades

El pack skills contiene 66 Journals de consulta: 8 atributos, las 52 habilidades actuales de la ficha, 3 capacidades derivadas, una guía de tiradas y 2 referencias aclaratorias del manual (Soborno y Armas Antiguas de Proyectil). No modifica valores, modelos, tiradas ni progresión.

Los resúmenes se contrastaron visualmente con el manual español JOC, páginas impresas 13–16 y 62–69. El catálogo reutiliza LABELS para las claves y nombres de la ficha. Las etiquetas que difieren del manual se identifican sin asignar equivalencias automáticas. Fuente: module/references/skills.mjs.

## Acceso

El compendio es visible para jugadores con permiso OBSERVER. Las importaciones individuales y completas al Mundo reciben por defecto OBSERVER (2); las páginas heredan (-1). Foundry elimina normalmente la propiedad al importar: preCreateJournalEntry establece este valor inicial exclusivamente para fuentes de este pack. Después el DJ puede cambiar los permisos habituales; no hay un hook que los vuelva a imponer al editar. Otros compendios conservan sus permisos.

El contenido se presenta en español o inglés según el idioma del cliente, tanto desde el pack como después de importarlo. La traducción afecta a la presentación y respeta el texto original editable.

## Verificación

212 pruebas automáticas pasan. Validación de 2941 mensajes bilingües y 32 templates. En una copia aislada de Foundry V14.368 sobre HTTP se verificaron 66 documentos válidos con una página cada uno, importación individual y completa, permisos públicos de todas las entradas, lectura sin edición como jugador y traducción inglesa del Journal importado. No hubo errores de navegador. Verificador: scripts/verify-skill-reference-live.cjs, requiere PLAYWRIGHT_MODULE y solo trabaja en Mundos release-audit-.

Reiniciar Foundry permite detectar el pack nuevo del manifiesto. El DJ puede usarlo directamente o importarlo al directorio de Journals del Mundo.
