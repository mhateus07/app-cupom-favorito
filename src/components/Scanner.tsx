import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Button } from 'react-native-paper';
// NOTA: Câmera desabilitada porque não funciona no Expo Go
// Para usar câmera real, você precisa criar um Development Build
// import { BarCodeScanner } from 'expo-barcode-scanner';
// import { useScanner } from '../hooks/useScanner';

interface ScannerProps {
  onScan: (data: string, type: string) => void;
  onClose?: () => void;
}

const { width, height } = Dimensions.get('window');

export const Scanner: React.FC<ScannerProps> = ({ onScan, onClose }) => {
  // const { hasPermission, scanned, handleBarCodeScanned, resetScanner } = useScanner(onScan);

  const handleTestScan = () => {
    // Simular um scan com dados mockados
    const mockQRCode = 'http://www.fazenda.sp.gov.br/nfce/qrcode?p=35210812345678901234550010000123451234567890';
    onScan(mockQRCode, 'QR_CODE');
  };

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <View style={styles.scannerFrame} />
      </View>

      <View style={styles.instructionContainer}>
        <Text style={styles.text}>Scanner de QR Code NFCe</Text>
        <Text style={styles.subtext}>
          Câmera não disponível no Expo Go
        </Text>
        <Text style={styles.subtext}>
          O app tentará buscar dados reais da SEFAZ
        </Text>
        <Text style={[styles.subtext, { marginTop: 10 }]}>
          Use o botão abaixo para testar
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button mode="contained" onPress={handleTestScan} style={styles.button}>
          Testar com Cupom Exemplo
        </Button>
        {onClose && (
          <Button mode="outlined" onPress={onClose} style={styles.button}>
            Voltar
          </Button>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtext: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: width * 0.8,
    height: width * 0.8,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    paddingHorizontal: 20,
  },
  button: {
    marginVertical: 5,
  },
  instructionContainer: {
    position: 'absolute',
    top: 80,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 15,
    borderRadius: 10,
  },
});
