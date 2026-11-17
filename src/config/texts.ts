/**
 * Todos los textos del juego en un solo lugar (castellano rioplatense).
 * La fuente pixelada es de mayúsculas: los textos se muestran en mayúsculas.
 */
export const TEXTS = {
  titleTop: 'ESQUIVA',
  titleBottom: 'SORETES',
  subtitle: 'Una aventura de mierda por Buenos Aires',

  menu: {
    play: 'JUGAR',
    howTo: 'CÓMO JUGAR',
    options: 'OPCIONES',
    record: 'RÉCORD',
    noRecord: 'TODAVÍA SIN RÉCORD',
    keyboardHint: 'FLECHAS / WASD PARA MOVERTE · ESPACIO PARA SALTAR',
    touchHint: 'TOCÁ JUGAR PARA EMPEZAR',
    fullscreen: 'PANTALLA COMPLETA',
  },

  howTo: {
    title: 'CÓMO JUGAR',
    pageControls: 'CONTROLES',
    pageObstacles: 'OBSTÁCULOS Y PUNTOS',
    goal: 'LLEGÁ A LA ESQUINA CON LAS ZAPATILLAS LIMPIAS.',
    keyboard: [
      ['→  D', 'AVANZAR (MANTENÉ PARA CORRER)'],
      ['←  A', 'RETROCEDER'],
      ['↑  W', 'IR HACIA LAS CASAS'],
      ['↓  S', 'IR HACIA EL CORDÓN'],
      ['ESPACIO', 'SALTAR'],
      ['ESC', 'PAUSA'],
    ] as [string, string][],
    touch: 'EN EL CELU: JOYSTICK A LA IZQUIERDA, TOCÁ LA DERECHA PARA SALTAR.',
    obstacles: [
      ['SORETE', 'PISARLO TE ENSUCIA UNA ZAPATILLA.'],
      ['SORETE GIGANTE', 'RODEALO, O SALTALO CORRIENDO.'],
      ['CAMUFLADO', 'SE ESCONDE ENTRE LAS HOJAS SECAS.'],
      ['BALDOSA FLOJA', 'TE SALPICA: -100 PUNTOS.'],
    ] as [string, string][],
    scoring: [
      '+10 POR METRO · +50 POR SORETE ESQUIVADO',
      'ESQUIVÁ SEGUIDO PARA MULTIPLICAR (x2 A x5)',
      '+1000 SI TERMINÁS LA CUADRA SIN PISAR NINGUNO',
    ],
    next: 'SIGUIENTE',
    prev: 'ANTERIOR',
    back: 'VOLVER',
  },

  options: {
    title: 'OPCIONES',
    sound: 'EFECTOS',
    music: 'MÚSICA',
    volume: 'VOLUMEN',
    fullscreen: 'PANTALLA COMPLETA',
    on: 'SÍ',
    off: 'NO',
    back: 'VOLVER',
    saved: 'LAS PREFERENCIAS SE GUARDAN SOLAS',
  },

  hud: {
    score: 'PUNTOS',
    block: 'CUADRA',
  },

  pause: {
    title: 'PAUSA',
    resume: 'CONTINUAR',
    restart: 'REINICIAR',
    quit: 'SALIR AL MENÚ',
  },

  gameOver: {
    title: 'GAME OVER',
    message: '¡LLEGASTE A CASA CON LAS ZAPATILLAS LLENAS DE MIERDA!',
    score: 'PUNTUACIÓN FINAL',
    distance: 'DISTANCIA RECORRIDA',
    dodged: 'SORETES ESQUIVADOS',
    record: 'RÉCORD PERSONAL',
    newRecord: '¡NUEVO RÉCORD!',
    retry: 'REINTENTAR',
    menu: 'MENÚ PRINCIPAL',
  },

  victory: {
    title: '¡CUADRA COMPLETADA!',
    distance: 'DISTANCIA',
    dodged: 'SORETES ESQUIVADOS',
    bestCombo: 'MEJOR RACHA',
    perfect: 'BONUS ZAPATILLAS INTACTAS',
    noPerfect: 'BONUS ZAPATILLAS INTACTAS',
    blockScore: 'PUNTOS DE LA CUADRA',
    total: 'TOTAL',
    record: 'RÉCORD',
    newRecord: '¡NUEVO RÉCORD!',
    next: 'SIGUIENTE CUADRA',
    replay: 'VOLVER A JUGAR',
    menu: 'MENÚ PRINCIPAL',
    neighborhoodDone: '¡RECORRISTE TODO EL BARRIO!',
  },

  game: {
    go: '¡A CAMINAR!',
    corner: '¡LLEGASTE A LA ESQUINA!',
  },
} as const;

/** Frases graciosas que aparecen durante el juego (se eligen al azar). */
export const PHRASES = {
  closeCall: ['¡POR UN PELO!', '¡CASI LA PISÁS!', '¡QUÉ REFLEJOS!', '¡UFFF!'],
  hit: ['¡QUÉ ASCO!', '¡MIRÁ POR DÓNDE CAMINÁS!', '¡NOOO, LAS NUEVAS!', '¡LA PUCHA!', '¡ESO NO ERA BARRO!'],
  looseTile: ['¡BALDOSA FLOJA!', '¡SPLASH!', '¡ME EMPAPÉ!'],
  combo: ['¡GAMBETA!', '¡QUÉ FINTA!', '¡ESQUIVADOR SERIAL!', '¡GAMBETA DE CRACK!', '¡IMPARABLE!'],
  perfect: '¡ZAPATILLAS INTACTAS!',
  splat: '¡PLAF!',
} as const;
