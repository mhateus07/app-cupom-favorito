import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ChartBar, QrCode } from 'phosphor-react-native';
import { colors, radius, space, useTema } from '../theme';
import { Botao, Logo, Texto } from './ui';

const PASSOS = [
  {
    Icone: QrCode,
    titulo: 'Escaneie o QR Code do cupom',
    texto:
      'Aponte a câmera para o QR Code impresso no cupom fiscal (NFC-e). Os produtos e preços vêm direto da SEFAZ, e você confere tudo antes de salvar.',
  },
  {
    Icone: ChartBar,
    titulo: 'Descubra onde é mais barato',
    texto:
      'Comparamos os mesmos produtos entre os mercados onde você comprou e mostramos qual sai mais em conta, a evolução dos preços e a inflação da sua cesta.',
  },
  {
    Icone: Bell,
    titulo: 'Receba alertas de preço',
    texto:
      'Monitore os produtos que você mais compra, defina um preço-alvo e seja avisado quando ele cair. Seus dados ficam só no seu celular.',
  },
];

/** Apresentação do app na primeira abertura */
export const Tutorial: React.FC<{ onFim: () => void }> = ({ onFim }) => {
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const [passo, setPasso] = useState(0);
  const { Icone, titulo, texto } = PASSOS[passo];
  const ultimo = passo === PASSOS.length - 1;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: cores.background,
          paddingTop: insets.top + space.lg,
          paddingBottom: insets.bottom + space.xl,
        },
      ]}
    >
      <View style={styles.topo}>
        <Logo tamanho={28} />
        {!ultimo && (
          <Pressable accessibilityRole="button" onPress={onFim} hitSlop={12}>
            <Texto variante="label" cor={cores.textMuted}>
              Pular
            </Texto>
          </Pressable>
        )}
      </View>

      <View style={styles.conteudo}>
        <View style={styles.icone}>
          <Icone size={44} color={colors.tinta} weight="bold" />
        </View>
        <Texto variante="display" style={styles.titulo}>
          {titulo}
        </Texto>
        <Texto cor={cores.textMuted}>{texto}</Texto>
      </View>

      <View style={styles.pontos} accessibilityLabel={`Passo ${passo + 1} de ${PASSOS.length}`}>
        {PASSOS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.ponto,
              { backgroundColor: i === passo ? cores.text : cores.border },
              i === passo && styles.pontoAtivo,
            ]}
          />
        ))}
      </View>

      <Botao
        titulo={ultimo ? 'Começar' : 'Próximo'}
        onPress={ultimo ? onFim : () => setPasso(passo + 1)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: space.screen,
  },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conteudo: {
    flex: 1,
    justifyContent: 'center',
  },
  icone: {
    width: 88,
    height: 88,
    borderRadius: radius.card,
    backgroundColor: colors.lima,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    marginTop: space.xxl,
    marginBottom: space.lg,
  },
  pontos: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
    marginBottom: space.xl,
  },
  ponto: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pontoAtivo: {
    width: 24,
  },
});
