import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CaretLeft } from 'phosphor-react-native';
import { corrigirNomeProduto, getAllCupons } from '../services/database/database';
import {
  compararPrecoProduto,
  analisarProdutos,
  chaveProduto,
  historicoPrecoProduto,
} from '../services/analytics/analyticsService';
import { CupomData } from '../models/types';
import { RootScreenProps } from '../navigation/types';
import { Botao, Card, CampoTexto, FundoStatusBar, Texto } from '../components/ui';
import { GraficoPreco } from '../components/GraficoPreco';
import { formatarDiaMes, formatarValor } from '../utils/formatacao';
import { radius, space, useTema } from '../theme';

export const ProductComparisonScreen: React.FC<RootScreenProps<'ProductComparison'>> = ({
  route,
  navigation,
}) => {
  const { cores } = useTema();
  const [cupons, setCupons] = useState<CupomData[]>([]);
  const [termo, setTermo] = useState(route.params.produto);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setCupons(await getAllCupons());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const precos = useMemo(() => compararPrecoProduto(termo, cupons), [cupons, termo]);
  const estatistica = useMemo(
    () =>
      analisarProdutos(cupons).find(
        produto => produto.nome.toLocaleLowerCase('pt-BR') === termo.toLocaleLowerCase('pt-BR')
      ),
    [cupons, termo]
  );
  const historico = useMemo(
    () => historicoPrecoProduto(estatistica?.chave ?? termo, cupons),
    [cupons, estatistica, termo]
  );

  const salvarNome = async () => {
    const nome = novoNome?.trim();
    if (!estatistica || !nome) return;
    // Com código de barras, o mesmo produto pode ter nomes diferentes em cada mercado
    const nomesAtuais = new Set(
      cupons
        .flatMap(cupom => cupom.produtos)
        .filter(produto => chaveProduto(produto) === estatistica.chave)
        .map(produto => produto.nome)
    );
    try {
      for (const atual of nomesAtuais) await corrigirNomeProduto(atual, nome);
      setNovoNome(null);
      setTermo(nome);
      await carregar();
    } catch (error) {
      console.error('Erro ao corrigir nome:', error);
      Alert.alert('Não foi possível corrigir o nome', 'Tente novamente em alguns instantes.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: cores.background }]}>
      <View style={styles.topo}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => navigation.goBack()}
          style={[styles.voltar, { backgroundColor: cores.surface, borderColor: cores.border }]}
        >
          <CaretLeft size={22} color={cores.text} />
        </Pressable>
        <Texto variante="label" cor={cores.textMuted}>
          Comparar produto
        </Texto>
        <View style={styles.voltarEspaco} />
      </View>
      {loading ? (
        <View style={styles.centro}>
          <ActivityIndicator color={cores.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.screen, paddingBottom: space.xxl }}
        >
          <Texto variante="display" style={styles.titulo}>
            Preço do produto
          </Texto>
          <CampoTexto
            value={termo}
            onChangeText={setTermo}
            placeholder="Digite o produto"
            accessibilityLabel="Produto para comparação"
          />

          {estatistica && (
            <Card style={styles.resumo}>
              <Texto variante="title">{estatistica.nome}</Texto>
              <View style={styles.resumoLinha}>
                <View>
                  <Texto variante="label" cor={cores.textMuted}>
                    Preço médio
                  </Texto>
                  <Texto variante="numberLarge">R$ {formatarValor(estatistica.precoMedio)}</Texto>
                </View>
                <View style={styles.resumoDireita}>
                  <Texto variante="label" cor={cores.textMuted}>
                    Variação
                  </Texto>
                  <Texto variante="numberSmall">
                    R$ {formatarValor(estatistica.precoMinimo)} — R${' '}
                    {formatarValor(estatistica.precoMaximo)}
                  </Texto>
                </View>
              </View>
              {novoNome === null ? (
                <View style={styles.acoes}>
                  <Botao
                    titulo="Corrigir nome"
                    variante="contorno"
                    onPress={() => setNovoNome(estatistica.nome)}
                    style={styles.acao}
                  />
                  <Botao
                    titulo="Monitorar"
                    variante="secundario"
                    onPress={() =>
                      navigation.navigate('ProdutosMonitorados', { produto: estatistica.nome })
                    }
                    style={styles.acao}
                  />
                </View>
              ) : (
                <View style={styles.edicao}>
                  <CampoTexto
                    rotulo="Nome do produto"
                    value={novoNome}
                    onChangeText={setNovoNome}
                    autoFocus
                  />
                  <Texto variante="small" cor={cores.textMuted}>
                    Vale para todas as compras deste produto e para os próximos cupons.
                  </Texto>
                  <View style={styles.acoes}>
                    <Botao
                      titulo="Cancelar"
                      variante="contorno"
                      onPress={() => setNovoNome(null)}
                      style={styles.acao}
                    />
                    <Botao titulo="Salvar" onPress={salvarNome} style={styles.acao} />
                  </View>
                </View>
              )}
            </Card>
          )}

          {historico.length >= 2 && (
            <>
              <View style={styles.secao}>
                <Texto variante="subtitle">Evolução do preço</Texto>
                <Texto variante="label" cor={cores.textMuted}>
                  Por compra
                </Texto>
              </View>
              <Card>
                <GraficoPreco pontos={historico} />
              </Card>
            </>
          )}

          <View style={styles.secao}>
            <Texto variante="subtitle">Histórico encontrado</Texto>
            <Texto variante="label" cor={cores.textMuted}>
              {precos.length} registros
            </Texto>
          </View>
          {precos.length === 0 ? (
            <Card>
              <Texto cor={cores.textMuted}>Nenhum preço encontrado para este produto.</Texto>
            </Card>
          ) : (
            <Card style={styles.lista}>
              {precos.map((preco, index) => (
                <View
                  key={`${preco.estabelecimento}-${preco.data}-${index}`}
                  style={[
                    styles.linha,
                    index > 0 && { borderTopWidth: 1, borderTopColor: cores.border },
                  ]}
                >
                  <View style={styles.info}>
                    <Texto forte>{preco.estabelecimento}</Texto>
                    <Texto variante="small" cor={cores.textMuted}>
                      {formatarDiaMes(preco.data)}
                    </Texto>
                  </View>
                  <Texto variante="numberSmall">R$ {formatarValor(preco.preco)}</Texto>
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}
      <FundoStatusBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titulo: { marginTop: space.lg, marginBottom: space.xl },
  resumo: { marginTop: space.xl, gap: space.lg },
  resumoLinha: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg },
  resumoDireita: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', gap: space.xs },
  secao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.xxl,
    marginBottom: space.lg,
  },
  lista: { paddingVertical: space.xs, paddingHorizontal: space.lg },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
    gap: space.lg,
  },
  info: { flex: 1, gap: 2 },
  acoes: { flexDirection: 'row', gap: space.md },
  acao: { flex: 1, paddingHorizontal: space.md },
  edicao: { gap: space.md },
});
