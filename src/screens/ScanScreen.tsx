import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { Scanner } from '../components/Scanner';
import { parseQRCode, parseNFCeXML } from '../services/parser/cupomParser';
import { insertCupom } from '../services/database/database';
import { CupomData } from '../models/types';

interface ScanScreenProps {
  navigation: any;
}

export const ScanScreen: React.FC<ScanScreenProps> = ({ navigation }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleScan = async (data: string, type: string) => {
    setIsProcessing(true);

    try {
      console.log('QR Code escaneado:', data);

      // Parse QR Code
      const parsedQR = parseQRCode(data);

      if (!parsedQR.isValid) {
        Alert.alert(
          'QR Code Inválido',
          'Este não parece ser um QR Code de cupom fiscal válido. Por favor, tente novamente.'
        );
        setIsProcessing(false);
        return;
      }

      // Parse NFCe e obter dados do cupom
      const cupomData = await parseNFCeXML(parsedQR.chaveAcesso, parsedQR.url);

      if (!cupomData) {
        Alert.alert('Erro', 'Não foi possível processar os dados do cupom fiscal.');
        setIsProcessing(false);
        return;
      }

      // Salvar no banco de dados
      const cupomId = await insertCupom(cupomData);

      // Navegar para tela de detalhes
      Alert.alert('Sucesso!', 'Cupom salvo com sucesso!', [
        {
          text: 'Ver Detalhes',
          onPress: () => navigation.navigate('CupomDetail', { cupomId }),
        },
        {
          text: 'Escanear Outro',
          onPress: () => setIsProcessing(false),
        },
      ]);
    } catch (error: any) {
      console.error('Erro ao processar cupom:', error);

      // Verificar se é erro de duplicação
      if (error.message?.includes('UNIQUE constraint failed')) {
        Alert.alert(
          'Cupom Já Existe',
          'Este cupom já foi escaneado anteriormente.',
          [
            {
              text: 'OK',
              onPress: () => setIsProcessing(false),
            },
          ]
        );
      } else {
        Alert.alert('Erro', 'Ocorreu um erro ao processar o cupom. Tente novamente.');
      }

      setIsProcessing(false);
    }
  };

  if (isProcessing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Processando cupom...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Scanner onScan={handleScan} onClose={() => navigation.goBack()} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
  },
});
