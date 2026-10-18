import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartBar, Receipt, Scan } from 'phosphor-react-native';
import { Texto } from '../components/ui';
import { colors, fonts, space, useTema } from '../theme';

export const ALTURA_TAB_BAR = 68;

/** Espaço que o conteúdo das abas deve reservar embaixo para não ficar sob a barra */
export const useEspacoTabBar = (): number => {
  const insets = useSafeAreaInsets();
  return ALTURA_TAB_BAR + Math.max(insets.bottom, space.lg) + space.xl;
};

const ICONES = { Cupons: Receipt, Analises: ChartBar } as const;
const ROTULOS = { Cupons: 'Cupons', Analises: 'Análises' } as const;

/**
 * Barra de abas flutuante, escura, com a ação principal (escanear) em lima no centro
 */
export const TabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const { cores } = useTema();
  const insets = useSafeAreaInsets();

  const renderAba = (index: number) => {
    const rota = state.routes[index];
    const nome = rota.name as keyof typeof ICONES;
    const Icone = ICONES[nome];
    const ativa = state.index === index;
    const cor = ativa ? cores.onInverse : cores.onInverseMuted;

    return (
      <Pressable
        key={rota.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: ativa }}
        accessibilityLabel={ROTULOS[nome]}
        style={styles.aba}
        onPress={() => {
          const evento = navigation.emit({
            type: 'tabPress',
            target: rota.key,
            canPreventDefault: true,
          });
          if (!ativa && !evento.defaultPrevented) {
            navigation.navigate(rota.name);
          }
        }}
      >
        <Icone size={24} color={cor} weight={ativa ? 'bold' : 'regular'} />
        <Texto variante="small" cor={cor} style={ativa && { fontFamily: fonts.medium }}>
          {ROTULOS[nome]}
        </Texto>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.barra,
        { backgroundColor: cores.inverse, bottom: Math.max(insets.bottom, space.lg) },
      ]}
    >
      {renderAba(0)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Escanear cupom"
        onPress={() => navigation.getParent()?.navigate('Scan')}
        style={({ pressed }) => [styles.escanear, pressed && { opacity: 0.85 }]}
      >
        <Scan size={28} color={colors.tinta} weight="bold" />
      </Pressable>
      {renderAba(1)}
    </View>
  );
};

const styles = StyleSheet.create({
  barra: {
    position: 'absolute',
    left: space.screen,
    right: space.screen,
    height: ALTURA_TAB_BAR,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  escanear: {
    width: 64,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.lima,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
