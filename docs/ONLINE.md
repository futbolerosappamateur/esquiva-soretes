# Modo online de ESQUIVA SORETES

Cuentas, perfiles, progreso guardado en la nube y rankings globales, con
Supabase (Auth + PostgreSQL). El juego **sigue funcionando sin nada de esto**:
si el modo online no está configurado (o no hay conexión) se juega en **modo
local**, como siempre, y el menú lo dice claramente.

- [Qué incluye](#qué-incluye)
- [Cómo funciona](#cómo-funciona)
- [Probarlo sin Supabase (servidor de prueba)](#probarlo-sin-supabase-servidor-de-prueba)
- [Configurar Supabase paso a paso](#configurar-supabase-paso-a-paso)
- [Seguridad y validación de partidas](#seguridad-y-validación-de-partidas)
- [Privacidad y perfiles de chicos](#privacidad-y-perfiles-de-chicos)
- [Moderación](#moderación)
- [Progreso local: migración e importación](#progreso-local-migración-e-importación)
- [Si cambia el juego: reglas del servidor](#si-cambia-el-juego-reglas-del-servidor)
- [Referencia: tablas y funciones](#referencia-tablas-y-funciones)
- [Próximas etapas](#próximas-etapas)
- [Solución de problemas](#solución-de-problemas)

## Qué incluye

**Etapa 1 (lista):**

- Cuentas con correo y contraseña (Supabase Auth): crear cuenta, confirmar el
  correo, entrar, salir, recuperar la contraseña.
- Una cuenta (de un adulto) puede tener hasta 6 **perfiles de jugador**: el
  propio y **perfiles supervisados** para chicos, sin correo propio.
- Cada perfil: apodo público único, avatar (personajes del juego, nada de
  fotos), personaje favorito, estadísticas, barrios y niveles completados,
  personajes desbloqueados, monedas, logros e insignias, historial de
  partidas, récords personales y privacidad.
- Progreso guardado en el servidor y sincronizado con el dispositivo (se puede
  jugar sin conexión: las partidas se mandan solas cuando vuelve).
- Rankings globales por nivel y modalidad: menor tiempo, mayor puntaje y mejor
  marca de cada personaje (una marca por jugador). En el juego: **RANKING → VER:
  GLOBAL** (o la tecla **G**).
- Récords personales verificados y no verificados (importados).
- Bloquear perfiles y reportar apodos inapropiados (desde la ficha de un
  jugador en el ranking global). Privacidad del perfil: público, sólo amigos o
  privado, y aparecer o no en los rankings.
- Importar una vez el progreso de un perfil local (queda como "no verificado").

**Etapa 2 (el servidor ya la soporta, falta la interfaz):** amistades con
solicitudes, rankings entre amigos y desafíos de tiempo o puntaje.

**Etapa 3 (diseñada, sin implementar):** actividad social, torneos y eventos
semanales, recompensas comunitarias. Ver [Próximas etapas](#próximas-etapas).

No hay chat ni mensajes privados.

## Cómo funciona

```
Juego (Phaser)                     src/social/ (cliente online)                 Supabase
───────────────                    ─────────────────────────────                ─────────────────────────────
GameScene ── fin de partida ──▶    onlineSession.reportRun()  ── cola local ──▶ submit_run()  (función SQL)
MenuScene / Perfiles / Ranking ◀── onlineSession (estado, perfiles)   ◀──────▶  Auth (cuentas)
Panel HTML (ui/accountPanel) ───▶  cuenta, perfiles, privacidad, historial ──▶ funciones RPC + RLS
```

- **El juego no escribe tablas.** Todo pasa por funciones del servidor (RPC)
  que validan los datos: `submit_run`, `create_profile`, `update_profile`,
  `import_local_progress`, etc. Las tablas tienen Row Level Security y los
  clientes sólo pueden leer sus propias filas.
- **El servidor manda.** Un perfil online tiene una copia local en el
  dispositivo (para jugar sin conexión). Cada respuesta del servidor reemplaza
  esa copia: monedas, niveles, personajes y logros los calcula el servidor.
- **Cola de partidas.** Al terminar una partida (completa o perdida) de un
  perfil online, el informe se guarda en el dispositivo y se manda en orden.
  Si no hay conexión o sesión, se reintenta solo. Cada partida tiene un id
  único: aunque se mande dos veces, cuenta una sola vez.
- **Modo local.** Los perfiles locales funcionan exactamente igual que antes
  (récords del dispositivo, progreso en LocalStorage). La librería de Supabase
  ni siquiera se descarga si el modo online no está configurado.
- **Invitados.** Sin cuenta se juega en modo local y se pueden mirar los
  rankings globales, pero las partidas no entran a ellos.

Archivos principales:

| Dónde | Qué |
|---|---|
| `supabase/migrations/…_social_core.sql` | Tablas, RLS, permisos y funciones del servidor. |
| `supabase/migrations/…_game_rules.sql` | Reglas del juego para validar (generadas desde el código). |
| `src/social/onlineSession.ts` | Sesión, sincronización, cola de envíos, rankings. |
| `src/social/backend.ts` | Única pieza que conoce a Supabase (carga diferida). |
| `src/social/runReport.ts` | Informe de partida que se manda al servidor. |
| `src/social/stateMapping.ts` | Progreso del servidor ⇄ guardado local; importación. |
| `src/social/ui/` | Panel HTML de la cuenta (formularios con teclado nativo). |
| `src/social/nicknameRules.ts` | Reglas de apodos (las mismas que en el servidor). |
| `scripts/online-sandbox/` | Servidor de prueba local. |
| `tests/social/` | Pruebas de la base (PostgreSQL real) y del cliente. |

## Probarlo sin Supabase (servidor de prueba)

Para ver y probar el modo online sin crear nada:

```bash
npm run online:sandbox     # terminal 1: servidor de PRUEBA en http://127.0.0.1:54321
npm run dev:sandbox        # terminal 2: el juego usando ese servidor
```

Abrí **http://localhost:5174**. En el menú aparece **INVITADO (LOCAL)**: tocalo
(o andá a **PERFIL → CUENTA ONLINE**) para crear una cuenta de prueba.

El servidor de prueba corre las **mismas migraciones** en un PostgreSQL local
(PGlite) e imita lo mínimo de Supabase. No manda correos (las cuentas quedan
confirmadas en el acto) y los datos se borran al cerrarlo; con
`npm run online:sandbox -- --persist` se guardan en `.online-sandbox/`.
**No es para producción.**

## Configurar Supabase paso a paso

### 1. Crear el proyecto

1. Entrá a <https://supabase.com>, creá una cuenta y un proyecto nuevo
   (**New project**). Para jugadores de Argentina conviene la región
   **South America (São Paulo)**.
2. Guardá la contraseña de la base que te pide (no va en el juego).

### 2. Aplicar las migraciones

**Opción A, sin instalar nada:** en el panel de Supabase, **SQL Editor → New
query**. Pegá el contenido completo de cada archivo de `supabase/migrations/`
**en orden** (primero `…_social_core.sql`, después `…_game_rules.sql`) y
apretá **Run** en cada uno. Tiene que terminar con "Success".

**Opción B, con la CLI de Supabase** (desde la carpeta del proyecto):

```bash
npx supabase login
npx supabase init                       # una sola vez (crea supabase/config.toml)
npx supabase link --project-ref TU_REF  # el "ref" está en la URL del proyecto
npx supabase db push                    # aplica las migraciones que falten
```

### 3. Autenticación

En **Authentication**:

- **Sign In / Providers → Email**: habilitado, con **Confirm email** activado.
  Subí el mínimo de la contraseña a **8** (el juego ya lo pide).
- **URL Configuration → Site URL**: la dirección donde se publica el juego
  (por ejemplo `https://tu-usuario.github.io/esquiva-soretes/`).
  En **Redirect URLs** agregá también `http://localhost:5173` y
  `http://localhost:4173` para probar en tu compu. Los enlaces de
  confirmación y de "olvidé mi contraseña" vuelven a esas direcciones.
- **Emails**: el envío incluido de Supabase permite muy pocos correos por
  hora. Para jugadores reales configurá un **SMTP propio** (Resend, Brevo,
  etc.). Podés traducir las plantillas al castellano.
- Recomendado antes de abrirlo al público: activar **CAPTCHA** (Turnstile o
  hCaptcha) contra cuentas automáticas. El juego todavía no muestra el
  CAPTCHA: hay que sumarlo al formulario de crear cuenta.

### 4. Las dos claves que necesita el juego

- **URL del proyecto**: Project Settings → Data API (o la URL que figura en
  la portada del proyecto), algo como `https://abcdefghijklmnop.supabase.co`.
- **Clave publicable**: Project Settings → **API Keys** → `sb_publishable_…`
  (en proyectos viejos sirve la "anon public").

> ⚠️ **Nunca** uses la clave secreta (`sb_secret_…`) ni la `service_role` en el
> juego: todo lo que empieza con `VITE_` queda dentro del juego publicado y
> cualquiera lo puede leer. Si alguien la pone por error, el juego la detecta,
> no la usa y avisa en la consola. La clave publicable sí es pública a
> propósito: la seguridad está en las reglas de la base.

### 5. Variables de entorno

Copiá `.env.example` como **`.env.local`** (no se sube a GitHub) y completá:

```
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
```

Reiniciá `npm run dev`. El menú tiene que decir **INVITADO (LOCAL)** en vez de
**MODO LOCAL**: eso significa que encontró el servidor.

### 6. Publicar

`npm run build` incrusta esas dos variables en el juego. Si lo compila un
servicio (Netlify, Vercel, GitHub Actions), cargalas como variables de entorno
del build con los mismos nombres. Acordate de poner la dirección publicada en
**Site URL** (paso 3).

### 7. Verificar

1. Menú → tocá **INVITADO (LOCAL)** → **CREAR CUENTA**.
2. Confirmá el correo (el enlace vuelve al juego con la sesión iniciada) y
   aceptá las condiciones.
3. Creá tu perfil y tocá **JUGAR**: el menú dice **ONLINE: CONECTADO**.
4. Completá un nivel: abajo de los resultados aparece
   **RESULTADO VERIFICADO · PUESTO 1 GLOBAL EN VELOCIDAD**.
5. **VER RANKING → VER: GLOBAL**.

## Seguridad y validación de partidas

- **Row Level Security** en todas las tablas y **permisos mínimos**: los roles
  `anon` y `authenticated` no pueden insertar, modificar ni borrar nada; sólo
  leer sus propias filas. Supabase da permisos amplios por defecto en el
  esquema `public`: la migración los quita explícitamente.
- Las funciones son `security definer` con `search_path` vacío y nombres
  calificados. Las internas viven en el esquema `private` (la API no lo
  expone) y no las puede ejecutar ningún cliente.
- Ninguna función devuelve emails ni datos de la cuenta. Los rankings y las
  fichas públicas muestran apodo, avatar y lo que la privacidad permita.
- Nada de claves secretas en el juego (ver arriba).

**Qué valida `submit_run`** (primera barrera, coherencia básica):

| Control | Si falla |
|---|---|
| Nivel, modalidad y personaje existentes (formato de los datos) | error, no se guarda |
| Personaje desbloqueado y nivel desbloqueado según el progreso del servidor | rechazada |
| Tiempo: no menor que el mínimo físico del nivel (largo ÷ velocidad máxima posible) ni mayor a 3 horas | rechazada |
| Puntaje: no mayor que el máximo teórico del nivel | rechazada |
| Desglose: distancia + esquivadas + bonus − penalidades = puntaje, cada parte dentro de su tope | sospechosa |
| Bonus de velocidad igual al que corresponde al tiempo (cero si hubo ayudas) | sospechosa |
| Soretes esquivados, cruces, misión, monedas y logros dentro de lo que tiene el nivel | sospechosa (se acredita recortado) |
| Parciales de cada esquina crecientes y dentro del tiempo total | sospechosa |
| Retomar desde una esquina sin marcar la partida como asistida | sospechosa (y queda asistida) |
| Más de 40 partidas en 5 minutos por cuenta | error (reintentar después) |

- **Rechazada**: no se acredita nada. **Sospechosa**: se guarda, se acredita
  lo razonable y no entra a rankings hasta que alguien la revise. **Válida**:
  cuenta para todo. Sólo las partidas **válidas, completas y sin ayudas**
  entran a los rankings oficiales (las asistidas por checkpoint nunca).
- Las reglas de cada nivel (largo, monedas, soretes, cruces, puntajes máximos,
  tiempos del bonus) se calculan desde el código del juego, que genera los
  niveles con su semilla: son siempre iguales.

**Lo que esto no garantiza.** Un tramposo puede modificar el juego y mandar una
partida inventada pero coherente (dentro de los topes). Para eso el sistema
quedó preparado para una verificación más robusta:

1. Cada partida guarda `event_log` (hoy: los parciales de cada esquina) y
   `validation_version`.
2. El siguiente paso es grabar las **entradas** del jugador con marcas de
   tiempo y reproducir la partida en el servidor (los niveles ya son
   deterministas por semilla). Requisito previo: que la simulación corra a
   paso fijo (hoy usa el tiempo real de cada cuadro).
3. Un proceso con la clave secreta (Edge Function o worker, nunca el juego)
   revisa las partidas y llama a `set_run_status` para validarlas o
   rechazarlas. Mientras tanto se pueden revisar a mano (ver
   [Moderación](#moderación)).

Otros límites: 10 reportes por día, 20 solicitudes de amistad y 20 desafíos por
día por perfil, y un cambio de apodo por día (el primero es libre).

## Privacidad y perfiles de chicos

**Qué se guarda:** el correo (sólo en Supabase Auth, nunca visible para otros),
apodo, avatar elegido de una lista, personaje favorito, progreso, partidas y
preferencias de privacidad. **Qué no se pide:** nombres reales, fotos,
ubicación ni fecha de nacimiento.

- La cuenta la crea un **adulto**, que lo confirma en el primer ingreso
  (queda registrado con la versión de las condiciones).
- Los **perfiles supervisados** (para chicos) no tienen correo propio y
  arrancan **privados, fuera de los rankings y sin funciones sociales**. Hacerlos
  más visibles o habilitar lo social pide la autorización explícita del adulto,
  que queda registrada en `guardian_consents`.
- Bloquear a alguien lo saca de tus rankings y corta amistades, solicitudes y
  desafíos entre los dos. Si alguien te bloquea, no podés ver su ficha.

**Antes de habilitar funciones sociales para menores** (etapa 2) conviene:
revisar los textos legales y la política de privacidad (en Argentina, Ley
25.326 de Protección de Datos Personales; si hay jugadores de otros países,
normas como COPPA o el GDPR), sumar una verificación de adulto más fuerte que
una casilla, tener moderación activa de los reportes y ofrecer al adulto un
resumen de la actividad del perfil supervisado.

**Borrar datos:** desde el juego se puede borrar cada perfil online (borra su
progreso, partidas y récords). Para borrar la cuenta entera (el correo):
Supabase → Authentication → Users → Delete user; todo lo demás se borra en
cascada. La función `delete_my_data()` borra todos los perfiles de la cuenta
desde el juego (la interfaz para pedirlo todavía no está).

## Moderación

Se hace desde el **SQL Editor** de Supabase (corre con permisos de
administrador). Ejemplos:

```sql
-- Reportes abiertos (apodo reportado, motivo, detalle)
select r.created_at, r.nickname_snapshot, r.reason, r.details, r.reported_id
from public.reports r where r.status = 'open' order by r.created_at;

-- Cambiar un apodo inapropiado por uno neutro (cierra sus reportes)
select public.moderate_nickname('ID-DEL-PERFIL');

-- Descartar un reporte
select public.resolve_report('ID-DEL-REPORTE', 'dismissed');

-- Suspender (o rehabilitar) una cuenta: sale de rankings y no puede jugar online
select public.set_account_ban('ID-DE-LA-CUENTA', true, 'motivo');

-- Partidas en revisión y cómo resolverlas
select id, nickname, level_id, time_ms, score, status_reasons from public.runs
where status = 'suspicious' order by created_at desc;
select public.set_run_status('ID-DE-LA-PARTIDA', 'valid', '{revisada a mano}');
```

La lista de palabras prohibidas en apodos está en `src/social/nicknameRules.ts`
(se copia a la base con `npm run online:rules`).

## Progreso local: migración e importación

- Los datos actuales **no se tocan**: perfiles locales, récords del dispositivo
  y preferencias siguen en LocalStorage.
- Al crear un perfil online, el juego ofrece **traer el progreso de un perfil
  local** (una sola vez por perfil online): barrios, estrellas, monedas,
  personajes, logros y mejores marcas. Ese perfil local pasa a ser la copia
  del perfil online.
- Lo importado queda marcado como **no verificado**: cuenta para la campaña y
  los récords personales, **nunca** para los rankings oficiales. El servidor lo
  recorta a lo posible (niveles en orden de campaña, monedas y logros con tope
  según los niveles importados).

## Si cambia el juego: reglas del servidor

Si se modifica un nivel, un personaje, un logro, un avatar o la lista de
palabras prohibidas, la prueba `tests/social/rules.test.ts` avisa. Entonces:

```bash
npm run online:rules   # crea supabase/migrations/<fecha>_game_rules.sql
```

y se aplica esa migración nueva (SQL Editor o `npx supabase db push`). Las
migraciones ya aplicadas no se editan.

## Referencia: tablas y funciones

| Tabla | Para qué |
|---|---|
| `game_rules`, `game_barrios`, `game_levels`, `game_characters`, `game_achievements`, `game_avatars`, `game_banned_words` | Reglas del juego (generadas). |
| `accounts` | Una por identidad de Supabase Auth: confirmación de adulto, rol, suspensión. |
| `profiles` | Perfiles de jugador: apodo, avatar, favorito, supervisado, privacidad. |
| `guardian_consents` | Autorizaciones del adulto para perfiles supervisados. |
| `profile_stats` | Monedas y estadísticas acumuladas. |
| `profile_levels`, `profile_achievements`, `profile_characters`, `profile_badges`, `profile_mission_rewards` | Progreso. |
| `runs` | Cada partida: usuario, perfil y apodo, personaje, barrio, nivel, tiempo, puntaje, fecha, modalidad, estado de validación y ayudas. |
| `friendships`, `blocks`, `reports`, `challenges` | Funciones sociales. |

Funciones para el juego: `get_my_state`, `accept_terms`, `create_profile`,
`update_profile`, `delete_profile`, `delete_my_data`, `submit_run`,
`get_my_runs`, `get_personal_records`, `get_leaderboard`, `get_public_profile`,
`find_profile`, `import_local_progress`, `block_profile`, `unblock_profile`,
`get_blocked`, `report_profile`, `send_friend_request`,
`respond_friend_request`, `remove_friend`, `get_friends`, `create_challenge`,
`respond_challenge`, `get_challenges`. Sólo con la clave secreta (moderación):
`moderate_nickname`, `set_run_status`, `set_account_ban`, `resolve_report`.

## Próximas etapas

**Etapa 2: amistades y desafíos.** El servidor ya tiene solicitudes de
amistad (con bloqueo y límites), el ranking entre amigos
(`get_leaderboard(…, p_scope => 'friends')`) y desafíos (`create_challenge`:
superar mi mejor marca oficial en un nivel; se completan solos cuando el amigo
la supera). Falta la interfaz: botón "agregar amigo" en la ficha pública,
lista de amigos y solicitudes en el panel, pestaña AMIGOS en el ranking y
desafíos.

**Etapa 3: comunidad.** Diseño propuesto:

- `activity_events` (perfil, tipo: insignia, récord, nivel completado; fecha;
  visibilidad): actividad de amigos respetando la privacidad.
- `competitions` (nivel, modalidad, inicio, fin, reglas) y
  `competition_entries` calculadas desde `runs` oficiales: torneos semanales.
- `community_goals` (meta colectiva, por ejemplo "un millón de soretes
  esquivados", y su recompensa) sumando `profile_stats`.

Todo con las mismas reglas: escritura sólo por funciones del servidor, RLS y
datos públicos mínimos.

## Solución de problemas

- **El menú dice MODO LOCAL** aunque configuraste: revisá que el archivo se
  llame `.env.local`, que las variables empiecen con `VITE_` y reiniciá
  `npm run dev`. En la consola del navegador aparece un aviso si la URL es
  inválida o si pusiste una clave secreta.
- **Dice SIN CONEXIÓN**: el servidor no responde. Si en la cuenta aparece
  "FALTA APLICAR LAS MIGRACIONES", hacé el paso 2.
- **No llega el correo de confirmación**: revisá spam; el envío incluido de
  Supabase tiene un límite muy bajo por hora (configurá SMTP propio).
- **El enlace del correo abre otra página o da error**: revisá Site URL y
  Redirect URLs (paso 3).
- **"ESE APODO YA LO TIENE OTRO JUGADOR"**: los apodos son únicos sin importar
  acentos (LUCÍA y LUCIA son el mismo).
