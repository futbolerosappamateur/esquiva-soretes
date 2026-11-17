# ESQUIVA SORETES 💩

*Una aventura de mierda por Buenos Aires.*

Arcade 2.5D de desplazamiento lateral: caminá por las veredas de San Telmo esquivando
soretes, baldosas flojas y hojas sospechosas, y llegá a la esquina con las zapatillas limpias.

Idea original de mi hija. Hecho con **Phaser 3**, **TypeScript** y **Vite**.

## Cómo jugar

| Acción | Teclado | Celular |
| --- | --- | --- |
| Avanzar / correr (mantener) | → o D | Joystick (mitad izquierda) |
| Retroceder | ← o A | Joystick |
| Ir hacia las casas / hacia el cordón | ↑ W / ↓ S | Joystick |
| Saltar | Espacio | Tocar la mitad derecha |
| Pausa | Esc o P | Botón ❚❚ |

- Pisar un sorete ensucia una de tus **3 zapatillas**. Con las tres sucias: game over.
- La **baldosa floja** te salpica y resta 100 puntos.
- El **sorete gigante** se rodea, o se salta *corriendo*.
- El **camuflado** se esconde entre las hojas secas (no todos los montones tienen premio).

Puntos: +10 por metro, +50 por sorete esquivado (multiplicador ×2 a ×5 por racha),
+25 extra si pasás "por un pelo" y +1000 si terminás la cuadra sin pisar ninguno.

## Requisitos

- Node.js 20.19 o superior (o 22.12+). Probado con Node 24.

## Comandos

```bash
npm install        # instala dependencias (sólo la primera vez)
npm run dev        # servidor local en http://localhost:5173
npm run build      # chequeo de TypeScript + build de producción en dist/
npm run preview    # sirve el build de producción en http://localhost:4173
npm run typecheck  # sólo el chequeo de TypeScript
```

**Probar en el celular:** con `npm run dev`, la consola muestra una dirección `Network`
(por ejemplo `http://192.168.0.10:5173`). Abrila desde un celular conectado al mismo Wi-Fi
y poné el teléfono en horizontal.

### Parámetros de depuración (en la URL)

- `?debug` muestra las huellas de colisión, posición, altura de salto y FPS (F2 lo oculta).
- `?seed=1234` fija la semilla: misma cuadra en cada partida.
- `?block=3` empieza directamente en la cuadra 3.

Se pueden combinar: `http://localhost:5173/?debug&seed=1234&block=2`

## Cómo está hecho

### Perspectiva 2.5D

Cada entidad tiene tres coordenadas:

- `x`: avance a lo largo de la vereda.
- `y`: **profundidad** dentro de la vereda (hacia las fachadas o hacia el cordón). No es un salto.
- `z`: altura del salto, independiente de la profundidad.

El sprite se dibuja en `(x, y - z)`, la sombra queda en `(x, y)` y todo se ordena por `y`,
así el personaje pasa por delante o por detrás de árboles, faroles y soretes.
Las colisiones usan sólo la **huella de los pies** (un rectángulo chico) contra la huella
real de cada obstáculo en el piso (elipses o rectángulos), y la altura `z` se compara con
la altura de cada obstáculo para saber si un salto lo esquiva.

### Camino siempre posible

El generador arma cada cuadra por tramos con patrones (muros con hueco, zigzag, diagonales,
pasillos, campos minados...) y valida cada tramo con una grilla: si no queda un recorrido
posible avanzando y moviéndose en profundidad (sin necesidad de saltar), reintenta con
otro patrón. Se verificó con un validador independiente sobre 280 cuadras generadas:
ninguna quedó sin salida.

### Estructura

```
src/
  main.ts                 configuración de Phaser y escenas
  config/                 dimensiones, balance (velocidades, puntos, dificultad), paleta y textos
  core/                   LocalStorage, preferencias, récords, semillas aleatorias, estado de la partida
  audio/                  sintetizador Web Audio: efectos (sfx.ts) y música por patrones (music.ts)
  input/                  teclado + controles táctiles unificados
  graphics/               lienzo de pixel art, fuente bitmap propia, animaciones
    textures/             generadores de cada grupo de gráficos (personaje, soretes, fachadas...)
  entities/               jugador, obstáculos, palomas y peatones
  systems/                colisiones, puntuación, cámara y efectos visuales
  world/                  barrios, cuadras, patrones, generador de niveles y vista del mundo
  ui/                     textos, botones, menús navegables con teclado y paneles
  scenes/                 Boot, Menú, Cómo jugar, Opciones, Juego, HUD, Pausa, Game Over, Victoria
  debug/                  overlay de depuración y parámetros de URL
```

## Cómo extenderlo

- **Balancear:** todos los números están en `src/config/balance.ts` (velocidades, salto,
  puntos, multiplicadores, invulnerabilidad, márgenes del generador).
- **Nueva cuadra:** agregar una entrada en `src/world/blocks.ts` (calles, largo, dificultad
  y, si querés, un guion de patrones obligatorios como el de la cuadra 1).
- **Nuevo barrio:** agregar un tema en `src/world/themes.ts` con sus fachadas
  (`FACADE_SPECS` en `graphics/textures/facadeTextures.ts`), árboles y autos.
- **Nuevo obstáculo:** sumarlo en `src/entities/obstacles/ObstacleTypes.ts` (huella, altura,
  efecto), dibujar su textura y usarlo desde un patrón en `src/world/patterns.ts`.
- **Nuevo personaje:** definir otro `CharacterLook` en `graphics/textures/playerTextures.ts`.
- **Gráficos definitivos:** todas las claves de texturas y frames están en `src/graphics/keys.ts`.
  Alcanza con cargar imágenes con esas claves en `BootScene` (y quitar el generador
  correspondiente en `graphics/textures/index.ts`); la lógica no cambia.
- **Sonidos y música definitivos:** `AudioManager` expone `play(nombre)` y `playMusic(tema)`;
  se puede reemplazar la síntesis por archivos sin tocar las escenas.

## Elementos provisionales

- Todos los gráficos son pixel art **generado por código** (originales, sin recursos de terceros).
- Efectos de sonido y música **sintetizados** con Web Audio API (melodías originales:
  un tango en el menú y una milonga durante el juego).
- La fuente pixelada también es original y se genera al iniciar.

## Créditos

Idea: mi hija. Motor: [Phaser 3](https://phaser.io). Todo el arte y el audio son originales.
