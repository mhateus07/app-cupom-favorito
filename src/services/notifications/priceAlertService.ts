import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface AlertaQuedaPreco {
  produto: string;
  mercado: string;
  precoAnterior: number;
  precoAtual: number;
  percentual: number;
}

let canalConfigurado = false;

const configurarCanalAndroid = async (): Promise<void> => {
  if (Platform.OS !== 'android' || canalConfigurado) return;
  await Notifications.setNotificationChannelAsync('precos', {
    name: 'Quedas de preço',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 150, 250],
  });
  canalConfigurado = true;
};

export const habilitarAlertasDePreco = async (): Promise<boolean> => {
  const permissaoAtual = await Notifications.getPermissionsAsync();
  let status = permissaoAtual.status;
  if (status !== 'granted') {
    const solicitada = await Notifications.requestPermissionsAsync();
    status = solicitada.status;
  }
  if (status !== 'granted') return false;
  await configurarCanalAndroid();
  return true;
};

export const agendarAlertasDeQueda = async (alertas: AlertaQuedaPreco[]): Promise<void> => {
  if (alertas.length === 0 || !(await habilitarAlertasDePreco())) return;
  await Promise.all(
    alertas.map(alerta =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Preço menor encontrado',
          body: `${alerta.produto} caiu ${alerta.percentual}% em ${alerta.mercado}: R$ ${alerta.precoAtual.toFixed(2)}`,
          data: { produto: alerta.produto, mercado: alerta.mercado },
          sound: false,
          ...(Platform.OS === 'android' ? { channelId: 'precos' } : {}),
        },
        trigger: null,
      })
    )
  );
};
