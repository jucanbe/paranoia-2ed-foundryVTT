# Localización: español e inglés

El idioma se selecciona con **Idioma / Language** en los ajustes generales de Foundry. Reinicia Foundry después de instalar esta actualización y recarga cuando cambies el idioma.

- Los diccionarios completos están en `lang/es.json` y `lang/en.json`.
- `module/i18n/index.mjs` traduce etiquetas al renderizar y fragmentos estáticos de diálogos. Las interpolaciones con nombres, notas y texto privado no se traducen.
- Las claves de habilidades, sociedades, poderes y campos permanecen estables. Los valores canónicos antiguos se siguen reconociendo.
- `module/i18n/documents.mjs` traduce campos de catálogo únicamente cuando su huella coincide con el original. Conserva ediciones del usuario y evita guardar una traducción como si fuera una edición al enviar otro campo de la ficha.
- `module/i18n/compendiums.mjs` traduce índices locales para presentación/búsqueda y referencias de sociedades. Las bases de datos y los documentos originales no se reescriben.
- No hay migración de datos de personajes, cambio de moneda, modificación de permisos ni traducción automática del contenido personalizado o de mensajes históricos.

## Mantenimiento

Añade cada mensaje a ambos diccionarios con la misma clave. Usa `messageKey(textoOriginal)` para los identificadores `P2.Text`. No traduzcas valores persistidos ni comparaciones de reglas.

Después de ampliar el catálogo:

```powershell
node scripts/build-localization-catalogue.mjs
node scripts/validate-localization.mjs
node --test tests/*.test.mjs
```

## Validación realizada

- 202 pruebas automatizadas, incluidas ocho nuevas pruebas de idioma, claves estables, interpolaciones privadas y conservación de ediciones.
- Foundry V14.368 en un Mundo aislado: cuatro tipos de Actor, nueve pasos de creación, 99 Items y 16 referencias de sociedades, en español e inglés.
- Compendios con nombres traducidos e índices de búsqueda; nombres y contenido persistido comprobados sin cambios.
- Creadores de robots y vehículos en ambos idiomas, incluidos armamento (6/10) y defensas/sistemas (7/10), con listas de 320 px en la resolución de prueba.
- Créditos 375 y notas personales españolas conservados; enviar otros campos no sustituye nombres/descripciones originales por las traducciones.
- Sin errores de consola en las pruebas finales.

La prueba de edición real también detectó y corrigió campos repetidos de la tabla de armamento en el formulario del arma. Cada atributo se envía una sola vez, evitando errores de validación de Foundry. La cantidad cambió de 1 a 2 manteniendo el nombre, la descripción y los 375 créditos.
