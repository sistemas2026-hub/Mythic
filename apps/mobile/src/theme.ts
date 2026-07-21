import { Platform } from 'react-native';

/** Tokens de diseño — estética minimalista editorial (skill minimalist-ui). */
export const colors = {
  canvas: '#F7F6F3',
  surface: '#FFFFFF',
  surface2: '#F9F9F8',
  ink: '#111111',
  inkSoft: '#2F3437',
  muted: '#787774',
  border: '#EAEAEA',
  amberBg: '#FBF3DB',
  amberInk: '#956400',
  greenBg: '#EDF3EC',
  greenInk: '#346538',
  redBg: '#FDEBEC',
  redInk: '#9F2F2D',
  blueBg: '#E1F3FE',
  blueInk: '#1F6C9F',
} as const;

export const fonts = {
  // Serif editorial para titulares (Georgia en iOS, serif del sistema en Android).
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  pill: 9999,
} as const;
