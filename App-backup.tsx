import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, Text, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider, Button, Card } from 'react-native-paper';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initDatabase } from './src/services/database/database';

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
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
    } finally {
      setIsReady(true);
    }
  };

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  // Se estiver na web, mostrar mensagem
  if (Platform.OS === 'web') {
    return (
      <PaperProvider>
        <View style={styles.webContainer}>
          <Card style={styles.card}>
            <Card.Title title="📱 App Cupom Favorito" />
            <Card.Content>
              <Text style={styles.title}>Este app precisa ser usado no celular!</Text>

              <Text style={styles.subtitle}>
                O App Cupom Favorito usa a câmera do celular para escanear QR Codes de cupons fiscais.
              </Text>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🚀 Como usar:</Text>
                <Text style={styles.item}>1. Instale o app "Expo Go" no seu celular</Text>
                <Text style={styles.item}>2. Abra um terminal e execute:</Text>
                <Text style={styles.code}>   npx expo start</Text>
                <Text style={styles.item}>3. Escaneie o QR Code que aparecer</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📦 Funcionalidades:</Text>
                <Text style={styles.item}>• Escanear cupons fiscais (NFCe)</Text>
                <Text style={styles.item}>• Histórico de compras</Text>
                <Text style={styles.item}>• Análise de preços por mercado</Text>
                <Text style={styles.item}>• Recomendação de onde comprar</Text>
                <Text style={styles.item}>• Estatísticas de gastos e descontos</Text>
              </View>

              <Button
                mode="contained"
                icon="download"
                onPress={() => Linking.openURL('https://expo.dev/go')}
                style={styles.button}
              >
                Baixar Expo Go
              </Button>
            </Card.Content>
          </Card>
          <StatusBar style="auto" />
        </View>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    maxWidth: 600,
    width: '100%',
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  section: {
    marginVertical: 15,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  item: {
    fontSize: 14,
    marginBottom: 8,
    color: '#555',
  },
  code: {
    fontSize: 14,
    fontFamily: 'monospace',
    backgroundColor: '#e0e0e0',
    padding: 10,
    marginVertical: 8,
    borderRadius: 4,
    color: '#333',
  },
  button: {
    marginTop: 20,
  },
});
