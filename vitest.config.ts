import { defineConfig } from 'vitest/config';

// Pruebas de la lógica pura del juego (sin Phaser ni navegador).
// Se ejecutan con `npm test` (ver scripts/test.mjs).
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
