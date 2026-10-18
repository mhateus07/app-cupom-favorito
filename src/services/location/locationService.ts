import * as Location from 'expo-location';

export interface Coordenada {
  latitude: number;
  longitude: number;
}

export const obterLocalizacaoAtual = async (): Promise<Coordenada | null> => {
  const permissao = await Location.requestForegroundPermissionsAsync();
  if (permissao.status !== Location.PermissionStatus.GRANTED) return null;

  const localizacao = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: localizacao.coords.latitude,
    longitude: localizacao.coords.longitude,
  };
};

export const geocodificarEndereco = async (
  endereco: string,
  cidade?: string,
  estado?: string
): Promise<Coordenada | null> => {
  const consulta = [endereco, cidade, estado, 'Brasil'].filter(Boolean).join(', ');
  if (!consulta) return null;
  const resultados = await Location.geocodeAsync(consulta);
  const primeiro = resultados[0];
  if (!primeiro) return null;
  return { latitude: primeiro.latitude, longitude: primeiro.longitude };
};

export const distanciaEmKm = (origem: Coordenada, destino: Coordenada): number => {
  const raioTerraKm = 6371;
  const radianos = (graus: number) => (graus * Math.PI) / 180;
  const deltaLatitude = radianos(destino.latitude - origem.latitude);
  const deltaLongitude = radianos(destino.longitude - origem.longitude);
  const latitudeOrigem = radianos(origem.latitude);
  const latitudeDestino = radianos(destino.latitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeOrigem) * Math.cos(latitudeDestino) * Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(raioTerraKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};
