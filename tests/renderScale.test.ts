import { describe, expect, it } from 'vitest';
import {
  fitScale,
  forcedScale,
  isIntegratedGpu,
  isSoftwareRenderer,
  MAX_SCALE_DESKTOP,
  MAX_SCALE_INTEGRATED,
  MAX_SCALE_TOUCH,
  MIN_ADAPTIVE_SCALE,
  pickAssetScale,
  pickRenderScale,
  scaleForFps,
  type ScaleInput,
} from '../src/graphics/renderScaleDetect';

const GPU = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)';
const INTEL = 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const base: ScaleInput = { search: '', renderer: GPU, touch: false, viewW: 1920, viewH: 1080, dpr: 1 };

describe('resolución interna', () => {
  it('dibuja con tantos píxeles como la zona de la pantalla donde se ve', () => {
    // Pantalla completa de 1920×1080: 4 píxeles por unidad (lienzo de 1920×1080).
    expect(pickRenderScale(base)).toBe(4);
    // Ventana maximizada (con la barra del navegador): el juego ocupa 1724×970.
    const maximized = pickRenderScale({ ...base, viewH: 970 });
    expect(maximized * 480).toBeCloseTo(1728, 0);
    // Notebook de 1366×768 y monitor de 2560×1440.
    expect(pickRenderScale({ ...base, viewW: 1366, viewH: 768 }) * 480).toBeCloseTo(1360, 0);
    expect(pickRenderScale({ ...base, viewW: 2560, viewH: 1440 })).toBeCloseTo(5.333, 2);
    // Pantalla con zoom del sistema (1920×1080 físicos al 125 %): cuentan los píxeles físicos.
    expect(pickRenderScale({ ...base, viewW: 1536, viewH: 864, dpr: 1.25 })).toBe(4);
  });

  it('el lienzo siempre mantiene la proporción 16:9 exacta', () => {
    for (const [w, h, dpr] of [[1000, 700, 1], [1366, 768, 1], [1707, 960, 1.5], [800, 450, 2.625]]) {
      const s = fitScale(w, h, dpr, 6);
      const cw = Math.round(480 * s);
      expect(cw % 16).toBe(0);
      expect(Math.round(270 * s)).toBe((cw / 16) * 9);
    }
  });

  it('tiene topes: nunca menos que el diseño, ni más de lo que conviene a cada equipo', () => {
    expect(pickRenderScale({ ...base, viewW: 300, viewH: 200 })).toBe(1);
    expect(pickRenderScale({ ...base, viewW: 3840, viewH: 2160 })).toBe(MAX_SCALE_DESKTOP);
    // Placa integrada (Intel): hasta 1920×1080 aunque la pantalla sea más grande.
    expect(isIntegratedGpu(INTEL)).toBe(true);
    expect(isIntegratedGpu(GPU)).toBe(false);
    expect(pickRenderScale({ ...base, renderer: INTEL })).toBe(4);
    expect(pickRenderScale({ ...base, renderer: INTEL, viewW: 2560, viewH: 1440 })).toBe(MAX_SCALE_INTEGRATED);
    expect(pickRenderScale({ ...base, renderer: INTEL, viewW: 1366, viewH: 768 }) * 480).toBeCloseTo(1360, 0);
    // Celular de 2400×1080 físicos: alcanza con 1440×810.
    expect(pickRenderScale({ ...base, touch: true, viewW: 915, viewH: 412, dpr: 2.625 })).toBe(MAX_SCALE_TOUCH);
    // El control de velocidad puede bajar el tope.
    expect(pickRenderScale({ ...base, cap: 2.5 })).toBe(2.5);
  });

  it('si el equipo no da abasto, baja de una vez lo necesario para llegar a 60 cuadros', () => {
    // A 33 cuadros con 2560×1440 (Intel Iris Xe medida): a unos 1920×1080.
    const s = scaleForFps(16 / 3, 33);
    expect(s * 480).toBeGreaterThan(1800);
    expect(s * 480).toBeLessThan(1950);
    // Nunca sube, ni baja del piso (960×540, la resolución de antes).
    expect(scaleForFps(4, 70)).toBe(4);
    expect(scaleForFps(3, 5)).toBe(MIN_ADAPTIVE_SCALE);
    // Siempre en pasos de 1/30 (lienzo 16:9 exacto).
    const k = scaleForFps(5, 40) * 30;
    expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9);
  });

  it('la original si se dibuja por software', () => {
    expect(isSoftwareRenderer(GPU)).toBe(false);
    expect(isSoftwareRenderer(INTEL)).toBe(false);
    expect(isSoftwareRenderer('Apple GPU')).toBe(false);
    expect(isSoftwareRenderer('')).toBe(false);
    for (const sw of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'Microsoft Basic Render Driver']) {
      expect(isSoftwareRenderer(sw)).toBe(true);
      expect(pickRenderScale({ ...base, renderer: sw })).toBe(1);
    }
  });

  it('se puede fijar desde la dirección', () => {
    expect(forcedScale('?scale=1')).toBe(1);
    expect(forcedScale('?debug&scale=2')).toBe(2);
    expect(forcedScale('?scale=3.5')).toBe(3.5);
    expect(forcedScale('?scale=0')).toBeNull();
    expect(forcedScale('?scale=99')).toBeNull();
    expect(forcedScale('?scale=abc')).toBeNull();
    expect(forcedScale('')).toBeNull();
    expect(pickRenderScale({ ...base, search: '?scale=2' })).toBe(2);
    expect(pickRenderScale({ ...base, search: '?scale=4', renderer: 'SwiftShader' })).toBe(4);
  });

  it('los paneles y botones se dibujan para la pantalla completa', () => {
    const a = { search: '', touch: false, screenW: 1920, screenH: 1080, viewW: 1700, viewH: 900, dpr: 1 };
    expect(pickAssetScale(a)).toBe(4);
    expect(pickAssetScale({ ...a, screenW: 1366, screenH: 768, viewW: 1366, viewH: 650 })).toBe(3);
    expect(pickAssetScale({ ...a, screenW: 2560, screenH: 1440 })).toBe(4);
    expect(pickAssetScale({ ...a, touch: true, screenW: 915, screenH: 412, dpr: 2.625 })).toBe(3);
    expect(pickAssetScale({ ...a, screenW: 800, screenH: 450, viewW: 800, viewH: 450 })).toBe(2);
    expect(pickAssetScale({ ...a, search: '?scale=1' })).toBe(1);
  });
});
