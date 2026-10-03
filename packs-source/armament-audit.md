# Revisión de armas y armaduras — 2026-10-03

Fuente: `JOC-Paranoia-Manual Básico.ROLes.pdf`, edición española JOC. Revisión visual del Anexo B: páginas PDF 162 (precios/CS), 163 (armaduras) y 165 (armamento), y del texto de armas en páginas impresas 89–92. La numeración PDF y la impresa son diferentes.

## Resultado

- 41 armas: se conservan todos los IDs anteriores y se añaden rifleláser, rifle sónico, cuchillo arrojadizo, arco, roca y lanza.
- 11 armaduras: las diez filas de la tabla más el uniforme inicial conservado. Aislante T1, amianto C4, combate T7, placas P3, malla P2, cuero P1, Faraday E4, Kevlar P3, Réflex L4 y traje de batalla T4.
- Daño normal, tipo, alcance, radio, Cg, RCg, notas, precio y CS se almacenan en campos estructurados cuando están verificados. Las averías conservan su daño independiente.
- Tirabalas normal, tirabalas semiautomático y rifle cónico tienen respectivamente 9, 9 y 10 perfiles de munición. «Usar» configura el ataque sin comprar, crear ni consumir munición, ni restablecer cargas.
- Lanzaaguas se corrige a Lanzaagujas manteniendo `water-gun`. El arma sónica anterior pasa a identificarse como pistola sónica manteniendo `sonic-weapon`. Neurolátigo E10, lanzallamas portátil E11 y Gauss E9 corrigen las categorías anteriores.
- La habilidad de Armas de Proyectil, definida en la página impresa 67 y ausente del modelo anterior, se incorpora como `dexterity.projectileWeapons`; las otras claves y puntuaciones se conservan.
- Las siete armas integradas del Buitre Guerrero conservan sus IDs y obtienen los atributos verificados del catálogo. No se modifica ningún Actor del mundo.

## Interpretación y límites

Los valores `?` siguen siendo desconocidos: no se inventan daño, tipo, carga o recarga para morteros, lanzamisiles o lanzagases. `Pt` conserva el efecto particular del gas sin convertirse en un número de daño ficticio; `O` identifica un efecto no dañino. La lanza conserva B/P y necesita seleccionar B para cuerpo a cuerpo o P al arrojarla. El Hacha anterior se conserva, pero no tiene una fila propia en esta tabla y sus estadísticas siguen sin presumirse.

Cg y RCg se conservan literalmente en `sourceDetails.chargeTurns` y `sourceDetails.tableRecharge`. No se convierten automáticamente en capacidad de munición ni duración de la recarga: las reglas descriptivas específicas y los campos de combate existentes siguen separados. Los efectos de color Réflex, gas, aturdimiento, telarañas, conos y la restricción de Gauss a robots requieren adjudicación del DJ. La marca de ráfagas procede de la nota `r`, sin inventar consumo.

El uniforme inicial no se convierte por inferencia en Réflex L4. El equipo asignado sigue siendo gratuito y la creación conserva sus 100 créditos. Las copias ya importadas en Actors no se sobrescriben: deben actualizarse manualmente o sustituirse desde el compendio revisado si el DJ lo desea.

## Verificación

- Pruebas de atributos, categorías, claves, armaduras, perfiles, permisos y regresión de compras/creación.
- Foundry V14.368, mundo aislado: los 52 documentos cargan con sus modelos estrictos y sus fichas se abren sin errores; selección de PP17 a 200 m y persistencia tras recargar.
- IDs del catálogo y UUIDs del compendio anteriores conservados.

El PDF original no se incorpora al repositorio.
