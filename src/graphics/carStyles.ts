/** Estilos de los autos estacionados (datos puros). */
export interface CarStyle {
  body: string;
  top?: string;
  small?: boolean;
  taxi?: boolean;
}

export const CAR_STYLES: CarStyle[] = [
  { body: '#c62b22' },
  { body: '#2f5a8a' },
  { body: '#e8e8e4' },
  { body: '#1f1a24', top: '#f2c23c', taxi: true },
  { body: '#7fb8d9', small: true },
  { body: '#d8c49a' },
  { body: '#e8833a', small: true },
  { body: '#3f7a4a' },
];
