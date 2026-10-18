import React, { useState, useCallback, useMemo } from 'react';
import {
  Alert,
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { atualizarCoordenadasEstabelecimento, getAllCupons } from '../services/database/database';
import {
  gerarResumoGeral,
  analisarEstabelecimentos,
  analisarProdutos,
  gerarRecomendacoes,
  analisarGastosMensais,
} from '../services/analytics/analyticsService';
import { CupomData, EstabelecimentoEstatistica } from '../models/types';
import { TabScreenProps } from '../navigation/types';
import { useEspacoTabBar } from '../navigation/TabBar';
import { Botao, Card, FundoStatusBar, LinhaTracejada, Selo, Texto } from '../components/ui';
import { colors, radius, space, useTema } from '../theme';
import { formatarValor } from '../utils/formatacao';
import {
  distanciaEmKm,
  geocodificarEndereco,
  obterLocalizacaoAtual,
  Coordenada,
} from '../services/location/locationService';

/** Diferença percentual em relação à média: 0.89 → -11 */
const diferencaPercentual = (indice: number): number => Math.round((indice - 1) * 100);

const LinhaRanking: React.FC<{
  posicao: number;
  est: EstabelecimentoEstatistica;
  maiorIndice: number;
}> = ({ posicao, est, maiorIndice }) => {
  const { cores } = useTema();
  const diferenca = est.indicePreco === null ? null : diferencaPercentual(est.indicePreco);

  let rotulo = 'sem dados';
  let corRotulo = cores.textMuted;
  let corBarra = cores.border;
  if (diferenca !== null && diferenca < 0) {
    rotulo = `−${-diferenca}%`;
    corRotulo = cores.saving;
    corBarra = colors.lima;
  } else if (diferenca !== null && diferenca > 0) {
    rotulo = `+${diferenca}%`;
    corRotulo = cores.danger;
    corBarra = cores.dangerFill;
  } else if (diferenca === 0) {
    rotulo = 'na média';
    corRotulo = cores.text;
    corBarra = cores.textMuted;
  }

  // Barra proporcional ao preço relativo: quanto mais barato, mais curta
  const preenchimento = est.indicePreco === null ? 0 : est.indicePreco / maiorIndice;

  return (
    <View style={[styles.ranking, { backgroundColor: cores.surface, borderColor: cores.border }]}>
      <View style={styles.rankingLinha}>
        <Texto
          variante="numberSmall"
          cor={
            posicao === 1 && diferenca !== null && diferenca < 0 ? cores.saving : cores.textMuted
          }
        >
          {String(posicao).padStart(2, '0')}
        </Texto>
        <Texto forte style={styles.rankingNome} numberOfLines={1}>
          {est.nome}
        </Texto>
        <Texto variante="numberSmall" cor={corRotulo}>
          {rotulo}
        </Texto>
      </View>
      <View style={[styles.trilho, { backgroundColor: cores.border }]}>
        <View
          style={[
            styles.barra,
            { backgroundColor: corBarra, width: `${Math.round(preenchimento * 100)}%` },
          ]}
        />
      </View>
      <Texto variante="small" cor={cores.textMuted}>
        {est.quantidadeCompras} {est.quantidadeCompras === 1 ? 'compra' : 'compras'}
        {est.indicePreco === null
          ? ' · nenhum produto em comum com outros mercados'
          : ` · ${est.produtosComparados} ${est.produtosComparados === 1 ? 'produto comparado' : 'produtos comparados'}`}
        {est.distancia !== undefined ? ` · ${est.distancia.toFixed(1)} km` : ''}
      </Texto>
    </View>
  );
};

export const StatsScreen: React.FC<TabScreenProps<'Analises'>> = ({ navigation }) => {
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const espacoTabBar = useEspacoTabBar();
  const [cupons, setCupons] = useState<CupomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [distancias, setDistancias] = useState<Record<string, number>>({});
  const [localizando, setLocalizando] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setErro(null);
      const data = await getAllCupons();
      setCupons(data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setErro('Não foi possível carregar as análises.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const analise = useMemo(
    () => ({
      resumo: gerarResumoGeral(cupons),
      estabelecimentos: analisarEstabelecimentos(cupons),
      produtos: analisarProdutos(cupons),
      recomendacoes: gerarRecomendacoes(cupons),
      gastosMensais: analisarGastosMensais(cupons),
    }),
    [cupons]
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const localizarMercados = async () => {
    setLocalizando(true);
    try {
      const origem = await obterLocalizacaoAtual();
      if (!origem) {
        Alert.alert(
          'Localização desativada',
          'Permita o acesso à localização para calcular a distância até os mercados.'
        );
        return;
      }

      const porCnpj = new Map<string, CupomData['estabelecimento']>();
      cupons.forEach(cupom => porCnpj.set(cupom.estabelecimento.cnpj, cupom.estabelecimento));
      const distanciasCalculadas: Record<string, number> = {};
      await Promise.all(
        Array.from(porCnpj.entries()).map(async ([cnpj, estabelecimento]) => {
          const latitude = estabelecimento.latitude;
          const longitude = estabelecimento.longitude;
          let destino: Coordenada | null =
            latitude !== undefined && longitude !== undefined ? { latitude, longitude } : null;
          if (!destino && estabelecimento.endereco) {
            try {
              destino = await geocodificarEndereco(
                estabelecimento.endereco,
                estabelecimento.cidade,
                estabelecimento.estado
              );
              if (destino) {
                await atualizarCoordenadasEstabelecimento(
                  cnpj,
                  destino.latitude,
                  destino.longitude
                );
              }
            } catch (error) {
              console.warn(`Não foi possível localizar ${estabelecimento.nome}`, error);
            }
          }
          if (destino) distanciasCalculadas[cnpj] = distanciaEmKm(origem, destino);
        })
      );
      setDistancias(distanciasCalculadas);
    } finally {
      setLocalizando(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centro, { backgroundColor: cores.background }]}>
        <ActivityIndicator color={cores.text} />
      </View>
    );
  }

  if (erro) {
    return (
      <View style={[styles.centro, { backgroundColor: cores.background }]}>
        <Texto variante="title">Algo deu errado</Texto>
        <Texto cor={cores.textMuted} style={styles.paragrafo}>
          {erro}
        </Texto>
        <Botao titulo="Tentar novamente" onPress={loadData} style={styles.tentarNovamente} />
      </View>
    );
  }

  const { resumo, estabelecimentos, produtos, recomendacoes, gastosMensais } = analise;
  const recomendado = recomendacoes[0];
  const maiorIndice = Math.max(1, ...estabelecimentos.map(e => e.indicePreco ?? 0));
  const maiorGastoMensal = Math.max(1, ...gastosMensais.map(mes => mes.gasto));

  return (
    <View style={{ flex: 1, backgroundColor: cores.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingTop: insets.top + space.xl,
          paddingBottom: espacoTabBar,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.text} />
        }
      >
        <Texto variante="label" cor={cores.textMuted}>
          Análises · {resumo.totalCupons} {resumo.totalCupons === 1 ? 'cupom' : 'cupons'}
        </Texto>
        <Texto variante="display" style={styles.titulo}>
          Onde comprar
        </Texto>

        {cupons.length === 0 ? (
          <Card>
            <Texto>Escaneie alguns cupons para ver onde cada produto sai mais barato.</Texto>
          </Card>
        ) : recomendado ? (
          <View style={styles.recomendado}>
            <View style={styles.recomendadoTopo}>
              <Texto variante="label" cor={colors.tinta}>
                Recomendado
              </Texto>
              <Selo variante="destaque" texto={`SCORE ${recomendado.score}`} />
            </View>
            <Texto variante="title" cor={colors.tinta} style={styles.recomendadoNome}>
              {recomendado.estabelecimento}
            </Texto>
            <LinhaTracejada cor={colors.tinta} style={styles.recomendadoLinha} />
            <View style={styles.recomendadoRodape}>
              <Texto cor={colors.tinta} style={styles.recomendadoRazoes}>
                {recomendado.razoes[0]}
              </Texto>
              {recomendado.economiaEstimada > 0 && (
                <Texto variante="numberLarge" cor={colors.tinta} style={styles.recomendadoEconomia}>
                  −R$ {formatarValor(recomendado.economiaEstimada)}
                </Texto>
              )}
            </View>
            {recomendado.razoes.length > 1 && (
              <Texto variante="small" cor={colors.tinta} style={styles.recomendadoExtras}>
                {recomendado.razoes.slice(1).join(' · ')}
              </Texto>
            )}
          </View>
        ) : (
          <Card>
            <Texto forte>Ainda não dá para comparar</Texto>
            <Texto cor={cores.textMuted} style={styles.paragrafo}>
              Compre o mesmo produto em pelo menos dois mercados diferentes e a gente mostra qual
              sai mais barato.
            </Texto>
          </Card>
        )}

        {estabelecimentos.length > 0 && (
          <>
            <View style={styles.secao}>
              <Texto variante="subtitle">Ranking de mercados</Texto>
              <Texto variante="label" cor={cores.textMuted}>
                Índice de preço
              </Texto>
            </View>
            <Botao
              titulo={localizando ? 'Localizando mercados…' : 'Usar minha localização'}
              variante="contorno"
              onPress={localizarMercados}
              style={styles.botaoLocalizacao}
            />
            <View style={styles.lista}>
              {estabelecimentos.slice(0, 5).map((est, index) => (
                <LinhaRanking
                  key={est.cnpj}
                  posicao={index + 1}
                  est={{ ...est, distancia: distancias[est.cnpj] }}
                  maiorIndice={maiorIndice}
                />
              ))}
            </View>
            <Texto variante="small" cor={cores.textMuted} style={styles.nota}>
              Comparando os mesmos produtos (pelo código de barras, ou pelo nome quando não há
              código) entre os mercados onde você comprou.
            </Texto>
          </>
        )}

        {cupons.length > 0 && (
          <>
            <View style={styles.secao}>
              <Texto variante="subtitle">Resumo</Texto>
            </View>
            <Card style={styles.cardLista}>
              {[
                ['Total gasto', `R$ ${formatarValor(resumo.totalGasto)}`, cores.text],
                [
                  'Economia com descontos',
                  `R$ ${formatarValor(resumo.economiaComDescontos)}`,
                  resumo.economiaComDescontos > 0 ? cores.saving : cores.text,
                ],
                ['Mercado favorito', resumo.mercadoFavorito, cores.text],
                ['Mais comprado', resumo.produtoMaisComprado, cores.text],
              ].map(([rotulo, valor, cor], index) => (
                <View
                  key={rotulo}
                  style={[
                    styles.linhaResumo,
                    index > 0 && { borderTopWidth: 1, borderTopColor: cores.border },
                  ]}
                >
                  <Texto cor={cores.textMuted}>{rotulo}</Texto>
                  <Texto
                    variante={index < 2 ? 'numberSmall' : 'body'}
                    forte={index >= 2}
                    cor={cor}
                    numberOfLines={1}
                    style={styles.valorResumo}
                  >
                    {valor}
                  </Texto>
                </View>
              ))}
            </Card>

            <View style={styles.secao}>
              <Texto variante="subtitle">Produtos mais comprados</Texto>
              <Texto variante="label" cor={cores.textMuted}>
                Preço médio
              </Texto>
            </View>
            <Card style={styles.cardLista}>
              {produtos.slice(0, 5).map((prod, index) => (
                <Pressable
                  key={prod.chave}
                  onPress={() => navigation.navigate('ProductComparison', { produto: prod.nome })}
                  accessibilityRole="button"
                  accessibilityLabel={`Comparar preços de ${prod.nome}`}
                  style={[
                    styles.linhaProduto,
                    index > 0 && { borderTopWidth: 1, borderTopColor: cores.border },
                    { opacity: 1 },
                  ]}
                >
                  <View style={styles.produtoInfo}>
                    <Texto forte numberOfLines={1}>
                      {prod.nome}
                    </Texto>
                    <Texto variante="small" cor={cores.textMuted} numberOfLines={1}>
                      {prod.quantidadeCompras}× · mais barato em {prod.estabelecimentoMaisBarato}
                    </Texto>
                  </View>
                  <Texto variante="numberSmall">{formatarValor(prod.precoMedio)}</Texto>
                </Pressable>
              ))}
            </Card>

            <View style={styles.secao}>
              <Texto variante="subtitle">Evolução mensal</Texto>
              <Texto variante="label" cor={cores.textMuted}>
                Últimos períodos
              </Texto>
            </View>
            <Card style={styles.cardLista}>
              {gastosMensais.slice(0, 6).map((mes, index) => (
                <View
                  key={mes.referencia}
                  style={[
                    styles.linhaMes,
                    index > 0 && { borderTopWidth: 1, borderTopColor: cores.border },
                  ]}
                >
                  <View style={styles.mesInfo}>
                    <Texto forte>{mes.referencia}</Texto>
                    <Texto variante="small" cor={cores.textMuted}>
                      {mes.cupons} {mes.cupons === 1 ? 'cupom' : 'cupons'} · economia R${' '}
                      {formatarValor(mes.economia)}
                    </Texto>
                    <View style={[styles.trilhoMes, { backgroundColor: cores.border }]}>
                      <View
                        style={[
                          styles.barraMes,
                          {
                            backgroundColor: cores.inverse,
                            width: `${Math.round((mes.gasto / maiorGastoMensal) * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Texto variante="numberSmall">R$ {formatarValor(mes.gasto)}</Texto>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
      <FundoStatusBar />
    </View>
  );
};

const styles = StyleSheet.create({
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titulo: {
    marginTop: space.sm,
    marginBottom: space.xl,
  },
  paragrafo: {
    marginTop: space.xs,
  },
  tentarNovamente: {
    marginTop: space.xl,
  },
  recomendado: {
    backgroundColor: colors.lima,
    borderRadius: radius.card,
    padding: space.xl,
  },
  recomendadoTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recomendadoNome: {
    marginTop: space.lg,
  },
  recomendadoLinha: {
    marginVertical: space.lg,
  },
  recomendadoRodape: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.lg,
  },
  recomendadoRazoes: {
    flex: 1,
  },
  recomendadoExtras: {
    marginTop: space.md,
    opacity: 0.75,
  },
  recomendadoEconomia: {
    fontSize: 28,
    lineHeight: 34,
  },
  secao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.xxl,
    marginBottom: space.lg,
  },
  lista: {
    gap: space.md,
  },
  ranking: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  rankingLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  rankingNome: {
    flex: 1,
  },
  trilho: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barra: {
    height: 6,
    borderRadius: 3,
  },
  nota: {
    marginTop: space.lg,
  },
  botaoLocalizacao: {
    marginBottom: space.lg,
  },
  cardLista: {
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
  },
  linhaResumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.md,
  },
  linhaMes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.md,
  },
  mesInfo: {
    flex: 1,
    gap: 2,
  },
  trilhoMes: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: space.xs,
  },
  barraMes: {
    height: 6,
    borderRadius: 3,
  },
  valorResumo: {
    flexShrink: 1,
    textAlign: 'right',
  },
  linhaProduto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.md,
  },
  produtoInfo: {
    flex: 1,
    gap: 2,
  },
});
