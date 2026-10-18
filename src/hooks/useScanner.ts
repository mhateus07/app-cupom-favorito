import { useCallback, useEffect, useRef } from 'react';
import { BarcodeScanningResult, useCameraPermissions } from 'expo-camera';

export interface ScannerHook {
  hasPermission: boolean | null;
  canAskAgain: boolean;
  requestPermission: () => Promise<unknown>;
  handleBarcodeScanned: (result: BarcodeScanningResult) => void;
  resetScanner: () => void;
}

export const useScanner = (onScan: (data: string, type: string) => void): ScannerHook => {
  const [permission, requestPermission] = useCameraPermissions();
  // A câmera dispara vários eventos por segundo; o ref garante uma leitura por vez
  const scannedRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcodeScanned = useCallback(
    ({ type, data }: BarcodeScanningResult) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      onScan(data, type);
    },
    [onScan]
  );

  const resetScanner = useCallback(() => {
    scannedRef.current = false;
  }, []);

  return {
    hasPermission: permission ? permission.granted : null,
    canAskAgain: permission?.canAskAgain ?? true,
    requestPermission,
    handleBarcodeScanned,
    resetScanner,
  };
};
