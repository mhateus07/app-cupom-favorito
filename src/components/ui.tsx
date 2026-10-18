import React, { useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path, Polygon, Rect } from 'react-native-svg';
import { colors, fonts, radius, space, type, useTema } from '../theme';

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

const variantesTexto = {
  ...type,
  /** Título de seção/card */
  subtitle: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.3 },
  /** Texto de apoio */
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  /** Número grande (totais) */
  numberLarge: { fontFamily: fonts.monoMedium, fontSize: 36, lineHeight: 42, letterSpacing: -1.4 },
  /** Número pequeno (valores em listas) */
  numberSmall: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 18, letterSpacing: -0.2 },
  /** Linha de item do cupom, como na bobina */
  receipt: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
};

export type VarianteTexto = keyof typeof variantesTexto;

interface TextoProps extends TextProps {
  variante?: VarianteTexto;
  cor?: string;
  /** Peso semibold para o corpo de texto */
  forte?: boolean;
  style?: StyleProp<TextStyle>;
}

export const Texto: React.FC<TextoProps> = ({ variante = 'body', cor, forte, style, ...props }) => {
  const { cores } = useTema();
  return (
    <Text
      {...props}
      style={[
        variantesTexto[variante],
        { color: cor ?? cores.text },
        forte && { fontFamily: fonts.semibold },
        style,
      ]}
    />
  );
};

// ---------------------------------------------------------------------------
// Botão (altura 52, raio 14)
// ---------------------------------------------------------------------------

interface BotaoProps {
  titulo: string;
  onPress: () => void;
  variante?: 'principal' | 'secundario' | 'contorno';
  icone?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Para botões sobre fundo escuro fixo (ex.: tela do scanner) */
  sobreEscuro?: boolean;
}

export const Botao: React.FC<BotaoProps> = ({
  titulo,
  onPress,
  variante = 'principal',
  icone,
  style,
  sobreEscuro,
}) => {
  const { cores } = useTema();

  const fundo = {
    principal: colors.lima,
    secundario: sobreEscuro ? colors.papel : cores.primary,
    contorno: 'transparent',
  }[variante];
  const texto = {
    principal: colors.tinta,
    secundario: sobreEscuro ? colors.tinta : cores.onPrimary,
    contorno: sobreEscuro ? colors.papel : cores.text,
  }[variante];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.botao,
        { backgroundColor: fundo, opacity: pressed ? 0.85 : 1 },
        variante === 'contorno' && {
          borderWidth: 1.5,
          borderColor: sobreEscuro ? colors.papel : cores.text,
        },
        style,
      ]}
    >
      {icone}
      <Texto variante="body" cor={texto} style={styles.botaoTexto}>
        {titulo}
      </Texto>
    </Pressable>
  );
};

interface CampoTextoProps extends TextInputProps {
  rotulo?: string;
}

export const CampoTexto: React.FC<CampoTextoProps> = ({ rotulo, style, ...props }) => {
  const { cores } = useTema();
  return (
    <View style={styles.campoTextoContainer}>
      {rotulo && (
        <Texto variante="label" cor={cores.textMuted}>
          {rotulo}
        </Texto>
      )}
      <TextInput
        {...props}
        placeholderTextColor={props.placeholderTextColor ?? cores.textMuted}
        style={[
          styles.campoTexto,
          { color: cores.text, backgroundColor: cores.surface, borderColor: cores.border },
          style,
        ]}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Selo de preço (raio 6, Geist Mono)
// ---------------------------------------------------------------------------

interface SeloProps {
  texto: string;
  variante?: 'economia' | 'alta' | 'destaque' | 'neutro';
  tamanho?: 'normal' | 'grande';
}

export const Selo: React.FC<SeloProps> = ({ texto, variante = 'neutro', tamanho = 'normal' }) => {
  const { cores, escuro } = useTema();
  const fundo = {
    economia: colors.lima,
    alta: colors.brasa,
    destaque: colors.tinta,
    neutro: escuro ? cores.border : colors.bobina,
  }[variante];
  const cor = {
    economia: colors.tinta,
    alta: colors.tinta,
    destaque: colors.lima,
    neutro: cores.text,
  }[variante];

  return (
    <View
      style={[styles.selo, { backgroundColor: fundo }, tamanho === 'grande' && styles.seloGrande]}
    >
      <Texto variante={tamanho === 'grande' ? 'number' : 'numberSmall'} cor={cor}>
        {texto}
      </Texto>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Card: sem sombra, separação por linha de 1px (raio 20)
// ---------------------------------------------------------------------------

export const Card: React.FC<ViewProps> = ({ style, ...props }) => {
  const { cores } = useTema();
  return (
    <View
      {...props}
      style={[styles.card, { backgroundColor: cores.surface, borderColor: cores.border }, style]}
    />
  );
};

// ---------------------------------------------------------------------------
// Linha tracejada (divisória de cupom)
// ---------------------------------------------------------------------------

export const LinhaTracejada: React.FC<{ cor?: string; style?: StyleProp<ViewStyle> }> = ({
  cor,
  style,
}) => {
  const { cores } = useTema();
  return (
    <Svg height={1} width="100%" style={style}>
      <Line
        x1="0"
        y1="0.5"
        x2="100%"
        y2="0.5"
        stroke={cor ?? cores.textMuted}
        strokeOpacity={cor ? 1 : 0.5}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
    </Svg>
  );
};

// ---------------------------------------------------------------------------
// Serrilha: o recorte da bobina térmica. Só em cupons e totais.
// ---------------------------------------------------------------------------

const DENTE = 14;

export const Serrilha: React.FC<{ cor: string }> = ({ cor }) => {
  const [largura, setLargura] = useState(0);
  const dentes = Math.max(1, Math.round(largura / DENTE));
  const passo = largura / dentes;
  const altura = DENTE / 2;

  const pontos = [`0,0`];
  for (let i = 0; i < dentes; i++) {
    pontos.push(`${i * passo + passo / 2},${altura}`, `${(i + 1) * passo},0`);
  }

  return (
    <View onLayout={e => setLargura(e.nativeEvent.layout.width)} style={{ height: altura }}>
      {largura > 0 && (
        <Svg width={largura} height={altura}>
          <Polygon points={pontos.join(' ')} fill={cor} />
        </Svg>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Fundo da barra de status: evita que o conteúdo rolado apareça atrás do relógio
// ---------------------------------------------------------------------------

export const FundoStatusBar: React.FC = () => {
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={[styles.fundoStatusBar, { height: insets.top, backgroundColor: cores.background }]}
    />
  );
};

// ---------------------------------------------------------------------------
// Símbolo da marca (cupom + grade 2×2 com um módulo em lima)
// ---------------------------------------------------------------------------

interface SimboloProps {
  tamanho?: number;
  /** "tinta" para fundos claros, "papel" para fundos escuros */
  variante?: 'tinta' | 'papel';
}

export const Simbolo: React.FC<SimboloProps> = ({ tamanho = 32, variante = 'tinta' }) => {
  const corpo = variante === 'tinta' ? colors.tinta : colors.papel;
  const modulo = variante === 'tinta' ? colors.papel : colors.tinta;
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 100 100">
      <Path
        d="M28 8 H72 A10 10 0 0 1 82 18 V86 L74 94 L66 86 L58 94 L50 86 L42 94 L34 86 L26 94 L18 86 V18 A10 10 0 0 1 28 8 Z"
        fill={corpo}
      />
      <Rect x="28.5" y="24" width="19" height="19" rx="3" fill={modulo} />
      <Rect x="52.5" y="24" width="19" height="19" rx="3" fill={modulo} />
      <Rect x="28.5" y="48" width="19" height="19" rx="3" fill={modulo} />
      <Rect x="52.5" y="48" width="19" height="19" rx="3" fill={colors.lima} />
    </Svg>
  );
};

/** Assinatura horizontal: símbolo + "cupom favorito" (sempre em minúsculas) */
export const Logo: React.FC<{ tamanho?: number }> = ({ tamanho = 34 }) => {
  const { cores, escuro } = useTema();
  return (
    <View style={styles.logo}>
      <Simbolo tamanho={tamanho} variante={escuro ? 'papel' : 'tinta'} />
      <Texto
        cor={cores.text}
        style={{
          fontFamily: fonts.semibold,
          fontSize: tamanho * 0.68,
          lineHeight: tamanho,
          letterSpacing: -tamanho * 0.03,
        }}
      >
        cupom favorito
      </Texto>
    </View>
  );
};

const styles = StyleSheet.create({
  botao: {
    height: 52,
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  botaoTexto: {
    fontFamily: fonts.semibold,
  },
  selo: {
    alignSelf: 'flex-start',
    borderRadius: radius.tag,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  seloGrande: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.xl,
  },
  fundoStatusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  campoTextoContainer: {
    gap: space.xs,
  },
  campoTexto: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
});
