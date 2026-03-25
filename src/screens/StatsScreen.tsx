import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, Divider, ActivityIndicator, List } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { getAllCupons } from '../services/database/database';
import {
  gerarResumoGeral,
  analisarEstabelecimentos,
  analisarProdutos,
  gerarRecomendacoes,
  formatarMoeda,
} from '../services/analytics/analyticsService';
import { CupomData } from '../models/types';

export const StatsScreen: React.FC = () => {
  const [cupons, setCupons] = useState<CupomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const data = await getAllCupons();
      setCupons(data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (cupons.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="headlineSmall" style={styles.emptyText}>
          Sem dados para análise
        </Text>
        <Text variant="bodyMedium" style={styles.emptySubtext}>
          Escaneie alguns cupons para ver estatísticas
        </Text>
      </View>
    );
  }

  const resumo = gerarResumoGeral(cupons);
  const estabelecimentos = analisarEstabelecimentos(cupons);
  const produtos = analisarProdutos(cupons);
  const recomendacoes = gerarRecomendacoes(cupons);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Resumo Geral */}
      <Card style={styles.card}>
        <Card.Title title="Resumo Geral" />
        <Card.Content>
          <View style={styles.statRow}>
            <Text variant="bodyMedium">Total de Cupons:</Text>
            <Text variant="titleMedium" style={styles.statValue}>
              {resumo.totalCupons}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text variant="bodyMedium">Total Gasto:</Text>
            <Text variant="titleMedium" style={styles.statValue}>
              {formatarMoeda(resumo.totalGasto)}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text variant="bodyMedium">Economia com Descontos:</Text>
            <Text variant="titleMedium" style={[styles.statValue, styles.economiaText]}>
              {formatarMoeda(resumo.economiaComDescontos)}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.statRow}>
            <Text variant="bodyMedium">Mercado Favorito:</Text>
            <Text variant="bodyMedium" style={styles.statValue}>
              {resumo.mercadoFavorito}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text variant="bodyMedium">Produto Mais Comprado:</Text>
            <Text variant="bodyMedium" style={styles.statValue}>
              {resumo.produtoMaisComprado}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Recomendações */}
      <Card style={styles.card}>
        <Card.Title title="Onde Comprar?" />
        <Card.Content>
          {recomendacoes.slice(0, 3).map((rec, index) => (
            <View key={index}>
              <List.Item
                title={rec.estabelecimento}
                description={rec.razoes.join(' • ')}
                left={props => (
                  <View style={styles.scoreContainer}>
                    <Text variant="titleLarge" style={styles.scoreText}>
                      {rec.score}
                    </Text>
                  </View>
                )}
                right={props =>
                  rec.economiaEstimada > 0 ? (
                    <Text variant="bodySmall" style={styles.economiaText}>
                      Economize ~{formatarMoeda(rec.economiaEstimada)}
                    </Text>
                  ) : null
                }
              />
              {index < 2 && <Divider />}
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Ranking de Mercados */}
      <Card style={styles.card}>
        <Card.Title title="Ranking de Mercados" subtitle="Ordenado por preço médio" />
        <Card.Content>
          {estabelecimentos.slice(0, 5).map((est, index) => (
            <View key={index}>
              <View style={styles.rankingItem}>
                <View style={styles.rankingPosition}>
                  <Text variant="titleLarge">{index + 1}º</Text>
                </View>
                <View style={styles.rankingInfo}>
                  <Text variant="bodyLarge" style={styles.rankingNome}>
                    {est.nome}
                  </Text>
                  <Text variant="bodySmall" style={styles.rankingDetalhes}>
                    {est.quantidadeCompras} compras • Desconto médio:{' '}
                    {formatarMoeda(est.descontoMedio)}
                  </Text>
                </View>
                <View style={styles.rankingPreco}>
                  <Text variant="titleMedium">{formatarMoeda(est.precoMedioTotal)}</Text>
                  <Text variant="bodySmall" style={styles.precoLabel}>
                    média
                  </Text>
                </View>
              </View>
              {index < Math.min(estabelecimentos.length - 1, 4) && <Divider style={styles.divider} />}
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Top Produtos */}
      <Card style={styles.card}>
        <Card.Title title="Produtos Mais Comprados" />
        <Card.Content>
          {produtos.slice(0, 5).map((prod, index) => (
            <View key={index}>
              <List.Item
                title={prod.nome}
                description={`Comprado ${prod.quantidadeCompras}x • Mais barato em ${prod.estabelecimentoMaisBarato}`}
                right={props => (
                  <View style={styles.produtoPrecos}>
                    <Text variant="bodyMedium">{formatarMoeda(prod.precoMedio)}</Text>
                    <Text variant="bodySmall" style={styles.precoLabel}>
                      média
                    </Text>
                  </View>
                )}
              />
              {index < Math.min(produtos.length - 1, 4) && <Divider />}
            </View>
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#666',
    textAlign: 'center',
  },
  card: {
    margin: 10,
    elevation: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  statValue: {
    fontWeight: 'bold',
  },
  economiaText: {
    color: '#2e7d32',
  },
  divider: {
    marginVertical: 10,
  },
  scoreContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  scoreText: {
    fontWeight: 'bold',
    color: '#1976d2',
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rankingPosition: {
    width: 40,
    alignItems: 'center',
  },
  rankingInfo: {
    flex: 1,
    marginLeft: 10,
  },
  rankingNome: {
    fontWeight: '500',
    marginBottom: 3,
  },
  rankingDetalhes: {
    color: '#666',
  },
  rankingPreco: {
    alignItems: 'flex-end',
  },
  precoLabel: {
    color: '#888',
  },
  produtoPrecos: {
    alignItems: 'flex-end',
  },
});
