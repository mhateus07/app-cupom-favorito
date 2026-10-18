import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Scanner } from '../components/Scanner';
import { Texto } from '../components/ui';
import {
  CupomIndisponivelError,
  obterDadosCupom,
  parseQRCode,
} from '../services/parser/cupomParser';
import { cupomExiste } from '../services/database/database';
import { RootScreenProps } from '../navigation/types';
import { colors, radius, space } from '../theme';
import { formatarChaveAcesso } from '../utils/formatacao';

/** Barra de progresso indeterminada (a consulta à SEFAZ não informa andamento) */
const Progresso: React.FC = () => {
  const avanco = useRef(new Animated.Value(0)).current;
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const animacao = Animated.loop(
      Animated.timing(avanco, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    animacao.start();
    return () => animacao.stop();
  }, [avanco]);

  const translateX = avanco.interpolate({
    inputRange: [0, 1],
    outputRange: [-largura * 0.4, largura],
  });

  return (
    <View style={styles.trilho} onLayout={e => setLargura(e.nativeEvent.layout.width)}>
      <Animated.View
        style={[styles.progresso, { width: largura * 0.4, transform: [{ translateX }] }]}
      />
    </View>
  );
};

export const ScanScreen: React.FC<RootScreenProps<'Scan'>> = ({ navigation }) => {
  const [chaveLida, setChaveLida] = useState<string | null>(null);
  const consultaRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => consultaRef.current?.abort();
  }, []);

  // A câmera fica pausada até o usuário fechar o alerta, para não ler o mesmo QR Code de novo
  const alertarEContinuar = (titulo: string, mensagem: string) => {
    Alert.alert(titulo, mensagem, [{ text: 'OK', onPress: () => setChaveLida(null) }], {
      cancelable: false,
    });
  };

  const handleScan = useCallback(
    async (data: string) => {
      const parsedQR = parseQRCode(data);

      if (!parsedQR.isValid) {
        setChaveLida('');
        alertarEContinuar(
          'QR Code inválido',
          'Este não parece ser o QR Code de um cupom fiscal (NFC-e). Tente novamente.'
        );
        return;
      }

      setChaveLida(parsedQR.chaveAcesso);
      const controller = new AbortController();
      consultaRef.current = controller;

      try {
        if (await cupomExiste(parsedQR.chaveAcesso)) {
          alertarEContinuar('Cupom já existe', 'Este cupom já foi escaneado anteriormente.');
          return;
        }

        const cupomData = await obterDadosCupom(parsedQR.chaveAcesso, parsedQR.url, {
          signal: controller.signal,
        });

        // O usuário confere (e corrige, se precisar) antes de salvar
        navigation.replace('RevisarCupom', { cupom: cupomData });
      } catch (error) {
        console.error('Erro ao processar cupom:', error);

        if (controller.signal.aborted) return;

        if (error instanceof CupomIndisponivelError) {
          alertarEContinuar('Não foi possível ler o cupom', error.message);
        } else {
          alertarEContinuar('Erro', 'Ocorreu um erro ao processar o cupom. Tente novamente.');
        }
      } finally {
        if (consultaRef.current === controller) consultaRef.current = null;
      }
    },
    [navigation]
  );

  const processando = chaveLida !== null;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Scanner
        onScan={handleScan}
        onClose={() => navigation.goBack()}
        pausado={processando}
        rodape={
          chaveLida ? (
            <View style={styles.painel}>
              <View style={styles.painelTitulo}>
                <View style={styles.marcador} />
                <Texto forte cor={colors.tinta}>
                  QR lido · consultando a SEFAZ
                </Texto>
              </View>
              <Texto variante="label" cor={colors.nevoa} style={styles.rotulo}>
                Chave de acesso
              </Texto>
              <Texto variante="numberSmall" cor={colors.tinta}>
                {formatarChaveAcesso(chaveLida)}
              </Texto>
              <Progresso />
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.tinta,
  },
  painel: {
    backgroundColor: colors.papel,
    borderRadius: radius.sheet,
    padding: space.xl,
  },
  painelTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  marcador: {
    width: 14,
    height: 14,
    backgroundColor: colors.lima,
    borderWidth: 1.5,
    borderColor: colors.tinta,
  },
  rotulo: {
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  trilho: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bobina,
    marginTop: space.lg,
    overflow: 'hidden',
  },
  progresso: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.tinta,
  },
});
