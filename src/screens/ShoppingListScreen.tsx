import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CaretLeft, Check, Trash } from 'phosphor-react-native';
import {
  adicionarItemLista,
  getListaPadrao,
  limparItensComprados,
  marcarItemLista,
  removerItemLista,
  getAllCupons,
} from '../services/database/database';
import { CestaMercado, ItemListaCompra, ListaCompra } from '../models/types';
import { RootScreenProps } from '../navigation/types';
import { Botao, Card, CampoTexto, FundoStatusBar, Texto } from '../components/ui';
import { radius, space, useTema } from '../theme';
import {
  calcularCestaPorMercado,
  formatarMoeda,
  formatarQuantidade,
} from '../services/analytics/analyticsService';

export const ShoppingListScreen: React.FC<RootScreenProps<'ShoppingList'>> = ({ navigation }) => {
  const { cores } = useTema();
  const [lista, setLista] = useState<ListaCompra | null>(null);
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [loading, setLoading] = useState(true);
  const [cesta, setCesta] = useState<CestaMercado[]>([]);
  const [calculando, setCalculando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setLista(await getListaPadrao());
    } catch (error) {
      console.error('Erro ao carregar lista:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const adicionar = async () => {
    if (!nome.trim()) return;
    await adicionarItemLista(nome, Number(quantidade.replace(',', '.')) || 1);
    setNome('');
    setQuantidade('1');
    await carregar();
  };

  const alternar = async (item: ItemListaCompra) => {
    await marcarItemLista(item.id, !item.comprado);
    await carregar();
  };

  const remover = (item: ItemListaCompra) => {
    Alert.alert('Remover item?', item.nome, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await removerItemLista(item.id);
          await carregar();
        },
      },
    ]);
  };

  const limpar = () => {
    Alert.alert('Limpar comprados?', 'Os itens marcados serão removidos da lista.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar',
        style: 'destructive',
        onPress: async () => {
          await limparItensComprados();
          await carregar();
        },
      },
    ]);
  };

  const compararCesta = async () => {
    setCalculando(true);
    try {
      const cupons = await getAllCupons();
      setCesta(calcularCestaPorMercado(pendentes, cupons));
    } catch (error) {
      console.error('Erro ao comparar cesta:', error);
      Alert.alert('Não foi possível comparar', 'Tente novamente depois de salvar mais cupons.');
    } finally {
      setCalculando(false);
    }
  };

  if (loading || !lista) {
    return (
      <View style={[styles.centro, { backgroundColor: cores.background }]}>
        <ActivityIndicator color={cores.text} />
      </View>
    );
  }

  const pendentes = lista.itens.filter(item => !item.comprado);
  const comprados = lista.itens.filter(item => item.comprado);

  return (
    <View style={[styles.container, { backgroundColor: cores.background }]}>
      <View style={styles.topo}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.voltar, { backgroundColor: cores.surface, borderColor: cores.border }]}
          accessibilityLabel="Voltar"
        >
          <CaretLeft size={22} color={cores.text} />
        </Pressable>
        <Texto variante="label" cor={cores.textMuted}>
          {lista.nome}
        </Texto>
        <View style={styles.voltarEspaco} />
      </View>
      <ScrollView contentContainerStyle={styles.conteudo}>
        <Texto variante="display" style={styles.titulo}>
          Lista de compras
        </Texto>
        <Card style={styles.adicionarCard}>
          <CampoTexto
            value={nome}
            onChangeText={setNome}
            placeholder="Adicionar produto"
            onSubmitEditing={adicionar}
            returnKeyType="done"
          />
          <CampoTexto
            value={quantidade}
            onChangeText={setQuantidade}
            placeholder="Quantidade"
            keyboardType="decimal-pad"
          />
          <Botao titulo="Adicionar item" onPress={adicionar} />
        </Card>
        <View style={styles.secao}>
          <Texto variante="subtitle">Pendentes</Texto>
          <Texto variante="label" cor={cores.textMuted}>
            {pendentes.length} itens
          </Texto>
        </View>
        {pendentes.length === 0 ? (
          <Card>
            <Texto cor={cores.textMuted}>Sua lista está em dia.</Texto>
          </Card>
        ) : (
          <>
            <Card style={styles.lista}>
              {pendentes.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  cores={cores}
                  onToggle={alternar}
                  onRemove={remover}
                />
              ))}
            </Card>
            <Botao
              titulo={calculando ? 'Calculando cesta…' : 'Comparar cesta nos mercados'}
              variante="contorno"
              onPress={compararCesta}
              style={styles.compararBotao}
            />
            {cesta.length > 0 && (
              <Card style={styles.cestaCard}>
                <Texto variante="subtitle">Melhor estimativa</Texto>
                <Texto variante="small" cor={cores.textMuted} style={styles.cestaAjuda}>
                  Baseada nos menores preços já observados nos seus cupons.
                </Texto>
                {cesta.slice(0, 3).map((mercado, index) => (
                  <View
                    key={mercado.cnpj}
                    style={[
                      styles.cestaLinha,
                      index > 0 && { borderTopWidth: 1, borderTopColor: cores.border },
                    ]}
                  >
                    <View style={styles.cestaInfo}>
                      <Texto forte>{mercado.estabelecimento}</Texto>
                      <Texto variante="small" cor={cores.textMuted}>
                        {mercado.itensEncontrados} encontrados
                        {mercado.itensNaoEncontrados > 0
                          ? ` · ${mercado.itensNaoEncontrados} sem histórico`
                          : ' · cesta completa'}
                      </Texto>
                    </View>
                    <View style={styles.cestaValor}>
                      <Texto variante="numberSmall" cor={index === 0 ? cores.saving : cores.text}>
                        {formatarMoeda(mercado.totalEstimado)}
                      </Texto>
                      {index > 0 && mercado.economia !== undefined && mercado.economia > 0 && (
                        <Texto variante="small" cor={cores.textMuted}>
                          +{formatarMoeda(mercado.economia)}
                        </Texto>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
        {comprados.length > 0 && (
          <>
            <View style={styles.secao}>
              <Texto variante="subtitle">Comprados</Texto>
              <Pressable onPress={limpar}>
                <Texto variante="label" cor={cores.danger}>
                  Limpar
                </Texto>
              </Pressable>
            </View>
            <Card style={styles.lista}>
              {comprados.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  cores={cores}
                  onToggle={alternar}
                  onRemove={remover}
                />
              ))}
            </Card>
          </>
        )}
      </ScrollView>
      <FundoStatusBar />
    </View>
  );
};

const ItemRow: React.FC<{
  item: ItemListaCompra;
  index: number;
  cores: ReturnType<typeof useTema>['cores'];
  onToggle: (item: ItemListaCompra) => void;
  onRemove: (item: ItemListaCompra) => void;
}> = ({ item, index, cores, onToggle, onRemove }) => (
  <View style={[styles.item, index > 0 && { borderTopWidth: 1, borderTopColor: cores.border }]}>
    <Pressable
      onPress={() => onToggle(item)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.comprado }}
      style={[
        styles.checkbox,
        {
          borderColor: item.comprado ? cores.inverse : cores.border,
          backgroundColor: item.comprado ? cores.inverse : 'transparent',
        },
      ]}
    >
      {item.comprado && <Check size={16} color={cores.onInverse} weight="bold" />}
    </Pressable>
    <Pressable onPress={() => onToggle(item)} style={styles.itemInfo}>
      <Texto forte style={item.comprado && styles.riscado}>
        {item.nome}
      </Texto>
      <Texto variante="small" cor={cores.textMuted}>
        {formatarQuantidade(item.quantidade)} unidade(s)
      </Texto>
    </Pressable>
    <Pressable onPress={() => onRemove(item)} accessibilityLabel={`Remover ${item.nome}`}>
      <Trash size={20} color={cores.textMuted} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.lg,
    paddingHorizontal: space.screen,
    paddingBottom: space.lg,
  },
  voltar: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voltarEspaco: { width: 44 },
  conteudo: { paddingHorizontal: space.screen, paddingBottom: space.xxl },
  titulo: { marginTop: space.lg, marginBottom: space.xl },
  adicionarCard: { gap: space.md },
  secao: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.xxl,
    marginBottom: space.lg,
  },
  lista: { paddingVertical: space.xs, paddingHorizontal: space.lg },
  compararBotao: { marginTop: space.lg },
  cestaCard: { marginTop: space.xl, gap: space.xs },
  cestaAjuda: { marginBottom: space.md },
  cestaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.md,
  },
  cestaInfo: { flex: 1, gap: 2 },
  cestaValor: { alignItems: 'flex-end' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, gap: 2 },
  riscado: { textDecorationLine: 'line-through', opacity: 0.55 },
});
