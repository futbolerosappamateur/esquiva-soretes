import Phaser from 'phaser';
import { generateCrossingTextures } from './crossingTextures';
import { generateEffectTextures } from './effectTextures';
import { generateEnvironmentTextures } from './environmentTextures';
import { generateEnvironmentVariants } from './environmentVariants';
import { generateFacadeTextures } from './facadeTextures';
import { generateHudTextures } from './hudTextures';
import { generateNpcActorTextures } from './npcActorTextures';
import { generateNpcTextures } from './npcTextures';
import { generateObstacleTextures } from './obstacleTextures';
import { generatePlayerTextures } from './playerTextures';
import { generatePropTextures } from './propTextures';
import { generateUiTextures } from './uiTextures';

/**
 * Genera todos los gráficos provisionales del juego por código.
 * Para pasar a sprites definitivos: declararlos en assets/manifest.ts
 * (BootScene los carga y saltea el generador de esas claves).
 */
export interface TextureStep {
  label: string;
  /** Claves que produce este paso (si todas vienen cargadas desde archivos, se saltea). */
  provides?: string[];
  run: (t: Phaser.Textures.TextureManager) => void;
}

export const TEXTURE_STEPS: TextureStep[] = [
  { label: 'Zapatillas recién compradas', run: (t) => generatePlayerTextures(t) },
  { label: 'Soretes de todos los tamaños', run: generateObstacleTextures },
  { label: 'Baldosas flojas y adoquines', run: generateEnvironmentTextures },
  { label: 'Fachadas de San Telmo', run: generateFacadeTextures },
  { label: 'Árboles, faroles y autos', run: generatePropTextures },
  { label: 'Semáforos, taxis y colectivos', run: generateCrossingTextures },
  { label: 'Prendiendo las luces de la noche', run: (t) => generateEnvironmentVariants(t) },
  { label: 'Vecinos y perros', run: generateNpcTextures },
  { label: 'El portero y su escoba', run: generateNpcActorTextures },
  { label: 'Moscas y olores', run: generateEffectTextures },
  { label: 'Botones y carteles', run: generateUiTextures },
  { label: 'Monedas y estrellitas', run: generateHudTextures },
];
