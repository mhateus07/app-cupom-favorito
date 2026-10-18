import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Linking,
  Pressable,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lightning, LightningSlash, X } from 'phosphor-react-native';
import { useScanner } from '../hooks/useScanner';
import { Botao, Texto } from './ui';
import { colors, coresScanner as cores, radius, space } from '../theme';

interface ScannerProps {
  onScan: (data: string, type: string) => void;
  onClose?: () => void;
  /** Para de ler QR Codes (ex.: enquanto um cupom está sendo processado) */
  pausado?: boolean;
  /** Conteúdo exibido na parte de baixo, sobre a câmera */
  rodape?: React.ReactNode;
}

const TAMANHO_MOLDURA = 260;
const CANTO = 48;

/** Moldura de leitura: só os quatro cantos, em lima */
const Moldura: React.FC<{ ativa: boolean }> = ({ ativa }) => {
  const posicao = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ativa) return;
    const animacao = Animated.loop(
      Animated.sequence([
        Animated.timing(posicao, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(posicao, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    animacao.start();
    return () => animacao.stop();
  }, [ativa, posicao]);

  const translateY = posicao.interpolate({
    inputRange: [0, 1],
    outputRange: [space.xxl, TAMANHO_MOLDURA - space.xxl],
  });

  return (
    <View style={styles.moldura}>
      <View style={[styles.canto, styles.cantoSupEsq]} />
      <View style={[styles.canto, styles.cantoSupDir]} />
      <View style={[styles.canto, styles.cantoInfEsq]} />
      <View style={[styles.canto, styles.cantoInfDir]} />
      {ativa && <Animated.View style={[styles.linhaLeitura, { transform: [{ translateY }] }]} />}
    </View>
  );
};

const BotaoTopo: React.FC<{ rotulo: string; onPress: () => void; children: React.ReactNode }> = ({
  rotulo,
  onPress,
  children,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={rotulo}
    onPress={onPress}
    style={({ pressed }) => [styles.botaoTopo, pressed && { opacity: 0.7 }]}
  >
    {children}
  </Pressable>
);

export const Scanner: React.FC<ScannerProps> = ({ onScan, onClose, pausado = false, rodape }) => {
  const insets = useSafeAreaInsets();
  const [lanterna, setLanterna] = useState(false);
  const { hasPermission, canAskAgain, requestPermission, handleBarcodeScanned, resetScanner } =
    useScanner(onScan);

  // Ao sair da pausa, libera uma nova leitura
  useEffect(() => {
    if (!pausado) resetScanner();
  }, [pausado, resetScanner]);

  const topo = (
    <View style={[styles.topo, { paddingTop: insets.top + space.sm }]}>
      {onClose ? (
        <BotaoTopo rotulo="Fechar" onPress={onClose}>
          <X size={22} color={cores.text} />
        </BotaoTopo>
      ) : (
        <View style={styles.botaoTopoEspaco} />
      )}
      <Texto variante="label" cor={cores.textMuted}>
        Escanear NFC-e
      </Texto>
      {hasPermission ? (
        <BotaoTopo
          rotulo={lanterna ? 'Desligar lanterna' : 'Ligar lanterna'}
          onPress={() => setLanterna(l => !l)}
        >
          {lanterna ? (
            <LightningSlash size={22} color={cores.text} />
          ) : (
            <Lightning size={22} color={cores.text} />
          )}
        </BotaoTopo>
      ) : (
        <View style={styles.botaoTopoEspaco} />
      )}
    </View>
  );

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        {topo}
        <View style={styles.centro}>
          <ActivityIndicator color={cores.text} />
        </View>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        {topo}
        <View style={styles.permissao}>
          <Texto variante="title" cor={cores.text}>
            Precisamos da câmera
          </Texto>
          <Texto cor={cores.textMuted} style={styles.permissaoTexto}>
            Ela é usada só para ler o QR Code do cupom fiscal. Nenhuma imagem é guardada.
          </Texto>
          {canAskAgain ? (
            <Botao titulo="Permitir câmera" onPress={requestPermission} />
          ) : (
            <Botao titulo="Abrir configurações" onPress={() => Linking.openSettings()} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={lanterna}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={pausado ? undefined : handleBarcodeScanned}
      />
      <View style={styles.escurecer} pointerEvents="none" />

      {topo}

      <View style={styles.centro} pointerEvents="none">
        <Moldura ativa={!pausado} />
        <Texto cor={cores.text} style={styles.instrucao}>
          Aponte para o QR Code no rodapé do cupom
        </Texto>
      </View>

      {rodape && (
        <View style={[styles.rodape, { paddingBottom: insets.bottom + space.lg }]}>{rodape}</View>
      )}
    </View>
  );
};

const espessura = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.tinta,
  },
  escurecer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 20, 18, 0.35)',
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.screen,
  },
  botaoTopo: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    backgroundColor: cores.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoTopoEspaco: {
    width: 44,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moldura: {
    width: TAMANHO_MOLDURA,
    height: TAMANHO_MOLDURA,
  },
  canto: {
    position: 'absolute',
    width: CANTO,
    height: CANTO,
    borderColor: colors.lima,
  },
  cantoSupEsq: {
    top: 0,
    left: 0,
    borderTopWidth: espessura,
    borderLeftWidth: espessura,
    borderTopLeftRadius: radius.button,
  },
  cantoSupDir: {
    top: 0,
    right: 0,
    borderTopWidth: espessura,
    borderRightWidth: espessura,
    borderTopRightRadius: radius.button,
  },
  cantoInfEsq: {
    bottom: 0,
    left: 0,
    borderBottomWidth: espessura,
    borderLeftWidth: espessura,
    borderBottomLeftRadius: radius.button,
  },
  cantoInfDir: {
    bottom: 0,
    right: 0,
    borderBottomWidth: espessura,
    borderRightWidth: espessura,
    borderBottomRightRadius: radius.button,
  },
  linhaLeitura: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    height: 2,
    backgroundColor: colors.lima,
  },
  instrucao: {
    marginTop: space.xxl,
    textAlign: 'center',
    paddingHorizontal: space.xxxl,
  },
  permissao: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.screen,
  },
  permissaoTexto: {
    marginTop: space.sm,
    marginBottom: space.xl,
  },
  rodape: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: 0,
  },
});
