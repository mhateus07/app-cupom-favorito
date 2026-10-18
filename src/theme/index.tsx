import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors, darkTheme, fonts, lightTheme, radius, space, type } from '../../brand/theme';

export { colors, fonts, radius, space, type };

/**
 * Cores semânticas do app. Os valores base vêm de brand/theme.ts (identidade visual);
 * aqui só completamos o que a interface precisa e o manual define por uso.
 */
export interface Cores {
  background: string;
  surface: string;
  /** Fundo de blocos secundários dentro de um card (ex.: iniciais do mercado) */
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  /** Botão secundário (Tinta no claro, Papel no escuro) */
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  /** Economia como texto (nunca lima sobre fundo claro) */
  saving: string;
  /** Alta de preço como texto */
  danger: string;
  /** Alta de preço como fundo/indicador */
  dangerFill: string;
  /** Bloco de destaque escuro (resumo do mês, barra de abas) */
  inverse: string;
  onInverse: string;
  onInverseMuted: string;
}

const claro: Cores = {
  ...lightTheme,
  surfaceMuted: colors.papel,
  onPrimary: colors.papel,
  dangerFill: colors.brasa,
  inverse: colors.tinta,
  onInverse: colors.papel,
  onInverseMuted: colors.nevoaEscuro,
};

const escuro: Cores = {
  ...darkTheme,
  surfaceMuted: colors.tinta,
  onPrimary: colors.tinta,
  dangerFill: colors.brasa,
  inverse: colors.grafite,
  onInverse: colors.papel,
  onInverseMuted: colors.nevoaEscuro,
};

interface Tema {
  cores: Cores;
  escuro: boolean;
}

const TemaContext = createContext<Tema>({ cores: claro, escuro: false });

export const TemaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const esquema = useColorScheme();
  const valor = useMemo(
    () => ({ cores: esquema === 'dark' ? escuro : claro, escuro: esquema === 'dark' }),
    [esquema]
  );
  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
};

export const useTema = (): Tema => useContext(TemaContext);

/** Cores fixas da tela de escaneamento, que é sempre escura */
export const coresScanner = escuro;
