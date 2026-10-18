import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import {
  carregarApelidos,
  getAllCupons,
  insertCupom,
  salvarApelidos,
} from '../services/database/database';
import { processarAlertasDoCupom } from '../services/notifications/priceAlertService';
import { formatarQuantidade } from '../services/analytics/analyticsService';
import { RootScreenProps } from '../navigation/types';
import { Botao, Card, CampoTexto, LinhaTracejada, Texto } from '../components/ui';
import { radius, space, useTema } from '../theme';
import { formatarDiaMes, formatarHora, formatarValor } from '../utils/formatacao';
import { normalizarChaveNome } from '../utils/texto';

export const RevisarCupomScreen: React.FC<RootScreenProps<'RevisarCupom'>> = ({
  route,
  navigation,
}) => {
  const { cupom } = route.params;
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const [mercado, setMercado] = useState(cupom.estabelecimento.nome);
  const [nomes, setNomes] = useState(cupom.produtos.map(produto => produto.nome));
  const [observacao, setObservacao] = useState('');
  const [favorito, setFavorito] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Mostra os nomes já com as correções feitas em cupons anteriores
  useEffect(() => {
    carregarApelidos()
      .then(apelidos =>
        setNomes(
          cupom.produtos.map(
            produto => apelidos.get(normalizarChaveNome(produto.nome)) ?? produto.nome
          )
        )
      )
      .catch(error => console.warn('Não foi possível carregar as correções de nome:', error));
  }, [cupom]);

  const descartar = () => {
    Alert.alert('Descartar cupom?', 'Os dados lidos não serão salvos.', [
      { text: 'Continuar revisando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    const revisado = {
      ...cupom,
      estabelecimento: {
        ...cupom.estabelecimento,
        nome: mercado.trim() || cupom.estabelecimento.nome,
      },
      produtos: cupom.produtos.map((produto, index) => ({
        ...produto,
        nome: nomes[index].trim() || produto.nome,
      })),
      observacao: observacao.trim() || undefined,
      favorito,
    };

    try {
      const historicoAntes = await getAllCupons();
      const cupomId = await insertCupom(revisado);

      if (lembrar) {
        await salvarApelidos(
          cupom.produtos.map((produto, index) => ({
            original: produto.nome,
            corrigido: revisado.produtos[index].nome,
          }))
        ).catch(error => console.warn('Não foi possível lembrar as correções:', error));
      }
      await processarAlertasDoCupom(revisado, historicoAntes).catch(error =>
        console.warn('Não foi possível processar alertas de preço:', error)
      );

      navigation.replace('CupomDetail', { cupomId });
    } catch (error) {
      console.error('Erro ao salvar cupom:', error);
      setSalvando(false);
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        Alert.alert('Cupom já existe', 'Este cupom já foi escaneado anteriormente.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Não foi possível salvar', 'Tente novamente em alguns instantes.');
      }
    }
  };

  const hora = formatarHora(cupom.data);
  const corrigidos = cupom.produtos.filter(
    (produto, index) => normalizarChaveNome(produto.nome) !== normalizarChaveNome(nomes[index])
  ).length;

  return (
    <View style={[styles.container, { backgroundColor: cores.background }]}>
      <View style={[styles.topo, { paddingTop: insets.top + space.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Descartar cupom"
          onPress={descartar}
          style={[styles.botaoTopo, { backgroundColor: cores.surface, borderColor: cores.border }]}
        >
          <X size={20} color={cores.text} />
        </Pressable>
        <Texto variante="label" cor={cores.textMuted}>
          Revisar cupom
        </Texto>
        <View style={styles.botaoTopoEspaco} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: space.screen,
          paddingBottom: insets.bottom + space.xxl,
        }}
      >
        <Texto cor={cores.textMuted} style={styles.intro}>
          Confira os dados lidos da SEFAZ. Você pode corrigir o nome do mercado e dos produtos antes
          de salvar.
        </Texto>

        <Card style={styles.bloco}>
          <CampoTexto
            rotulo="Mercado"
            value={mercado}
            onChangeText={setMercado}
            accessibilityLabel="Nome do mercado"
          />
          <View style={styles.resumo}>
            <Texto variante="label" cor={cores.textMuted}>
              {[formatarDiaMes(cupom.data), hora, `${cupom.produtos.length} itens`]
                .filter(Boolean)
                .join(' · ')}
            </Texto>
            <Texto variante="number">R$ {formatarValor(cupom.total)}</Texto>
          </View>
        </Card>

        <View style={styles.secao}>
          <Texto variante="subtitle">Produtos</Texto>
          {corrigidos > 0 && (
            <Texto variante="label" cor={cores.textMuted}>
              {corrigidos} {corrigidos === 1 ? 'corrigido' : 'corrigidos'}
            </Texto>
          )}
        </View>
        <Card style={styles.bloco}>
          {cupom.produtos.map((produto, index) => (
            <View key={index} style={styles.item}>
              {index > 0 && <LinhaTracejada style={styles.tracejado} />}
              <CampoTexto
                value={nomes[index]}
                onChangeText={texto =>
                  setNomes(atuais => atuais.map((nome, i) => (i === index ? texto : nome)))
                }
                accessibilityLabel={`Nome do produto ${index + 1}`}
              />
              <View style={styles.itemLinha}>
                <Texto variante="numberSmall" cor={cores.textMuted}>
                  {formatarQuantidade(produto.quantidade)}
                  {produto.unidade ? ` ${produto.unidade}` : ''} × {formatarValor(produto.preco)}
                </Texto>
                <Texto variante="numberSmall">{formatarValor(produto.precoFinal)}</Texto>
              </View>
            </View>
          ))}
        </Card>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: lembrar }}
          onPress={() => setLembrar(valor => !valor)}
          style={styles.opcao}
        >
          <View
            style={[
              styles.caixa,
              { borderColor: cores.text },
              lembrar && { backgroundColor: cores.inverse },
            ]}
          />
          <Texto variante="small" style={styles.opcaoTexto}>
            Usar estes nomes nos próximos cupons com os mesmos produtos
          </Texto>
        </Pressable>

        <Card style={styles.bloco}>
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
        </Card>

        <Botao
          titulo={salvando ? 'Salvando…' : 'Salvar cupom'}
          onPress={salvar}
          style={styles.salvar}
        />
        <Botao titulo="Descartar" variante="contorno" onPress={descartar} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  botaoTopoEspaco: { width: 44 },
  intro: { marginBottom: space.xl },
  bloco: { gap: space.md },
  resumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.lg,
  },
  secao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.xxl,
    marginBottom: space.lg,
  },
  item: { gap: space.sm },
  tracejado: { marginBottom: space.sm },
  itemLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginVertical: space.xl,
  },
  caixa: {
    width: 20,
    height: 20,
    borderRadius: radius.tag,
    borderWidth: 1.5,
  },
  opcaoTexto: { flex: 1 },
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
  observacao: { minHeight: 84 },
  salvar: { marginTop: space.xl, marginBottom: space.md },
});
