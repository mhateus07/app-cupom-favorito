import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CaretLeft, Trash } from 'phosphor-react-native';
import {
  getAlertasEnviados,
  getAllCupons,
  getProdutosMonitorados,
  removerProdutoMonitorado,
  salvarProdutoMonitorado,
} from '../services/database/database';
import { analisarProdutos, chaveProduto } from '../services/analytics/analyticsService';
import { QUEDA_MINIMA_PADRAO } from '../services/notifications/avaliarAlertas';
import { AlertaEnviado, ProdutoEstatistica, ProdutoMonitorado } from '../models/types';
import { RootScreenProps } from '../navigation/types';
import { Botao, Card, CampoTexto, FundoStatusBar, Selo, Texto } from '../components/ui';
import { radius, space, useTema } from '../theme';
import { formatarDiaMes, formatarValor } from '../utils/formatacao';
import { normalizarChaveNome } from '../utils/texto';

const lerNumero = (texto: string): number | null => {
  const valor = Number(texto.replace(/\./g, '').replace(',', '.'));
  return texto.trim() && Number.isFinite(valor) && valor > 0 ? valor : null;
};

export const ProdutosMonitoradosScreen: React.FC<RootScreenProps<'ProdutosMonitorados'>> = ({
  route,
  navigation,
}) => {
  const { cores } = useTema();
  const [monitorados, setMonitorados] = useState<ProdutoMonitorado[]>([]);
  const [alertas, setAlertas] = useState<AlertaEnviado[]>([]);
  const [produtos, setProdutos] = useState<ProdutoEstatistica[]>([]);
  const [loading, setLoading] = useState(true);
  const [termo, setTermo] = useState(route.params?.produto ?? '');
  const [escolhido, setEscolhido] = useState<ProdutoEstatistica | null>(null);
  const [precoAlvo, setPrecoAlvo] = useState('');
  const [queda, setQueda] = useState(String(QUEDA_MINIMA_PADRAO));

  const carregar = useCallback(async () => {
    try {
      const [lista, enviados, cupons] = await Promise.all([
        getProdutosMonitorados(),
        getAlertasEnviados(50),
        getAllCupons(),
      ]);
      setMonitorados(lista);
      setAlertas(enviados);
      setProdutos(analisarProdutos(cupons));
    } catch (error) {
      console.error('Erro ao carregar produtos monitorados:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Já chega com o produto escolhido quando aberto pela tela de comparação
  useEffect(() => {
    const inicial = route.params?.produto;
    if (!inicial || escolhido) return;
    const alvo = normalizarChaveNome(inicial);
    const produto = produtos.find(p => normalizarChaveNome(p.nome) === alvo);
    if (produto) setEscolhido(produto);
  }, [produtos, route.params?.produto, escolhido]);

  const estatisticaPorChave = useMemo(
    () => new Map(produtos.map(produto => [produto.chave, produto])),
    [produtos]
  );

  const sugestoes = useMemo(() => {
    const busca = normalizarChaveNome(termo);
    if (!busca || escolhido) return [];
    return produtos.filter(p => normalizarChaveNome(p.nome).includes(busca)).slice(0, 5);
  }, [produtos, termo, escolhido]);

  const adicionar = async () => {
    const nome = (escolhido?.nome ?? termo).trim();
    if (!nome) return;
    const quedaMinima = lerNumero(queda) ?? QUEDA_MINIMA_PADRAO;
    try {
      await salvarProdutoMonitorado({
        chave: escolhido?.chave ?? chaveProduto({ nome, gtin: null }),
        nome,
        precoAlvo: lerNumero(precoAlvo),
        quedaMinima: Math.min(90, quedaMinima),
      });
      setTermo('');
      setEscolhido(null);
      setPrecoAlvo('');
      setQueda(String(QUEDA_MINIMA_PADRAO));
      await carregar();
    } catch (error) {
      console.error('Erro ao monitorar produto:', error);
      Alert.alert('Não foi possível salvar', 'Tente novamente em alguns instantes.');
    }
  };

  const remover = (produto: ProdutoMonitorado) => {
    Alert.alert('Parar de monitorar?', produto.nome, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await removerProdutoMonitorado(produto.id);
          await carregar();
        },
      },
    ]);
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
          Alertas de preço
        </Texto>
        <View style={styles.voltarEspaco} />
      </View>

      {loading ? (
        <View style={styles.centro}>
          <ActivityIndicator color={cores.text} />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.screen, paddingBottom: space.xxl }}
        >
          <Texto variante="display" style={styles.titulo}>
            Produtos monitorados
          </Texto>
          <Texto cor={cores.textMuted} style={styles.intro}>
            Quando você escanear um cupom, avisamos se um destes produtos ficou abaixo do preço-alvo
            ou caiu mais que o percentual escolhido. Os outros produtos avisam a partir de{' '}
            {QUEDA_MINIMA_PADRAO}% de queda.
          </Texto>

          <Card style={styles.formulario}>
            <CampoTexto
              rotulo="Produto"
              value={escolhido?.nome ?? termo}
              onChangeText={texto => {
                setEscolhido(null);
                setTermo(texto);
              }}
              placeholder="Ex.: arroz, café, leite"
              accessibilityLabel="Produto para monitorar"
            />
            {sugestoes.map(produto => (
              <Pressable
                key={produto.chave}
                accessibilityRole="button"
                onPress={() => setEscolhido(produto)}
                style={({ pressed }) => [
                  styles.sugestao,
                  { borderColor: cores.border },
                  pressed && { opacity: 0.65 },
                ]}
              >
                <Texto numberOfLines={1} style={styles.flex}>
                  {produto.nome}
                </Texto>
                <Texto variante="numberSmall" cor={cores.textMuted}>
                  méd. {formatarValor(produto.precoMedio)}
                </Texto>
              </Pressable>
            ))}
            {escolhido && (
              <Texto variante="small" cor={cores.textMuted}>
                Preço médio R$ {formatarValor(escolhido.precoMedio)} · menor R${' '}
                {formatarValor(escolhido.precoMinimo)}
              </Texto>
            )}
            <View style={styles.linhaCampos}>
              <View style={styles.flex}>
                <CampoTexto
                  rotulo="Preço-alvo (R$)"
                  value={precoAlvo}
                  onChangeText={setPrecoAlvo}
                  placeholder="opcional"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.flex}>
                <CampoTexto
                  rotulo="Queda mínima (%)"
                  value={queda}
                  onChangeText={setQueda}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Botao titulo="Monitorar produto" onPress={adicionar} />
          </Card>

          <View style={styles.secao}>
            <Texto variante="subtitle">Monitorando</Texto>
            <Texto variante="label" cor={cores.textMuted}>
              {monitorados.length} {monitorados.length === 1 ? 'produto' : 'produtos'}
            </Texto>
          </View>
          {monitorados.length === 0 ? (
            <Card>
              <Texto cor={cores.textMuted}>Nenhum produto monitorado ainda.</Texto>
            </Card>
          ) : (
            <Card style={styles.lista}>
              {monitorados.map((produto, index) => {
                const estatistica = estatisticaPorChave.get(produto.chave);
                return (
                  <View
                    key={produto.id}
                    style={[
                      styles.linha,
                      index > 0 && { borderTopWidth: 1, borderTopColor: cores.border },
                    ]}
                  >
                    <View style={styles.flex}>
                      <Texto forte numberOfLines={1}>
                        {produto.nome}
                      </Texto>
                      <Texto variante="small" cor={cores.textMuted}>
                        {[
                          produto.precoAlvo !== null &&
                            `alvo R$ ${formatarValor(produto.precoAlvo)}`,
                          `queda ≥ ${produto.quedaMinima}%`,
                          estatistica && `méd. R$ ${formatarValor(estatistica.precoMedio)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Texto>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Parar de monitorar ${produto.nome}`}
                      onPress={() => remover(produto)}
                      hitSlop={12}
                    >
                      <Trash size={20} color={cores.textMuted} />
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          )}

          <View style={styles.secao}>
            <Texto variante="subtitle">Alertas enviados</Texto>
          </View>
          {alertas.length === 0 ? (
            <Card>
              <Texto cor={cores.textMuted}>Nenhum alerta enviado ainda.</Texto>
            </Card>
          ) : (
            <Card style={styles.lista}>
              {alertas.map((alerta, index) => {
                const queda = Math.round((1 - alerta.preco / alerta.precoReferencia) * 100);
                return (
                  <View
                    key={alerta.id}
                    style={[
                      styles.linha,
                      index > 0 && { borderTopWidth: 1, borderTopColor: cores.border },
                    ]}
                  >
                    <View style={styles.flex}>
                      <Texto forte numberOfLines={1}>
                        {alerta.produto}
                      </Texto>
                      <Texto variante="small" cor={cores.textMuted} numberOfLines={1}>
                        {formatarDiaMes(alerta.enviadoEm)} · {alerta.mercado}
                      </Texto>
                    </View>
                    <View style={styles.valores}>
                      <Texto variante="numberSmall">R$ {formatarValor(alerta.preco)}</Texto>
                      {queda > 0 && <Selo variante="economia" texto={`−${queda}%`} />}
                    </View>
                  </View>
                );
              })}
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
  titulo: { marginTop: space.lg, marginBottom: space.md },
  intro: { marginBottom: space.xl },
  formulario: { gap: space.md },
  sugestao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  linhaCampos: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
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
  valores: { alignItems: 'flex-end', gap: space.xs },
});
