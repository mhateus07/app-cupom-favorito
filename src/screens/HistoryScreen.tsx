import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Scan } from 'phosphor-react-native';
import { getAllCupons } from '../services/database/database';
import { resumoDoUltimoMes } from '../services/analytics/analyticsService';
import { CupomData } from '../models/types';
import { TabScreenProps } from '../navigation/types';
import { useEspacoTabBar } from '../navigation/TabBar';
import { Botao, FundoStatusBar, Logo, Selo, Simbolo, Texto } from '../components/ui';
import { colors, radius, space, useTema } from '../theme';
import { formatarDiaMes, formatarMes, formatarValor, iniciais } from '../utils/formatacao';

export const HistoryScreen: React.FC<TabScreenProps<'Cupons'>> = ({ navigation }) => {
  const { cores, escuro } = useTema();
  const insets = useSafeAreaInsets();
  const espacoTabBar = useEspacoTabBar();
  const [cupons, setCupons] = useState<CupomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCupons = useCallback(async () => {
    try {
      const data = await getAllCupons();
      setCupons(data);
    } catch (error) {
      console.error('Erro ao carregar cupons:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCupons();
    }, [loadCupons])
  );

  const resumo = useMemo(() => resumoDoUltimoMes(cupons), [cupons]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCupons();
  };

  const abrirScanner = () => navigation.navigate('Scan');

  const renderCupomItem = ({ item }: { item: CupomData }) => (
    <Pressable
      onPress={() =>
        item.id !== undefined && navigation.navigate('CupomDetail', { cupomId: item.id })
      }
      style={({ pressed }) => [
        styles.cupom,
        { backgroundColor: cores.surface, borderColor: cores.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.iniciais, { backgroundColor: cores.surfaceMuted }]}>
        <Texto variante="numberSmall" style={styles.iniciaisTexto}>
          {iniciais(item.estabelecimento.nome)}
        </Texto>
      </View>

      <View style={styles.cupomInfo}>
        <Texto forte numberOfLines={1}>
          {item.estabelecimento.nome}
        </Texto>
        <Texto variante="label" cor={cores.textMuted}>
          {formatarDiaMes(item.data)} · {item.produtos.length}{' '}
          {item.produtos.length === 1 ? 'item' : 'itens'}
        </Texto>
      </View>

      <View style={styles.cupomValores}>
        <Texto variante="number" style={styles.valor}>
          {formatarValor(item.total)}
        </Texto>
        {item.descontoTotal > 0 ? (
          <Texto variante="numberSmall" cor={cores.saving}>
            −{formatarValor(item.descontoTotal)}
          </Texto>
        ) : (
          <Texto variante="numberSmall" cor={cores.textMuted}>
            sem desc.
          </Texto>
        )}
      </View>
    </Pressable>
  );

  const cabecalho = (
    <View>
      <View style={styles.topo}>
        <Logo />
      </View>

      {resumo && (
        <View style={[styles.resumo, { backgroundColor: cores.inverse }]}>
          <Texto variante="label" cor={cores.onInverseMuted}>
            {formatarMes(resumo.referencia)} · {resumo.quantidade}{' '}
            {resumo.quantidade === 1 ? 'cupom' : 'cupons'}
          </Texto>
          <View style={styles.resumoLinha}>
            <View style={styles.resumoGasto}>
              <Texto cor={cores.onInverseMuted}>Gasto no mês</Texto>
              <Texto
                variante="numberLarge"
                cor={cores.onInverse}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                R$ {formatarValor(resumo.gasto)}
              </Texto>
            </View>
            <View style={styles.resumoEconomia}>
              <Texto cor={cores.onInverseMuted}>Economia</Texto>
              {resumo.economia > 0 ? (
                <Selo
                  variante="economia"
                  tamanho="grande"
                  texto={`R$ ${formatarValor(resumo.economia)}`}
                />
              ) : (
                <Texto variante="numberSmall" cor={cores.onInverseMuted}>
                  sem descontos
                </Texto>
              )}
            </View>
          </View>
        </View>
      )}

      <View style={styles.secao}>
        <Texto variante="title">Seus cupons</Texto>
        <Texto variante="label" cor={cores.textMuted}>
          Mais recentes
        </Texto>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centro, { backgroundColor: cores.background }]}>
        <ActivityIndicator color={cores.text} />
      </View>
    );
  }

  if (cupons.length === 0) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: cores.background, paddingTop: insets.top + space.lg },
        ]}
      >
        <View style={styles.topo}>
          <Logo />
        </View>
        <View style={[styles.vazio, { paddingBottom: espacoTabBar }]}>
          <Simbolo tamanho={88} variante={escuro ? 'papel' : 'tinta'} />
          <Texto variante="title" style={styles.vazioTitulo}>
            Nenhum cupom ainda
          </Texto>
          <Texto cor={cores.textMuted} style={styles.vazioTexto}>
            Escaneie o QR Code do rodapé de um cupom fiscal. A gente lê os itens e mostra onde cada
            produto sai mais barato.
          </Texto>
          <Botao
            titulo="Escanear cupom"
            icone={<Scan size={20} color={colors.tinta} weight="bold" />}
            onPress={abrirScanner}
            style={styles.vazioBotao}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.semMargem, { backgroundColor: cores.background }]}>
      <FlatList
        data={cupons}
        renderItem={renderCupomItem}
        keyExtractor={item => String(item.id ?? item.chaveAcesso)}
        ListHeaderComponent={cabecalho}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingTop: insets.top + space.lg,
          paddingBottom: espacoTabBar,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.text} />
        }
      />
      <FundoStatusBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space.screen,
  },
  semMargem: {
    paddingHorizontal: 0,
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topo: {
    height: 52,
    justifyContent: 'center',
    marginBottom: space.xl,
  },
  resumo: {
    borderRadius: radius.card,
    padding: space.xl,
    gap: space.lg,
  },
  resumoLinha: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  resumoGasto: {
    flex: 1,
    gap: space.xs,
  },
  resumoEconomia: {
    alignItems: 'flex-end',
    gap: space.sm,
  },
  secao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.xxl,
    marginBottom: space.lg,
  },
  cupom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
  },
  iniciais: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciaisTexto: {
    letterSpacing: 0,
  },
  cupomInfo: {
    flex: 1,
    gap: 2,
  },
  cupomValores: {
    alignItems: 'flex-end',
    gap: 2,
  },
  valor: {
    fontSize: 18,
  },
  vazio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vazioTitulo: {
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  vazioTexto: {
    textAlign: 'center',
    marginBottom: space.xl,
  },
  vazioBotao: {
    alignSelf: 'stretch',
  },
});
