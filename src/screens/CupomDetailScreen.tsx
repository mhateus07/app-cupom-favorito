import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeft } from 'phosphor-react-native';
import { atualizarCupom, deleteCupom, getCupomById } from '../services/database/database';
import { CupomData } from '../models/types';
import { RootScreenProps } from '../navigation/types';
import { formatarCNPJ, formatarQuantidade } from '../services/analytics/analyticsService';
import { Botao, Card, CampoTexto, LinhaTracejada, Selo, Serrilha, Texto } from '../components/ui';
import { radius, space, useTema } from '../theme';
import {
  formatarChaveAcesso,
  formatarDiaMes,
  formatarHora,
  formatarValor,
} from '../utils/formatacao';

export const CupomDetailScreen: React.FC<RootScreenProps<'CupomDetail'>> = ({
  route,
  navigation,
}) => {
  const { cupomId } = route.params;
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const [cupom, setCupom] = useState<CupomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [observacao, setObservacao] = useState('');
  const [favorito, setFavorito] = useState(false);

  useEffect(() => {
    const loadCupom = async () => {
      try {
        const data = await getCupomById(cupomId);
        setCupom(data);
        setObservacao(data?.observacao || '');
        setFavorito(data?.favorito === true);
      } catch (error) {
        console.error('Erro ao carregar cupom:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCupom();
  }, [cupomId]);

  const voltar = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.navigate('Tabs', { screen: 'Cupons' });

  const salvarMetadados = async () => {
    try {
      await atualizarCupom(cupomId, { observacao, favorito });
      setCupom(atual => (atual ? { ...atual, observacao, favorito } : atual));
      Alert.alert('Salvo', 'As informações do cupom foram atualizadas.');
    } catch (error) {
      console.error('Erro ao atualizar cupom:', error);
      Alert.alert('Não foi possível salvar', 'Tente novamente em alguns instantes.');
    }
  };

  const excluir = () => {
    Alert.alert('Excluir cupom?', 'Essa ação remove o cupom e os itens salvos localmente.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCupom(cupomId);
            navigation.goBack();
          } catch (error) {
            console.error('Erro ao excluir cupom:', error);
            Alert.alert('Não foi possível excluir', 'Tente novamente em alguns instantes.');
          }
        },
      },
    ]);
  };

  const compartilhar = async () => {
    const texto = [
      cupom?.estabelecimento.nome,
      cupom?.data,
      ...(cupom?.produtos || []).map(
        produto => `${produto.nome} — R$ ${formatarValor(produto.precoFinal)}`
      ),
      `Total: R$ ${formatarValor(cupom?.total || 0)}`,
    ].join('\n');
    await Share.share({ message: texto, title: 'Cupom Favorito' });
  };

  const barraTopo = (
    <View style={[styles.topo, { paddingTop: insets.top + space.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={voltar}
        style={[styles.botaoTopo, { backgroundColor: cores.surface, borderColor: cores.border }]}
      >
        <CaretLeft size={22} color={cores.text} />
      </Pressable>
      <Texto variante="label" cor={cores.textMuted}>
        Cupom fiscal
      </Texto>
      <View style={styles.botaoTopoEspaco} />
    </View>
  );

  if (loading || !cupom) {
    return (
      <View style={[styles.container, { backgroundColor: cores.background }]}>
        {barraTopo}
        <View style={styles.centro}>
          {loading ? (
            <ActivityIndicator color={cores.text} />
          ) : (
            <Texto cor={cores.textMuted}>Cupom não encontrado</Texto>
          )}
        </View>
      </View>
    );
  }

  const hora = formatarHora(cupom.data);
  const itens = `${cupom.produtos.length} ${cupom.produtos.length === 1 ? 'item' : 'itens'}`;

  return (
    <View style={[styles.container, { backgroundColor: cores.background }]}>
      {barraTopo}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: insets.bottom + space.xxl,
        }}
      >
        {/* O cupom, como na bobina */}
        <View>
          <View style={[styles.bobina, { backgroundColor: cores.surface }]}>
            <View style={styles.cabecalho}>
              <View style={styles.cabecalhoTexto}>
                <Texto variante="title">{cupom.estabelecimento.nome}</Texto>
                <Texto variante="label" cor={cores.textMuted}>
                  {[formatarDiaMes(cupom.data), hora, itens].filter(Boolean).join(' · ')}
                </Texto>
              </View>
              {cupom.descontoTotal > 0 && (
                <Selo variante="economia" texto={`−R$ ${formatarValor(cupom.descontoTotal)}`} />
              )}
            </View>

            <LinhaTracejada style={styles.tracejado} />

            {cupom.produtos.map((produto, index) => (
              <View key={produto.id ?? index} style={styles.item}>
                <View style={styles.itemLinha}>
                  <Texto variante="receipt" style={styles.itemNome}>
                    {produto.nome.toUpperCase()}
                  </Texto>
                  <Texto variante="receipt">{formatarValor(produto.precoFinal)}</Texto>
                </View>
                {(produto.quantidade !== 1 || produto.desconto > 0) && (
                  <View style={styles.itemLinha}>
                    <Texto variante="numberSmall" cor={cores.textMuted} style={styles.itemDetalhe}>
                      {formatarQuantidade(produto.quantidade)}
                      {produto.unidade ? ` ${produto.unidade}` : ''} ×{' '}
                      {formatarValor(produto.preco)}
                    </Texto>
                    {produto.desconto > 0 && (
                      <Texto variante="numberSmall" cor={cores.saving} style={styles.itemDetalhe}>
                        −{formatarValor(produto.desconto)}
                      </Texto>
                    )}
                  </View>
                )}
              </View>
            ))}

            <LinhaTracejada style={styles.tracejado} />

            {cupom.descontoTotal > 0 && (
              <>
                <View style={styles.itemLinha}>
                  <Texto variante="label" cor={cores.textMuted}>
                    Subtotal
                  </Texto>
                  <Texto variante="receipt">{formatarValor(cupom.subtotal)}</Texto>
                </View>
                <View style={[styles.itemLinha, styles.linhaDesconto]}>
                  <Texto variante="label" cor={cores.textMuted}>
                    Descontos
                  </Texto>
                  <Texto variante="receipt" cor={cores.saving}>
                    −{formatarValor(cupom.descontoTotal)}
                  </Texto>
                </View>
              </>
            )}

            <View style={[styles.itemLinha, styles.total]}>
              <Texto variante="label" cor={cores.textMuted}>
                Total
              </Texto>
              <Texto variante="numberLarge">R$ {formatarValor(cupom.total)}</Texto>
            </View>
          </View>
          <Serrilha cor={cores.surface} />
        </View>

        {/* Dados da nota */}
        <Card style={styles.dados}>
          {[
            ['CNPJ', formatarCNPJ(cupom.estabelecimento.cnpj)],
            [
              'Endereço',
              [
                cupom.estabelecimento.endereco,
                cupom.estabelecimento.cidade,
                cupom.estabelecimento.estado,
              ]
                .filter(Boolean)
                .join(', '),
            ],
            ['Pagamento', cupom.formaPagamento],
            ['Chave de acesso', formatarChaveAcesso(cupom.chaveAcesso)],
          ]
            .filter(([, valor]) => valor)
            .map(([rotulo, valor], index) => (
              <View
                key={rotulo}
                style={[
                  styles.dado,
                  index > 0 && { borderTopWidth: 1, borderTopColor: cores.border },
                ]}
              >
                <Texto variante="label" cor={cores.textMuted}>
                  {rotulo}
                </Texto>
                <Texto variante={rotulo === 'Chave de acesso' ? 'numberSmall' : 'body'}>
                  {valor}
                </Texto>
              </View>
            ))}
        </Card>

        <Card style={styles.edicao}>
          <View style={styles.edicaoTopo}>
            <Texto variante="subtitle">Organização</Texto>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: favorito }}
              onPress={() => setFavorito(valor => !valor)}
              style={[styles.favorito, favorito && { backgroundColor: cores.inverse }]}
            >
              <Texto variante="small" cor={favorito ? cores.onInverse : cores.textMuted}>
                {favorito ? 'Favorito' : 'Favoritar'}
              </Texto>
            </Pressable>
          </View>
          <CampoTexto
            rotulo="Observação"
            value={observacao}
            onChangeText={setObservacao}
            placeholder="Ex.: compra do mês, churrasco..."
            multiline
            textAlignVertical="top"
            style={styles.observacao}
          />
          <Botao titulo="Salvar alterações" onPress={salvarMetadados} />
          <Botao titulo="Compartilhar resumo" variante="contorno" onPress={compartilhar} />
          <Botao titulo="Excluir cupom" variante="contorno" onPress={excluir} />
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.screen,
    paddingBottom: space.lg,
  },
  botaoTopo: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoTopoEspaco: {
    width: 44,
  },
  bobina: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: space.xl,
    paddingBottom: space.lg,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  cabecalhoTexto: {
    flex: 1,
    gap: space.xs,
  },
  tracejado: {
    marginVertical: space.lg,
  },
  item: {
    marginBottom: space.md,
  },
  itemLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.lg,
  },
  itemNome: {
    flex: 1,
  },
  itemDetalhe: {
    fontSize: 12,
  },
  linhaDesconto: {
    marginTop: space.xs,
  },
  total: {
    marginTop: space.md,
    alignItems: 'center',
  },
  dados: {
    marginTop: space.xl,
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
  },
  edicao: {
    marginTop: space.xl,
    gap: space.lg,
  },
  edicaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  favorito: {
    borderRadius: radius.tag,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  observacao: {
    minHeight: 84,
  },
  dado: {
    paddingVertical: space.md,
    gap: 2,
  },
});
