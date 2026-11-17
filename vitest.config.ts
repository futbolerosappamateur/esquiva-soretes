import { defineConfig } from 'vitest/config';

// Pruebas de la lógica pura del juego (sin Phaser ni navegador).
// Se ejecutan con `npm test` (ver scripts/test.mjs).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
