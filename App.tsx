import 'react-native-gesture-handler';
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
} from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initDatabase } from './src/services/database/database';
import { Botao, Card, Logo, Texto } from './src/components/ui';
import { TemaProvider, space, useTema } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Sem splash nativo (ex.: web)
});

const Mensagem: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { cores } = useTema();
  return (
    <View style={[styles.mensagem, { backgroundColor: cores.background }]}>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
};

const Conteudo: React.FC = () => {
  const { cores } = useTema();
  const [isReady, setIsReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [fontesCarregadas, erroFontes] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });

  const initializeApp = useCallback(async () => {
    try {
      // Inicializar banco de dados apenas em plataformas mobile
      if (Platform.OS !== 'web') {
        await initDatabase();
        console.log('App inicializado com sucesso');
      } else {
        console.log('Modo web - banco de dados não inicializado');
      }
    } catch (error) {
      console.error('Erro ao inicializar app:', error);
      setDbError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // Se as fontes falharem, o app segue com as fontes do sistema
  const fontesProntas = fontesCarregadas || erroFontes !== null;

  useEffect(() => {
    if (isReady && fontesProntas) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady, fontesProntas]);

  if (!isReady || !fontesProntas) {
    return <View style={{ flex: 1, backgroundColor: cores.background }} />;
  }

  if (dbError) {
    return (
      <Mensagem>
        <Texto variante="subtitle">Não foi possível abrir os seus dados</Texto>
        <Texto cor={cores.textMuted} style={styles.paragrafo}>
          {dbError}
        </Texto>
        <Botao
          titulo="Tentar novamente"
          variante="secundario"
          onPress={() => {
            setDbError(null);
            setIsReady(false);
            initializeApp();
          }}
        />
      </Mensagem>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <Mensagem>
        <Logo />
        <Texto variante="title" style={styles.titulo}>
          Seu cupom sabe onde é mais barato.
        </Texto>
        <Texto cor={cores.textMuted} style={styles.paragrafo}>
          O cupom favorito usa a câmera do celular para ler o QR Code dos cupons fiscais (NFC-e).
          Para usar, instale o Expo Go no celular, rode{' '}
          <Texto variante="numberSmall">npx expo start</Texto> no terminal e escaneie o QR Code que
          aparecer.
        </Texto>
        <Botao titulo="Baixar Expo Go" onPress={() => Linking.openURL('https://expo.dev/go')} />
      </Mensagem>
    );
  }

  return <AppNavigator />;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <Conteudo />
        <StatusBar style="auto" />
      </TemaProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  mensagem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.screen,
  },
  card: {
    maxWidth: 560,
    width: '100%',
    gap: space.md,
  },
  titulo: {
    marginTop: space.lg,
  },
  paragrafo: {
    marginBottom: space.md,
  },
});
