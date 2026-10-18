import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllCupons } from '../services/database/database';
import {
  gerarResumoGeral,
  analisarEstabelecimentos,
  analisarProdutos,
  gerarRecomendacoes,
} from '../services/analytics/analyticsService';
import { CupomData, EstabelecimentoEstatistica } from '../models/types';
import { useEspacoTabBar } from '../navigation/TabBar';
import { Card, FundoStatusBar, LinhaTracejada, Selo, Texto } from '../components/ui';
import { colors, radius, space, useTema } from '../theme';
import { formatarValor } from '../utils/formatacao';

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
      </Texto>
    </View>
  );
};

export const StatsScreen: React.FC = () => {
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const espacoTabBar = useEspacoTabBar();
  const [cupons, setCupons] = useState<CupomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getAllCupons();
      setCupons(data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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
    }),
    [cupons]
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={[styles.centro, { backgroundColor: cores.background }]}>
        <ActivityIndicator color={cores.text} />
      </View>
    );
  }

  const { resumo, estabelecimentos, produtos, recomendacoes } = analise;
  const recomendado = recomendacoes[0];
  const maiorIndice = Math.max(1, ...estabelecimentos.map(e => e.indicePreco ?? 0));

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
            <View style={styles.lista}>
              {estabelecimentos.slice(0, 5).map((est, index) => (
                <LinhaRanking
                  key={est.cnpj}
                  posicao={index + 1}
                  est={est}
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
                <View
                  key={prod.chave}
                  style={[
                    styles.linhaProduto,
                    index > 0 && { borderTopWidth: 1, borderTopColor: cores.border },
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
