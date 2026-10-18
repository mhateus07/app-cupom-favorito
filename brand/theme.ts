/**
 * Cupom Favorito — tokens da identidade visual (v1.0)
 * Fontes: Geist (interface) e Geist Mono (preços, números, rótulos).
 *   npx expo install @expo-google-fonts/geist @expo-google-fonts/geist-mono expo-font
 */

export const colors = {
  tinta: '#0F1412', // fundo dark, texto principal, símbolo
  grafite: '#1D2421', // cards no modo escuro
  papel: '#F3F1EA', // fundo claro (tom da bobina térmica)
  bobina: '#E7E3D8', // linhas e divisórias
  borda: '#DCD8CC',
  nevoa: '#5E6661', // texto secundário sobre claro
  nevoaEscuro: '#9AA39D', // texto secundário sobre tinta
  branco: '#FFFFFF', // superfície de card no claro
  lima: '#C8F031', // economia, melhor opção, ação principal (fundo, nunca texto sobre claro)
  limaTexto: '#4A6B00', // economia como texto sobre claro
  brasa: '#FF5B2E', // preço subiu, mais caro, alerta (fundo/indicador)
  brasaTexto: '#C23A12', // alta como texto sobre claro
} as const;

export const lightTheme = {
  background: colors.papel,
  surface: colors.branco,
  text: colors.tinta,
  textMuted: colors.nevoa,
  border: colors.bobina,
  primary: colors.tinta,
  accent: colors.lima,
  onAccent: colors.tinta,
  saving: colors.limaTexto,
  danger: colors.brasaTexto,
};

export const darkTheme = {
  background: colors.tinta,
  surface: colors.grafite,
  text: colors.papel,
  textMuted: colors.nevoaEscuro,
  border: '#2B3430',
  primary: colors.papel,
  accent: colors.lima,
  onAccent: colors.tinta,
  saving: colors.lima,
  danger: '#FF7A55',
};

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
};

/** Escala tipográfica (tamanho / altura de linha / tracking em px) */
export const type = {
  display: { fontFamily: fonts.semibold, fontSize: 40, lineHeight: 44, letterSpacing: -1.6 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  number: { fontFamily: fonts.monoMedium, fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
  label: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' as const },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, screen: 20 };
export const radius = { tag: 6, button: 14, card: 20, sheet: 22 };
/** Sem sombras: separação por linha de 1px (colors.bobina / borda). */
