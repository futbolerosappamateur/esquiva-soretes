# Plan de ESQUIVA SORETES

Rumbo acordado el 22 de noviembre de 2026. Lo que ya está hecho se marca con ✅.

## Decisiones tomadas

- **Dónde:** el juego se publica en **esquivasoretes.com.ar**.
- **Competir:** cada jugador se hace su cuenta (o entra con **Google** o **Facebook**) y sus
  récords quedan guardados online. La cuenta la crea un adulto; los chicos juegan con perfiles
  supervisados (ya está así en el modo online: [ONLINE.md](ONLINE.md)).
- **Publicidad:** en la web y dentro del juego, en carteleras del escenario (muros, la parte de
  atrás de los kioscos de diarios y más lugares, abajo). Nunca avisos que interrumpan la partida.
- **Personajes:** se empieza con 4 elegibles (el pibe, la piba, el skater y el runner) y varios
  que se destraban.
- **Puntos:** son las monedas que se juntan jugando, separadas del puntaje de cada partida (que
  es el del ranking). Un personaje se destraba al llegar a un total acumulado **o** cumpliendo su
  desafío, lo que pase primero; gastar no lo vuelve a trabar. Los objetos se compran con lo que
  queda.
- **Objetos que ayudan** (por ejemplo, una lata de espinaca que da turbo): **sí cuentan para el
  ranking**. Como en Royal Match, cuanto más jugás, más facilidades conseguís: la idea es que den
  ganas de seguir jugando. El servidor valida cada partida sabiendo qué objetos se usaron.
- **Estética:** plastilina, con los fondos de frente y **proporciones realistas**. Las piezas
  del escenario llegan por separado, con una hoja de personajes para ver las proporciones
  ([art/README.md](../art/README.md)).
- **Barrios del lanzamiento:** San Telmo, el centro, La Boca, Palermo y Lugano. El primero, de
  prueba, es **Versalles**: ahí se empiezan a sacar las fotos.

## Orden de trabajo

1. ✅ **Barrios con personalidad.** Cada barrio declara sus rasgos (gente, árboles, estado de la
   vereda, palomas, peatones del fondo) en `src/data/campaign.ts`; el generador de niveles los
   usa. Monserrat ya es "el centro": la vereda llena de gente que hay que esquivar.
2. ✅ **Versalles:** casas bajas, árboles, tranquilidad, perros, vecinas regando y vecinos
   hinchas de Vélez (banderas blancas con la V azul y un paredón pintado). Tres niveles sobre
   las cuadras que se fotografían: todo el pasaje Aguaribay (3 cuadras) y dos de Madero.
   **Faltan las esquinas** (entre qué calles está cada cuadra): mientras tanto se muestra sólo
   la calle. Va tercero en la campaña, después de Monserrat, para no cambiar el progreso
   guardado ni las reglas del servidor; se prueba directo con `?level=versalles-1`.
3. **Dificultad:** que cada barrio presente su mecánica propia de a poco (como hoy el primer
   nivel presenta cada obstáculo) y que la dificultad suba de barrio en barrio.
4. **Puntos y tienda:** destrabar por puntos, objetos que ayudan y su validación en el servidor.
5. **Publicidad en el juego:** carteleras que traen los avisos del servidor, con avisos de la
   casa hasta que haya anunciantes, y un conteo de cuántas veces se vio cada uno.
6. **Online:** prueba cerrada en esquivasoretes.com.ar: el proyecto de Supabase, entrar con
   Google y Facebook, las páginas legales y la publicación automática.
7. **Arte de plastilina:** que el motor cargue fondos en alta resolución (con la primera pieza
   real) y pasar el juego al arte nuevo, barrio por barrio.
8. **Lanzamiento público:** cuando el primer barrio esté entero en plastilina con los 4
   personajes iniciales.

## Decidido: el juego en la hora y la estación de la vida real

Aprobado el 22 de noviembre de 2026: cada nivel se juega en **8 versiones** (de día y de noche, en las 4 estaciones), cada
personaje se viste según la estación y, si se quiere, el juego toma **la hora y la estación
reales** de quien juega.

- ✅ **Prototipo de la luz por hora:** un filtro de color sobre la escena sigue al sol de Buenos
  Aires (amanecer rosado, mañana, mediodía, tarde dorada, atardecer naranja y noche). El sol
  cambia con la estación: en verano se pone pasadas las 20; en invierno, antes de las 18. De
  noche se usa la ambientación de noche (ventanas prendidas y faroles). Se prueba con
  `?hora=19:30` o `?hora=real` (código: `src/graphics/daylight.ts`).
- **Mismo recorrido, mismos soretes en las 8 versiones:** así los récords se pueden
  comparar aunque cada uno juegue a otra hora. La hora y la estación cambian cómo se ve, la
  ropa y algún detalle (las hojas de otoño, las flores de primavera, los charcos de invierno),
  pero no la dificultad. Hoy los montones de hojas de otoño esconden soretes: con esta regla
  pasarían a ser decoración (o quedarían para desafíos especiales).
- **El arte no se multiplica por 8:** las fachadas son las mismas todo el año (más una capa con
  las ventanas prendidas para la noche); lo que cambia por estación son los árboles (verdes,
  otoñales, pelados, con flores) y lo que hay en el piso; el cielo y la luz los pone el filtro.
- **La ropa de cada personaje:** 3 vestuarios (verano, media estación para otoño y primavera, e
  invierno). Cada vestuario son 5 imágenes (caminar, correr, saltar, poder y sorete): 15 por
  personaje (con un vestuario por estación serían 20).
- **Hora real:** se toma la hora de la compu o del celular y la estación del hemisferio sur.
  Viene activada de entrada, con una opción para apagarla y elegir el momento a mano.
- **Para que den ganas de jugar:** logros por completar un nivel en las 4 estaciones o de día y
  de noche.

## Lo que hace falta de afuera

- **Versalles:** entre qué calles está cada cuadra del pasaje Aguaribay y de Madero (y por qué
  punta del pasaje se dobla a Madero).
- **Logo:** una versión más grande (1200 px o más, PNG con fondo transparente; si es animado,
  los cuadros por separado). El de ahora mide 418 px y es GIF (borde serruchado, 256 colores).
- **Cuentas:** Supabase, Google Cloud (para entrar con Google), Meta (para entrar con Facebook),
  y el hosting con la delegación del dominio en NIC Argentina. Algunas aprobaciones, como la de
  la red de anuncios, tardan semanas y piden el sitio publicado.
- **Arte:** las piezas del escenario por separado, la hoja de proporciones y los otros 3
  personajes iniciales en plastilina.
- **Revisión legal** antes de lanzar con publicidad: juegan chicos, así que los avisos tienen que
  ser no personalizados, la ley de etiquetado frontal (27.642) prohíbe publicitarles alimentos
  con sellos, y hacen falta las condiciones y la política de privacidad.

## Barrios y sus rasgos

Se pueden probar en cualquier nivel con `?rasgos=<barrio>` (por ejemplo,
`?level=san-telmo-1&rasgos=villa-lugano`; esa partida no cuenta para los rankings).

| Barrio | Rasgos | Mecánica propia | Estado |
| --- | --- | --- | --- |
| San Telmo | Los de siempre | — | Jugable |
| Monserrat (el centro) | Mucha gente, el doble de palomas, menos árboles | Gente caminando que esquiva soretes; si la chocás, perdés puntos y te frenás | Jugable |
| Versalles | Casas bajas, muchos árboles, nadie apurado, muchos paseadores de perros y vecinas; hinchas de Vélez | Perros (muchos soretes) y vecinas regando | Jugable (faltan las esquinas) |
| La Boca | Turistas, vereda gastada, pocos árboles | Más adelante: turistas que se frenan a sacar fotos | Sin niveles |
| Palermo | Muchos paseadores con perros | Más adelante: la jauría deja soretes frescos | Sin niveles |
| Lugano | Sin árboles, la vereda toda rota | Muchas baldosas flojas | Sin niveles |

## Ideas para la publicidad en el juego

Carteleras en los paredones, la parte de atrás de los kioscos de diarios, el panel de los
refugios de colectivo, el costado de los colectivos que pasan en los cruces, pizarrones en la
vereda, pantallas LED en el centro, el cartel de los taxis, y bancos y cestos de plaza. Fuera de
la partida: la pantalla de carga y la de resultados ("esta cuadra te la trajo…").

## Ideas de objetos para canjear (a confirmar)

Lata de espinaca (turbo), alfajor (una zapatilla extra), broche para la nariz (el olor no marea)
y botas de lluvia (pisás uno sin ensuciarte).
