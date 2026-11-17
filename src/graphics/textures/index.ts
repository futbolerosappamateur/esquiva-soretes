import Phaser from 'phaser';
import { generateEffectTextures } from './effectTextures';
import { generateEnvironmentTextures } from './environmentTextures';
import { generateFacadeTextures } from './facadeTextures';
import { generateNpcTextures } from './npcTextures';
import { generateObstacleTextures } from './obstacleTextures';
import { generatePlayerTextures } from './playerTextures';
import { generatePropTextures } from './propTextures';
import { generateUiTextures } from './uiTextures';

/**
 * Genera todos los gráficos provisionales del juego por código.
 * Para pasar a sprites definitivos: cargar imágenes con las mismas claves
 * (ver graphics/keys.ts) en BootScene y saltear el generador correspondiente.
 */
export const TEXTURE_STEPS: { label: string; run: (t: Phaser.Textures.TextureManager) => void }[] = [
  { label: 'Zapatillas recién compradas', run: (t) => generatePlayerTextures(t) },
  { label: 'Soretes de todos los tamaños', run: generateObstacleTextures },
  { label: 'Baldosas flojas y adoquines', run: generateEnvironmentTextures },
  { label: 'Fachadas de San Telmo', run: generateFacadeTextures },
  { label: 'Árboles, faroles y autos', run: generatePropTextures },
  { label: 'Vecinos y perros', run: generateNpcTextures },
  { label: 'Moscas y olores', run: generateEffectTextures },
  { label: 'Botones y carteles', run: generateUiTextures },
];
