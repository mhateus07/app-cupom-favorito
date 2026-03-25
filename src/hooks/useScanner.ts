import { useState, useEffect } from 'react';
import { BarCodeScanner, BarCodeScannerResult } from 'expo-barcode-scanner';

export interface ScannerHook {
  hasPermission: boolean | null;
  scanned: boolean;
  handleBarCodeScanned: (result: BarCodeScannerResult) => void;
  resetScanner: () => void;
}

export const useScanner = (
  onScan: (data: string, type: string) => void
): ScannerHook => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const requestPermission = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    requestPermission();
  }, []);

  const handleBarCodeScanned = ({ type, data }: BarCodeScannerResult) => {
    if (!scanned) {
      setScanned(true);
      onScan(data, type);
    }
  };

  const resetScanner = () => {
    setScanned(false);
  };

  return {
    hasPermission,
    scanned,
    handleBarCodeScanned,
    resetScanner,
  };
};
