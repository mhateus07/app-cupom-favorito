import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Divider, ActivityIndicator, Chip } from 'react-native-paper';
import { getCupomById } from '../services/database/database';
import { CupomData } from '../models/types';
import { formatarMoeda, formatarData } from '../services/analytics/analyticsService';

interface CupomDetailScreenProps {
  route: any;
  navigation: any;
}

export const CupomDetailScreen: React.FC<CupomDetailScreenProps> = ({ route }) => {
  const { cupomId } = route.params;
  const [cupom, setCupom] = useState<CupomData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCupom();
  }, [cupomId]);

  const loadCupom = async () => {
    try {
      const data = await getCupomById(cupomId);
      setCupom(data);
    } catch (error) {
      console.error('Erro ao carregar cupom:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!cupom) {
    return (
      <View style={styles.container}>
        <Text>Cupom não encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Cabeçalho - Estabelecimento */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.estabelecimentoNome}>
            {cupom.estabelecimento.nome}
          </Text>
          <Text variant="bodyMedium" style={styles.estabelecimentoInfo}>
            CNPJ: {cupom.estabelecimento.cnpj}
          </Text>
          {cupom.estabelecimento.endereco && (
            <Text variant="bodySmall" style={styles.estabelecimentoInfo}>
              {cupom.estabelecimento.endereco}
              {cupom.estabelecimento.cidade && `, ${cupom.estabelecimento.cidade}`}
              {cupom.estabelecimento.estado && ` - ${cupom.estabelecimento.estado}`}
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Informações do Cupom */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium">Data:</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              {formatarData(cupom.data)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium">Forma de Pagamento:</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              {cupom.formaPagamento}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Lista de Produtos */}
      <Card style={styles.card}>
        <Card.Title title="Produtos" />
        <Card.Content>
          {cupom.produtos.map((produto, index) => (
            <View key={index}>
              <View style={styles.produtoItem}>
                <View style={styles.produtoInfo}>
                  <Text variant="bodyLarge" style={styles.produtoNome}>
                    {produto.nome}
                  </Text>
                  <Text variant="bodySmall" style={styles.produtoCodigo}>
                    Cód: {produto.codigo}
                  </Text>
                  <Text variant="bodySmall">
                    {produto.quantidade} x {formatarMoeda(produto.preco)}
                  </Text>
                </View>
                <View style={styles.produtoPreco}>
                  {produto.desconto > 0 && (
                    <Chip mode="outlined" style={styles.descontoChip} compact>
                      -{formatarMoeda(produto.desconto)}
                    </Chip>
                  )}
                  <Text variant="titleMedium" style={styles.precoFinal}>
                    {formatarMoeda(produto.precoFinal)}
                  </Text>
                </View>
              </View>
              {index < cupom.produtos.length - 1 && <Divider style={styles.divider} />}
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Totais */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.totalRow}>
            <Text variant="bodyLarge">Subtotal:</Text>
            <Text variant="bodyLarge">{formatarMoeda(cupom.subtotal)}</Text>
          </View>

          {cupom.descontoTotal > 0 && (
            <View style={styles.totalRow}>
              <Text variant="bodyLarge" style={styles.descontoText}>
                Descontos:
              </Text>
              <Text variant="bodyLarge" style={styles.descontoText}>
                -{formatarMoeda(cupom.descontoTotal)}
              </Text>
            </View>
          )}

          <Divider style={styles.divider} />

          <View style={styles.totalRow}>
            <Text variant="headlineSmall" style={styles.totalLabel}>
              Total:
            </Text>
            <Text variant="headlineSmall" style={styles.totalValue}>
              {formatarMoeda(cupom.total)}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Chave de Acesso */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="bodySmall" style={styles.chaveLabel}>
            Chave de Acesso:
          </Text>
          <Text variant="bodySmall" style={styles.chaveAcesso}>
            {cupom.chaveAcesso}
          </Text>
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
  card: {
    margin: 10,
    elevation: 2,
  },
  estabelecimentoNome: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  estabelecimentoInfo: {
    color: '#666',
    marginBottom: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  infoValue: {
    fontWeight: 'bold',
  },
  produtoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  produtoInfo: {
    flex: 1,
  },
  produtoNome: {
    fontWeight: '500',
    marginBottom: 3,
  },
  produtoCodigo: {
    color: '#888',
    marginBottom: 3,
  },
  produtoPreco: {
    alignItems: 'flex-end',
  },
  descontoChip: {
    marginBottom: 5,
    backgroundColor: '#ffebee',
  },
  precoFinal: {
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 5,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  descontoText: {
    color: '#d32f2f',
  },
  totalLabel: {
    fontWeight: 'bold',
  },
  totalValue: {
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  chaveLabel: {
    color: '#666',
    marginBottom: 5,
  },
  chaveAcesso: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#888',
  },
});
