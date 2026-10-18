import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../theme';

const TAMANHO = 132;
const ESCALA = TAMANHO / 100; // O símbolo é desenhado num viewBox de 100×100

/** Módulos da grade 2×2, nas coordenadas do símbolo (brand/svg/simbolo-*.svg) */
const MODULOS = [
  { x: 28.5, y: 24, cor: colors.tinta },
  { x: 52.5, y: 24, cor: colors.tinta },
  { x: 28.5, y: 48, cor: colors.tinta },
  { x: 52.5, y: 48, cor: colors.lima }, // o "favorito": acende por último
];

interface AberturaAnimadaProps {
  onFim: () => void;
}

/**
 * Abertura do app sobre fundo Tinta (o mesmo do splash nativo):
 * o cupom sobe, os módulos da grade surgem um a um, o módulo lima acende
 * e o nome entra. Toque para pular.
 */
export const AberturaAnimada: React.FC<AberturaAnimadaProps> = ({ onFim }) => {
  const cupom = useRef(new Animated.Value(0)).current;
  const modulos = useRef(MODULOS.map(() => new Animated.Value(0))).current;
  const nome = useRef(new Animated.Value(0)).current;
  const saida = useRef(new Animated.Value(1)).current;
  const terminou = useRef(false);

  const finalizar = () => {
    if (terminou.current) return;
    terminou.current = true;
    Animated.timing(saida, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => onFim());
  };

  useEffect(() => {
    let animacao: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduzirMovimento => {
        if (reduzirMovimento) {
          // Sem movimento: mostra a marca pronta e sai
          [cupom, nome, ...modulos].forEach(v => v.setValue(1));
          animacao = Animated.delay(600);
        } else {
          const aparecer = (valor: Animated.Value, duracao: number) =>
            Animated.timing(valor, {
              toValue: 1,
              duration: duracao,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            });

          animacao = Animated.sequence([
            // 1. O cupom sobe
            aparecer(cupom, 420),
            // 2. Os três módulos escuros, um a um
            Animated.stagger(
              110,
              modulos.slice(0, 3).map(m => aparecer(m, 220))
            ),
            // 3. O módulo lima acende, com um leve "pulo", e 4. o nome entra logo em seguida
            Animated.parallel([
              Animated.timing(modulos[3], {
                toValue: 1,
                duration: 380,
                easing: Easing.out(Easing.back(2.4)),
                useNativeDriver: true,
              }),
              Animated.sequence([Animated.delay(180), aparecer(nome, 380)]),
            ]),
            Animated.delay(450),
          ]);
        }

        animacao.start(({ finished }) => {
          if (finished) finalizar();
        });
      });

    return () => animacao?.stop();
    // A animação roda uma única vez, na montagem
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: saida }]}>
      <StatusBar style="light" />
      <Pressable
        style={styles.toque}
        onPress={finalizar}
        accessibilityRole="button"
        accessibilityLabel="cupom favorito. Toque para entrar"
      >
        <Animated.View
          style={{
            opacity: cupom,
            transform: [
              { translateY: cupom.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            ],
          }}
        >
          <View style={styles.simbolo}>
            <Svg width={TAMANHO} height={TAMANHO} viewBox="0 0 100 100">
              <Path
                d="M28 8 H72 A10 10 0 0 1 82 18 V86 L74 94 L66 86 L58 94 L50 86 L42 94 L34 86 L26 94 L18 86 V18 A10 10 0 0 1 28 8 Z"
                fill={colors.papel}
              />
            </Svg>
            {MODULOS.map((modulo, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.modulo,
                  {
                    left: modulo.x * ESCALA,
                    top: modulo.y * ESCALA,
                    backgroundColor: modulo.cor,
                    opacity: modulos[i],
                    transform: [
                      {
                        scale: modulos[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>

        <Animated.Text
          style={[
            styles.nome,
            {
              opacity: nome,
              transform: [
                { translateY: nome.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              ],
            },
          ]}
        >
          cupom favorito
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.tinta,
    zIndex: 10,
  },
  toque: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simbolo: {
    width: TAMANHO,
    height: TAMANHO,
  },
  modulo: {
    position: 'absolute',
    width: 19 * ESCALA,
    height: 19 * ESCALA,
    borderRadius: 3 * ESCALA,
  },
  nome: {
    marginTop: 28,
    fontFamily: fonts.semibold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.9,
    color: colors.papel,
  },
});
