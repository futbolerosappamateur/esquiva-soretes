# ESQUIVA SORETES 💩

*Una aventura de mierda por Buenos Aires.*

Arcade 2.5D de desplazamiento lateral: recorré las veredas de Buenos Aires esquivando
soretes, baldosas flojas y hojas sospechosas, cruzá las calles con el semáforo y llegá a la
esquina con las zapatillas limpias.

Idea original de mi hija. Hecho con **Phaser 3**, **TypeScript** y **Vite**.

## Novedades de la versión 0.2

- **Campaña por barrios:** ciudad → barrios → niveles → cuadras. Cada barrio tiene 3 niveles
  de 5 cuadras, unidas por 4 esquinas con cruce peatonal. Completar un barrio desbloquea el siguiente.
- **Mapa de Buenos Aires** con los límites reales de los 48 barrios (datos oficiales de BA Data).
  Barrios bloqueados desaturados, disponibles a color, completados con insignia, ficha del
  jugador, caminos de progresión y animación al desbloquear. Se maneja con mouse, teclado y toque
  (arrastrar, pellizcar y botones de zoom).
- **San Telmo** jugable completo (día, noche y otoño) y **Monserrat** con un recorrido provisional.
- **Cruces peatonales** con semáforo vehicular y peatonal sincronizados, autos, taxis y
  colectivos que circulan en profundidad, bocinas de aviso, y choques caricaturescos.
- **Checkpoints** en cada esquina: si perdés, reintentás desde la última esquina.
- **Ambientaciones** por nivel: día, noche (faroles, ventanas encendidas) y otoño (hojas y más
  soretes camuflados). Estructura preparada para invierno, primavera, verano y lluvia.
- **Personajes seleccionables** (El Pibe, La Piba, La Corredora, Don Tito y Roberto el portero,
  que se desbloquea con monedas). Todos tienen las mismas capacidades.
- **Monedas** persistentes y una primera **misión**: el portero te pide juntar basura y llevarla al tacho.
- **Arreglo del salto:** se puede saltar en cualquier dirección. Además de Espacio, ahora saltan
  **X** y **K** (muchos teclados no registran Espacio cuando hay dos flechas apretadas).

## Cómo jugar

| Acción | Teclado | Celular |
| --- | --- | --- |
| Avanzar / correr (mantener) | → o D | Joystick (mitad izquierda) |
| Retroceder | ← o A | Joystick |
| Ir hacia las casas / hacia el cordón | ↑ W / ↓ S | Joystick |
| Saltar | Espacio, X o K | Tocar la mitad derecha |
| Pausa | Esc o P | Botón ❚❚ |

- Pisar un sorete ensucia una de tus **3 zapatillas**. Con las tres sucias: game over.
- La **baldosa floja** te salpica y resta 100 puntos.
- El **sorete gigante** se rodea, o se salta *corriendo*. El **camuflado** se esconde entre las hojas.
- En las esquinas: cruzá con el **hombrecito verde** (+250) y sin que te toque un auto (+150).
  Esperar el rojo no resta puntos ni corta la racha. Si te toca un auto perdés una zapatilla
  y volvés a la ochava.
- Las **monedas** se guardan al completar cada cuadra.

Puntos: +10 por metro, +50 por sorete esquivado (multiplicador ×2 a ×5 por racha), +25 si pasás
"por un pelo", +1000 por cuadra sin pisar nada. Las estrellas (1 a 3) dependen del puntaje; completar
el nivel siempre da al menos una y alcanza para avanzar.

## Requisitos

- Node.js 20.19 o superior (o 22.12+). Probado con Node 24.

## Comandos

```bash
npm install        # instala dependencias (sólo la primera vez)
npm run dev        # servidor local en http://localhost:5173
npm test           # pruebas automáticas de la lógica (Vitest)
npm run build      # chequeo de TypeScript + build de producción en dist/
npm run preview    # sirve el build de producción en http://localhost:4173
npm run typecheck  # sólo el chequeo de TypeScript
```

**Probar en el celular:** con `npm run dev`, la consola muestra una dirección `Network`
(por ejemplo `http://192.168.0.10:5173`). Abrila desde un celular conectado al mismo Wi-Fi
y poné el teléfono en horizontal.

### Parámetros de depuración (en la URL)

- `?debug` muestra huellas de colisión, autos, teclas apretadas y FPS (F2 lo oculta).
  Si al apretar Espacio no aparece en "TECLAS", es el teclado (ghosting): usá X o K.
- `?level=san-telmo-2` abre directamente ese nivel (ids en `src/data/campaign.ts`).
- `?block=3` empieza en la esquina anterior a la cuadra 3.
- `?env=night` fuerza una ambientación (`day`, `night`, `autumn`, `winter`, `spring`, `summer`, `rain`).
- `?seed=1234` cambia la semilla del nivel (por defecto cada nivel es siempre igual).
- `?unlockall` desbloquea todos los barrios jugables (modifica el progreso guardado).

Se pueden combinar: `http://localhost:5173/?debug&level=monserrat-1&block=2&env=night`

## Cómo está hecho

### Perspectiva 2.5D

Cada entidad tiene tres coordenadas: `x` (avance), `y` (**profundidad** dentro de la vereda) y
`z` (altura del salto). El sprite se dibuja en `(x, y - z)`, la sombra en `(x, y)` y todo se ordena
por `y`. Las colisiones usan sólo la **huella de los pies**. La física del jugador está en
`PlayerMotor` (sin Phaser) y tiene pruebas para las 9 direcciones caminando y corriendo.

### Camino siempre posible

El generador arma cada cuadra por tramos con patrones y valida cada tramo con una grilla de
caminos: si no queda un recorrido posible sin saltar, reintenta con otro patrón. Las pruebas lo
verifican con un validador independiente en todas las cuadras de todos los niveles. Las monedas y
la basura de la misión se ubican siempre sobre celdas alcanzables.

### Cruces

La calle transversal es una franja vertical: los vehículos avanzan en el eje de profundidad,
perpendicular al jugador. El semáforo (`TrafficLight`) alterna verde de autos → amarillo → todo
rojo → verde peatonal → titilante → todo rojo, con ciclos cortos. Los autos frenan antes de la
senda y el verde peatonal nunca empieza con un auto encima de las rayas: las pruebas simulan
miles de ciclos en ambos sentidos y con tránsito denso. Al acercarse, el semáforo se sincroniza
para que la espera sea breve.

### Mapa

`public/data/caba-barrios.geojson` es una versión simplificada (≈1.500 vértices, sin inventar
límites) del dataset oficial **Barrios** de Buenos Aires Data. Se regenera con
`node scripts/build-geo.mjs <barrios.geojson>`. En el juego se proyecta a 2D y se rasteriza sin
antialias (pixel art nítido) en tres niveles de zoom. El río y la provincia de fondo son
decorativos y aproximados. Si el archivo no se puede cargar, aparece un mapa provisional
claramente marcado como tal.

### Guardado

- `esquivaSoretes:save` — progreso (barrios, niveles, estrellas, récords por nivel), monedas,
  personajes y misiones. Tiene número de versión y migración: datos viejos o corruptos se rescatan
  sin romper el juego.
- `esquivaSoretes:records` y `esquivaSoretes:settings` — los de la v0.1, intactos.
- "Reiniciar progreso" en Opciones (con confirmación) borra la campaña, las monedas y los
  personajes, pero conserva récords y opciones.

### Estructura

```
src/
  main.ts                 configuración de Phaser y escenas
  config/                 dimensiones, balance, controles, paleta y textos
  data/                   datos del escenario: campaña, ambientaciones, vehículos, personajes, NPC, misiones
  core/                   LocalStorage, guardado y progreso, récords, semillas, estado de la partida
  assets/                 manifiesto y carga de gráficos definitivos
  audio/                  sintetizador Web Audio: efectos y música
  input/                  teclado (KeyboardInputState) + controles táctiles
  graphics/               lienzo de pixel art, fuente, animaciones, looks de personajes
    textures/             generadores de los gráficos provisionales
  entities/               jugador (motor + vista), obstáculos, palomas y peatones
  npc/                    NPC con comportamientos (lógica separada de la vista)
  systems/                colisiones, puntuación, cámara, efectos, monedas y misiones
  world/                  generador de niveles, vista del mundo, temas
    crossing/             semáforo, tránsito, lógica y vista de los cruces
    map/                  GeoJSON, proyección, rasterizado y dibujo del mapa
  scenes/                 Boot, Menú, Mapa, Barrio, Personaje, Juego, HUD, Pausa, Resultados...
  debug/                  overlay de depuración y parámetros de URL
tests/                    pruebas de Vitest (salto, teclado, cruces, niveles, guardado, mapa)
scripts/                  test.mjs (lanzador de pruebas) y build-geo.mjs (datos del mapa)
```

## Cómo extenderlo

- **Balancear:** `src/config/balance.ts` (velocidades, puntos, duración de los niveles, semáforos,
  tránsito, estrellas, monedas).
- **Nuevo nivel o barrio:** `src/data/campaign.ts`. Cada nivel enumera sus calles, ambientación y
  dificultad; el generador hace el resto. El orden de los 48 barrios es configurable.
- **Ambientación:** `src/data/environments.ts`.
- **Vehículos:** `src/data/vehicles.ts`. **Personajes:** `src/data/characters.ts` + un look en
  `src/graphics/characterLooks.ts`. **NPC:** `src/data/npcs.ts` (se arman combinando
  comportamientos de `src/npc/behaviors.ts`). **Misiones:** `src/data/missions.ts`.
- **Gráficos definitivos:** declarar los archivos en `src/assets/manifest.ts` (imágenes,
  spritesheets o atlas con fondo transparente, con nombres de frame y punto de apoyo). Reemplazan
  al gráfico provisional con la misma clave sin tocar la lógica.

## Elementos provisionales

- Todos los gráficos son pixel art **generado por código** (originales, sin recursos de terceros).
- Efectos de sonido y música **sintetizados** con Web Audio API.
- Monserrat usa las fachadas de San Telmo y un recorrido provisional.
- Los NPC fuera del portero (señora regando, paseador, policía, animales...) están definidos como
  datos pero todavía no tienen sprites. La lluvia y las otras estaciones están preparadas como estructura.

## Créditos

Idea: mi hija. Motor: [Phaser 3](https://phaser.io). Todo el arte y el audio son originales.

Límites de los barrios: dataset **Barrios**, [Buenos Aires Data](https://data.buenosaires.gob.ar/dataset/barrios),
Gobierno de la Ciudad de Buenos Aires, licencia
[CC BY 2.5 AR](https://creativecommons.org/licenses/by/2.5/ar/). Simplificado para el juego.
