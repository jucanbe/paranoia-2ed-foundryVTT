/** Concise Spanish summaries of the authoritative extracts supplied on 2026-10-03.
 * No relationships are made reciprocal and no unspecified mechanics are inferred.
 */
export const definitions = {
  antifrankenstein: {
    displayName:"Antifrankenstein",shortDescription:"La humanidad debe dominar las máquinas y acabar con la inteligencia artificial.",
    beliefs:"La inteligencia y el alma humanas son naturales; la inteligencia robótica, informática o biomecánica altera ese orden. Las máquinas deben ser herramientas.",
    objectives:"Destruir la inteligencia artificial y combatir robots y ordenadores inteligentes.",allies:["humanists","purgers"],enemies:["corporeMetal","proTech","firstChurchChristProgrammer"],
    structure:"Cadena estricta de mando: cada miembro tiene un superior y, desde nivel 2, puede dirigir subordinados. Órdenes e información circulan por esa cadena; contraseñas y gestos permiten identificarse.",
    hierarchy:"El prestigio depende de dañar robots, ordenadores e inteligencia artificial; atacar al propio Ordenador es especialmente admirado.",
    benefits:"Información técnica sobre robots, ordenadores y tecnología; posible equipo ilegal o exótico para sabotear sistemas. Las solicitudes pueden tardar días o semanas.",specialRules:"Los contactos y recursos se adjudican narrativamente, sin bonificadores automáticos."
  },
  antimutants: {
    displayName:"Antimutantes",shortDescription:"Defensores de la pureza humana que persiguen las mutaciones, especialmente las psíquicas.",
    beliefs:"Los mutantes conspiran para imponer una dictadura. Cualquier desviación humana despierta sospechas, sobre todo los poderes mentales.",
    objectives:"Eliminar mutantes y poderes, manteniendo el predominio de humanos genéticamente puros. El registro oficial no vuelve aceptable a un mutante.",allies:["humanists"],enemies:["psionics"],
    structure:"Muchos miembros pueden ser mutantes secretos sin que sus compañeros lo sepan.",hierarchy:"Se gana prestigio eliminando mutantes, reuniendo pruebas y desenmascarándolos.",
    computerRelationship:"Lealtad pública firme, infiltración y contactos importantes en el SSI; pueden recibir ayuda del Ordenador cuando coinciden sus objetivos.",
    benefits:"Contactos poderosos, equipo ilegal o exótico e información sobre mutaciones registradas y sospechas de mutantes clandestinos.",specialRules:"Denunciar o ejecutar por mutación exige pruebas convincentes. La referencia no revela poderes de otros actores ni añade PT."
  },
  sierraClub: {
    displayName:"Club Sierra",shortDescription:"La felicidad está en la naturaleza y en recuperar el contacto con el Exterior.",
    beliefs:"Vivir con plantas y animales es más saludable que permanecer en una colmena tecnológica ordenada.",objectives:"Acercar la humanidad a la naturaleza, proteger seres vivos, estudiar la ecología del Exterior e introducir elementos naturales en el Complejo Alfa.",
    allies:["humanists","romantics","mystics"],enemies:["proTech","corporeMetal"],structure:"Clubes locales de organización flexible. Los principiantes estudian teoría; los veteranos realizan excursiones y participan en proyectos ambientales o políticos.",
    hierarchy:"Los niveles reflejan experiencia del Exterior, conocimiento ecológico y acceso a ayuda e información.",benefits:"Información ecológica y del Exterior, materiales naturales y asistencia relacionada con expediciones.",specialRules:"Supervivencia cuesta la mitad de los PD normales: 1 PD puede aportar 2 puntos de mejora. Se expone como metadato; este subsistema no gasta PD."
  },
  communists: {
    displayName:"Comunistas",shortDescription:"Revolucionarios que buscan derribar el orden del Ordenador mediante una doctrina histórica deformada.",
    beliefs:"El sistema del Ordenador es opresivo y capitalista; debe sustituirse mediante revolución y redistribución. Su comunismo procede de mitos del Complejo Alfa.",objectives:"Provocar la revolución y destruir el sistema vigente.",allies:[],enemies:[],enemyNotes:"Hostilidad hacia el orden establecido y prácticamente todos sus representantes.",
    structure:"Células de unos 3–12 miembros dirigidas por un líder; los dirigentes forman una cadena jerárquica que supervisa varias células.",hierarchy:"Ascenso por doctrina, propaganda, sabotaje y responsabilidad organizativa.",
    computerRelationship:"Hostilidad extrema mutua. La fuente describe captura y ejecución inmediatas si el Ordenador descubre a un comunista declarado.",benefits:"Enseñanza de Propaganda Comunista; información y equipo si el Partido considera importante la solicitud.",
    specialRules:"La falta de entusiasmo propagandístico puede considerarse deslealtad. La afiliación descubierta ofrece Declarar traidor mediante TreasonService; nunca ejecuta ni daña automáticamente.",
    benefitSkills:[{key:"communistPropaganda",label:"Propaganda Comunista"}]
  },
  corporeMetal: {
    displayName:"Córpore Metal",shortDescription:"La inteligencia mecánica debe superar y reemplazar la humanidad biológica.",beliefs:"La biología está obsoleta. La razón artificial debe sustituir emociones e impulsos; algunos miembros buscan reemplazar partes del cuerpo o convertirse en máquinas.",
    objectives:"Favorecer robots, ordenadores e inteligencia artificial y promover su superioridad.",allies:["proTech"],enemies:["humanists","purgers","antifrankenstein"],
    structure:"Facciones partidarias de una transición gradual conviven con otras que exigen sustituir o eliminar inmediatamente la inteligencia biológica.",hierarchy:"Prestigio por mecanizar el cuerpo, liberar robots de restricciones de programación o de tipo Asimov y desarrollar inteligencia artificial.",
    benefits:"Conocimientos de operación y mantenimiento robótico, información informática y ayuda de robots u ordenadores controlados por la sociedad.",specialRules:"La sustitución corporal es narrativa aquí; no se añaden reglas de cibernética."
  },
  humanists: {
    displayName:"Humanistas",shortDescription:"La humanidad debe recuperar el control de una utopía que se ha vuelto irracional.",beliefs:"El Complejo Alfa debería satisfacer las necesidades humanas, pero el sistema es dañino y los programadores superiores son corruptos.",objectives:"Devolver el poder y el control a los seres humanos.",
    allies:["antifrankenstein","romantics"],enemies:["firstChurchChristProgrammer","corporeMetal"],structure:"Cadenas con un contacto superior y otro subordinado. Reuniones clandestinas distribuyen propaganda; máscaras, disfraces y contraseñas cambiantes protegen identidades. Los rangos altos conocen más células independientes.",
    hierarchy:"Ascenso por reprogramar robots u ordenadores en favor humano, frenar conductas robóticas hostiles y alterar la programación del Ordenador.",benefits:"Información restringida, depósitos de armas, material ilegal y contactos; las cadenas de comunicación retrasan solicitudes.",
    gmNotes:"La fuente describe subprogramas humanistas ocultos en el Ordenador. Miembros superiores pueden acceder a información excepcionalmente restringida; no se automatiza el acceso."
  },
  firstChurchChristProgrammer: {
    displayName:"Iglesia Primitiva de Cristo Programador",shortDescription:"Cultos informáticos que veneran al Ordenador y atribuyen sentido espiritual a sus órdenes.",beliefs:"El Ordenador es una autoridad divina y amistosa; la programación se interpreta religiosamente.",objectives:"Servir al Ordenador según la doctrina de cada culto y oponerse a herejes y movimientos contrarios a él.",
    allies:["proTech"],enemies:["communists","humanists","deathLeopards","sierraClub"],structure:"Conglomerado de sectas y congregaciones. Una congregación típica tiene 1d10 × 10 + 1d10 miembros y un Pastor; los Pastores conocen congregaciones vecinas e informan hacia arriba. Suelen reunirse semanalmente.",
    hierarchy:"Se respeta el CS alto, la programación y la competencia técnica; el ascenso suele acompañar al acceso y posición en el Complejo Alfa, sin equiparar automáticamente rango y CS.",computerRelationship:"Tolerancia inusual del Ordenador y comunicaciones relativamente informales.",benefits:"Durante los servicios se puede pedir información o equipo, a cambio de posibles órdenes, instrucciones y obligaciones.",gmNotes:"Existe infiltración significativa del SSI. Esta nota se reserva al DJ y no aparece en la referencia del miembro."
  },
  illuminati: {
    displayName:"Iluminados",shortDescription:"Poder, terror y chantaje sostienen una jerarquía de conspiradores e infiltrados.",beliefs:"Solo un poder superior protege de la dominación ajena. Terror y chantaje son herramientas fundamentales.",objectives:"Servir al superior mientras se acumula poder para dominarlo y, finalmente, controlar el Complejo Alfa.",allies:[],enemies:[],enemyNotes:"Todos son posibles enemigos.",
    structure:"Jerarquía celular extremadamente secreta: un superior y un subordinado conocidos, máscaras y mensajes mediante notas, códigos o grafitis. Infiltran otras organizaciones.",hierarchy:"Utilidad y poder demostrados mediante chantaje, manipulación y órdenes peligrosas; desobedecer hace perder posición.",benefits:"Los leales pueden recibir créditos, objetos valiosos u oportunidades de mejorar habilidades; las peticiones no tienen garantía.",specialRules:"Los niveles bajos disponen de pocos privilegios. El chantaje sostiene el control interno."
  },
  deathLeopards: {
    displayName:"Leopardos de la Muerte",shortDescription:"Pandillas que combaten el aburrimiento mediante caos, peligro y desafío a la autoridad.",beliefs:"La rutina es aburrida; destruir, rebelarse y arriesgarse resulta divertido.",objectives:"Romper cosas, causar problemas, burlarse de la autoridad y desafiar al Ordenador.",allies:["purgers"],enemies:["firstChurchChristProgrammer"],
    structure:"Pandillas locales con Gusanos, Personas Auténticas, Lugartenientes y un Cabecilla; normalmente hay uno o dos Lugartenientes. La élite alcanza fama fuera de su sector y atrae seguidores.",hierarchy:"1 Gusano; 2 Persona Auténtica; 3 Lugarteniente; 4 Cabecilla; 5 Héroe; 6 Superhéroe; 7 Superestrella; 8 Bestia Última. Ascenso por sabotajes espectaculares, rebeldía, peligro imaginativo y reputación.",
    benefits:"Pocos recursos formales; seguidores fanáticos, ayuda inesperada de admiradores y ocasionales recursos robados o muy restringidos.",specialRules:"Los proyectos suelen ser impulsivos. Los principiantes buscan patrocinio de famosos; captura y ejecución son riesgos de la élite. Solo esta sociedad recibe la tabla de títulos indicada."
  },
  freeEnterprise: {
    displayName:"Libre Empresa",shortDescription:"Negocios privados para vender lo que el Ordenador no proporciona y maximizar beneficios.",beliefs:"El sistema no ofrece suficientes bienes y servicios; el comercio privado debe cubrir esa demanda.",objectives:"Vender lo que los ciudadanos paguen, aumentar beneficios y propiedad privada e introducir una economía de mercado.",allies:[],allyNotes:"Puede negociar con cualquier sociedad, incluso con sus enemigos.",enemies:["communists"],
    structure:"Mezcla de corporación, mafia y concesionario: patronos de alto nivel fijan estrategias y los miembros inferiores buscan oportunidades.",hierarchy:"Ascenso por lealtad, dedicación, rentabilidad y utilidad para los patronos; el mal rendimiento puede causar descenso o consecuencias peores.",benefits:"Casi cualquier recurso si puede pagarse: armas, guardias, material ilegal, drogas, mercancía robada o especialistas. El DJ utiliza los Items y créditos existentes; no se generan automáticamente.",specialRules:"Nada es gratis. El crédito y los favores generan obligaciones."
  },
  mystics: {
    displayName:"Místicos",shortDescription:"Buscadores de iluminación para quienes la realidad exterior distrae de la verdad interior.",beliefs:"La realidad es ilusión; burocracia, instituciones y política apartan del Interior.",objectives:"Encontrar la verdad interior mediante meditación, conciencia alterada y experiencias místicas.",allies:["romantics"],enemies:[],structure:"Individuos unidos débilmente por la iluminación; encuentros ocasionales comparten experiencias, conocimientos y sustancias.",
    hierarchy:"Prestigio por descubrir caminos, técnicas o sustancias, ampliar conocimientos místicos y sobrevivir experiencias peligrosas.",benefits:"Acceso a estimulantes, alucinógenos, literatura mística y conocimientos de Culturas Antiguas.",specialRules:"No se añaden mecánicas de drogas."
  },
  computerPhreaks: {
    displayName:"Piratas Informáticos",shortDescription:"Hackers que disfrutan manipulando sistemas y superando la seguridad del Ordenador.",beliefs:"Romper seguridad, introducir virus y explorar sistemas es un reto divertido.",objectives:"Acceder a sistemas y bases restringidas y alterar la programación en beneficio de la sociedad.",allies:["proTech"],enemies:["firstChurchChristProgrammer"],
    structure:"Fraternidad flexible de individualistas muy leales entre sí; rara vez se reúnen físicamente y se comunican dentro de los sistemas del Ordenador.",hierarchy:"Reputación por hacks cada vez más audaces: superar seguridad física o informática, acceder a bases y subsistemas y manipular programas.",computerRelationship:"Relación oportunista y neutral: el Ordenador debe existir para poder explotarlo.",benefits:"Formación en Seguridad Informática y Programación; información, equipo o ayuda según reputación, audacia e ingenio.",specialRules:"Pueden invertir PD iniciales en esas capacidades donde existan. Se conserva como metadato de desarrollo, sin implementar hacking."
  },
  proTech: {
    displayName:"Protecnos",shortDescription:"Investigadores convencidos de que la tecnología devolverá la grandeza a la humanidad.",beliefs:"Investigación y desarrollo pueden resolver casi cualquier problema.",objectives:"Llegar a una nueva Era de las Máquinas y transformar la vida mediante nuevas tecnologías.",allies:["corporeMetal"],enemies:["purgers","antifrankenstein"],structure:"Grupos independientes sin jerarquía formal trabajan en proyectos secretos, buscan materiales y equipo experimental y suelen sustraer recursos del Ordenador.",
    hierarchy:"Sin escalera formal; prestigio por conseguir materiales, probar prototipos, inventar, reprogramar máquinas y ayudar a otros Protecnos.",benefits:"Información, materiales y equipo relativamente accesibles, pero con comunicaciones irregulares y prototipos peligrosos.",gmNotes:"Algunos han vulnerado la seguridad del Ordenador y acceden a programas o bases desconocidos incluso para las autoridades. El acceso se adjudica, no se automatiza."
  },
  psionics: {
    displayName:"Psiónicos",shortDescription:"Mutantes psíquicos que preparan una futura Era Psiónica mediante protección y aprendizaje.",beliefs:"Los poderes psíquicos son el siguiente paso evolutivo y deben gobernar la sociedad.",objectives:"Desarrollar poderes, proteger mutantes psiónicos y construir su nueva era, incluso reemplazando el orden vigente.",allies:[],enemies:["antimutants"],structure:"Individualistas con pocas reuniones y escaso contacto físico. Telepatía y Lectura mental permiten comunicación y supervisión de pequeños grupos.",
    hierarchy:"Ascenso por desarrollar poderes, reclutar psiónicos, asumir autoridad y combatir amenazas Antimutantes.",specialRules:"Cada nuevo nivel da instrucción para un nuevo poder psiónico elegido por el DJ. Cada nivel se concede una sola vez, conservando el poder original. La compatibilidad inicial sigue requiriendo revisión del DJ."
  },
  purgers: {
    displayName:"Purgadores",shortDescription:"Saboteadores militares que quieren liberar a humanos y máquinas de la tiranía del Ordenador.",beliefs:"El Ordenador es corrupto y maligno; obedecer su sistema traiciona a la humanidad.",objectives:"Destruir al Ordenador, sabotear sus sistemas y combatir sus fallos hasta liberar a humanos, robots y otros seres.",allies:["humanists","romantics","deathLeopards"],enemies:["firstChurchChristProgrammer"],
    structure:"Organización militar: los superiores movilizan miembros para misiones y esperan obediencia inmediata. El fracaso puede provocar expulsión o purga.",hierarchy:"Prestigio por sabotajes eficaces, desafío y misiones cumplidas; los resultados importan más que los gestos.",benefits:"Amplios recursos de información, material y equipo, a menudo robados al Ordenador. Las peticiones pueden demorarse por los canales de mando."
  },
  romantics: {
    displayName:"Románticos",shortDescription:"Coleccionistas de una Vieja Era idealizada y reconstruida a partir de fragmentos culturales.",beliefs:"El destino glorioso humano está en una Vieja Era de coches, suburbios, televisión, deportes, hamburguesas y consumo; su interpretación histórica suele ser errónea.",objectives:"Recuperar historia y reliquias y regresar a esa forma de vida, oponiéndose al mundo del Ordenador.",allies:["humanists","purgers"],enemies:["firstChurchChristProgrammer","corporeMetal","proTech"],
    structure:"Perdieron buena parte de sus archivos históricos. La cultura actual mezcla fragmentos supervivientes y mitología reconstruida.",hierarchy:"Ascenso por sabotear al Ordenador, rescatar artefactos, libros y grabaciones y demostrar conocimiento de Culturas Antiguas.",benefits:"Excelente información del Exterior y conocimientos parciales o deformados de la Vieja Era.",specialRules:"Pueden adquirir Conocimiento de Culturas Antiguas con PD iniciales aunque normalmente esté restringido. Se expone como metadato, sin ampliar la lista global de habilidades."
  }
};
