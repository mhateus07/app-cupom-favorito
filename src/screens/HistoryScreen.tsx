import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, FAB, ActivityIndicator, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { getAllCupons } from '../services/database/database';
import { CupomData } from '../models/types';
import { formatarMoeda, formatarData } from '../services/analytics/analyticsService';

interface HistoryScreenProps {
  navigation: any;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ navigation }) => {
  const [cupons, setCupons] = useState<CupomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCupons();
    }, [])
  );

  const loadCupons = async () => {
    try {
      const data = await getAllCupons();
      setCupons(data);
    } catch (error) {
      console.error('Erro ao carregar cupons:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCupons();
  };

  const handleCupomPress = (cupomId: number) => {
    navigation.navigate('CupomDetail', { cupomId });
  };

  const renderCupomItem = ({ item }: { item: CupomData }) => (
    <Card style={styles.card} onPress={() => handleCupomPress(item.id!)}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Text variant="titleLarge" style={styles.estabelecimentoNome}>
            {item.estabelecimento.nome}
          </Text>
          <Text variant="titleMedium" style={styles.total}>
            {formatarMoeda(item.total)}
          </Text>
        </View>

        <View style={styles.cardInfo}>
          <Text variant="bodyMedium" style={styles.data}>
            {formatarData(item.data)}
          </Text>
          <Text variant="bodySmall" style={styles.quantidadeItens}>
            {item.produtos.length} {item.produtos.length === 1 ? 'item' : 'itens'}
          </Text>
        </View>

        {item.descontoTotal > 0 && (
          <Chip mode="outlined" style={styles.descontoChip} compact>
            Economia: {formatarMoeda(item.descontoTotal)}
          </Chip>
        )}

        <Text variant="bodySmall" style={styles.formaPagamento}>
          {item.formaPagamento}
        </Text>
      </Card.Content>
    </Card>
  );

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
          Nenhum cupom escaneado ainda
        </Text>
        <Text variant="bodyMedium" style={styles.emptySubtext}>
          Toque no botão + para escanear seu primeiro cupom
        </Text>
        <FAB
          icon="barcode-scan"
          style={styles.fab}
          onPress={() => navigation.navigate('Scan')}
          label="Escanear Cupom"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cupons}
        renderItem={renderCupomItem}
        keyExtractor={item => item.id!.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
      <FAB
        icon="barcode-scan"
        style={styles.fab}
        onPress={() => navigation.navigate('Scan')}
      />
    </View>
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
    marginBottom: 30,
  },
  listContent: {
    padding: 10,
  },
  card: {
    marginBottom: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  estabelecimentoNome: {
    flex: 1,
    fontWeight: 'bold',
    marginRight: 10,
  },
  total: {
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  cardInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  data: {
    color: '#666',
  },
  quantidadeItens: {
    color: '#666',
  },
  descontoChip: {
    alignSelf: 'flex-start',
    marginVertical: 5,
    backgroundColor: '#e8f5e9',
  },
  formaPagamento: {
    color: '#888',
    marginTop: 5,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
