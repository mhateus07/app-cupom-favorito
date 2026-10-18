import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { CupomData } from '../../models/types';
import {
  getAlertasEnviados,
  getProdutosMonitorados,
  registrarAlertasEnviados,
} from '../database/database';
import { formatarValor } from '../../utils/formatacao';
import { AlertaQuedaPreco, avaliarAlertas } from './avaliarAlertas';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
          title: alerta.motivo === 'alvo' ? 'Preço-alvo atingido' : 'Preço menor encontrado',
          body:
            alerta.motivo === 'alvo'
              ? `${alerta.produto} saiu por R$ ${formatarValor(alerta.precoAtual)} em ${alerta.mercado} (seu alvo: R$ ${formatarValor(alerta.precoAlvo ?? alerta.precoAtual)})`
              : `${alerta.produto} caiu ${alerta.percentual}% em ${alerta.mercado}: R$ ${formatarValor(alerta.precoAtual)}`,
          data: { produto: alerta.produto, mercado: alerta.mercado },
          sound: false,
          ...(Platform.OS === 'android' ? { channelId: 'precos' } : {}),
        },
        trigger: null,
      })
    )
  );
};

/**
 * Avalia o cupom recém-salvo contra o histórico anterior, avisa e registra os alertas
 * enviados (o registro evita repetir o mesmo aviso)
 */
export const processarAlertasDoCupom = async (
  cupom: CupomData,
  historicoAntes: CupomData[]
): Promise<AlertaQuedaPreco[]> => {
  const [monitorados, enviados] = await Promise.all([
    getProdutosMonitorados(),
    getAlertasEnviados(1000),
  ]);
  const alertas = avaliarAlertas(cupom, historicoAntes, monitorados, enviados);
  if (alertas.length === 0) return [];

  await agendarAlertasDeQueda(alertas);
  await registrarAlertasEnviados(
    alertas.map(alerta => ({
      chave: alerta.chave,
      produto: alerta.produto,
      mercado: alerta.mercado,
      cnpj: alerta.cnpj,
      preco: alerta.precoAtual,
      precoReferencia: alerta.precoReferencia,
    }))
  );
  return alertas;
};
