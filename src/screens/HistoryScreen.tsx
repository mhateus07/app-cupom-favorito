import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
  Share as NativeShare,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Scan } from 'phosphor-react-native';
import { getAllCupons, importarCupons } from '../services/database/database';
import { resumoDoUltimoMes } from '../services/analytics/analyticsService';
import { CupomData } from '../models/types';
import { TabScreenProps } from '../navigation/types';
import { useEspacoTabBar } from '../navigation/TabBar';
import { Botao, CampoTexto, FundoStatusBar, Logo, Selo, Simbolo, Texto } from '../components/ui';
import { colors, radius, space, useTema } from '../theme';
import { formatarDiaMes, formatarMes, formatarValor, iniciais } from '../utils/formatacao';
import { gerarBackupJson, gerarCsvCupons, lerBackupJson } from '../services/export/exportService';
import { compartilharRelatorioPdf } from '../services/export/pdfService';

export const HistoryScreen: React.FC<TabScreenProps<'Cupons'>> = ({ navigation }) => {
  const { cores, escuro } = useTema();
  const insets = useSafeAreaInsets();
  const espacoTabBar = useEspacoTabBar();
  const [cupons, setCupons] = useState<CupomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [termo, setTermo] = useState('');
  const [mercadoFiltro, setMercadoFiltro] = useState<string | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [valorMaximo, setValorMaximo] = useState('');

  const loadCupons = useCallback(async () => {
    try {
      setErro(null);
      const data = await getAllCupons();
      setCupons(data);
    } catch (error) {
      console.error('Erro ao carregar cupons:', error);
      setErro('Não foi possível carregar seus cupons.');
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

  const mercados = useMemo(
    () => Array.from(new Set(cupons.map(cupom => cupom.estabelecimento.nome))).sort(),
    [cupons]
  );

  const cuponsVisiveis = useMemo(() => {
    const busca = termo.trim().toLocaleLowerCase('pt-BR');
    const limite = Number(valorMaximo.replace(',', '.'));
    return cupons.filter(cupom => {
      const pertenceAoMercado = !mercadoFiltro || cupom.estabelecimento.nome === mercadoFiltro;
      if (!pertenceAoMercado) return false;
      if (dataInicio && cupom.data < dataInicio) return false;
      if (dataFim && cupom.data > dataFim) return false;
      if (valorMaximo.trim() && Number.isFinite(limite) && cupom.total > limite) return false;
      if (!busca) return true;
      return (
        cupom.estabelecimento.nome.toLocaleLowerCase('pt-BR').includes(busca) ||
        cupom.produtos.some(produto => produto.nome.toLocaleLowerCase('pt-BR').includes(busca))
      );
    });
  }, [cupons, dataFim, dataInicio, mercadoFiltro, termo, valorMaximo]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCupons();
  };

  const abrirScanner = () => navigation.navigate('Scan');

  const compartilhar = async (
    conteudo: string,
    titulo: string,
    nomeArquivo: string,
    mimeType: string
  ) => {
    try {
      if (FileSystem.cacheDirectory) {
        const uri = `${FileSystem.cacheDirectory}${nomeArquivo}`;
        await FileSystem.writeAsStringAsync(uri, conteudo, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType, dialogTitle: titulo });
          return;
        }
      }
      await NativeShare.share({ message: conteudo, title: titulo });
    } catch (error) {
      Alert.alert('Não foi possível exportar', 'Tente novamente em alguns instantes.');
      console.error('Erro ao exportar dados:', error);
    }
  };

  const restaurarBackup = async () => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (resultado.canceled || !resultado.assets?.[0]) return;
      const conteudo = await FileSystem.readAsStringAsync(resultado.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const resultadoImportacao = await importarCupons(lerBackupJson(conteudo));
      await loadCupons();
      Alert.alert(
        'Backup restaurado',
        `${resultadoImportacao.importados} cupons importados. ${resultadoImportacao.ignorados} já existiam e foram ignorados.`
      );
    } catch (error) {
      console.error('Erro ao restaurar backup:', error);
      Alert.alert('Backup inválido', 'Escolha um arquivo JSON exportado pelo Cupom Favorito.');
    }
  };

  const exportar = () => {
    Alert.alert('Exportar dados', 'Escolha o formato do arquivo', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'CSV',
        onPress: () =>
          compartilhar(
            gerarCsvCupons(cupons),
            'Cupons Favorito CSV',
            'cupons-favorito.csv',
            'text/csv'
          ),
      },
      {
        text: 'Backup JSON',
        onPress: () =>
          compartilhar(
            gerarBackupJson(cupons),
            'Backup Cupom Favorito',
            'cupom-favorito-backup.json',
            'application/json'
          ),
      },
      {
        text: 'Relatório PDF',
        onPress: async () => {
          try {
            await compartilharRelatorioPdf(cupons);
          } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            Alert.alert('Não foi possível gerar o PDF', 'Tente novamente em alguns instantes.');
          }
        },
      },
      { text: 'Restaurar backup', onPress: restaurarBackup },
    ]);
  };

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
        <View style={styles.acoesTopo}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir lista de compras"
            onPress={() => navigation.navigate('ShoppingList')}
            style={({ pressed }) => [styles.acaoTopo, pressed && { opacity: 0.65 }]}
          >
            <Texto variante="label" cor={cores.textMuted}>
              Lista
            </Texto>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir alertas de preço"
            onPress={() => navigation.navigate('ProdutosMonitorados')}
            style={({ pressed }) => [styles.acaoTopo, pressed && { opacity: 0.65 }]}
          >
            <Texto variante="label" cor={cores.textMuted}>
              Alertas
            </Texto>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir conta e sincronização"
            onPress={() => navigation.navigate('Conta')}
            style={({ pressed }) => [styles.acaoTopo, pressed && { opacity: 0.65 }]}
          >
            <Texto variante="label" cor={cores.textMuted}>
              Conta
            </Texto>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exportar cupons"
            onPress={exportar}
            style={({ pressed }) => [styles.acaoTopo, pressed && { opacity: 0.65 }]}
          >
            <Texto variante="label" cor={cores.textMuted}>
              Exportar
            </Texto>
          </Pressable>
        </View>
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
      <CampoTexto
        value={termo}
        onChangeText={setTermo}
        placeholder="Buscar mercado ou produto"
        returnKeyType="search"
        accessibilityLabel="Buscar cupons"
      />
      <Pressable
        onPress={() => setMostrarFiltros(valor => !valor)}
        style={styles.abrirFiltros}
        accessibilityRole="button"
      >
        <Texto variante="label" cor={cores.textMuted}>
          {mostrarFiltros ? 'Ocultar filtros' : 'Filtros avançados'}
        </Texto>
      </Pressable>
      {mostrarFiltros && (
        <View style={styles.filtrosAvancados}>
          <CampoTexto
            rotulo="Data inicial"
            value={dataInicio}
            onChangeText={setDataInicio}
            placeholder="AAAA-MM-DD"
            autoCapitalize="none"
          />
          <CampoTexto
            rotulo="Data final"
            value={dataFim}
            onChangeText={setDataFim}
            placeholder="AAAA-MM-DD"
            autoCapitalize="none"
          />
          <CampoTexto
            rotulo="Valor máximo"
            value={valorMaximo}
            onChangeText={setValorMaximo}
            placeholder="R$ 0,00"
            keyboardType="decimal-pad"
          />
          <Pressable
            onPress={() => {
              setDataInicio('');
              setDataFim('');
              setValorMaximo('');
            }}
          >
            <Texto variante="label" cor={cores.danger}>
              Limpar filtros
            </Texto>
          </Pressable>
        </View>
      )}
      {mercados.length > 1 && (
        <View style={styles.filtrosMercado}>
          <Pressable
            onPress={() => setMercadoFiltro(null)}
            style={[styles.filtro, !mercadoFiltro && { backgroundColor: cores.inverse }]}
          >
            <Texto variante="small" cor={!mercadoFiltro ? cores.onInverse : cores.textMuted}>
              Todos
            </Texto>
          </Pressable>
          {mercados.map(mercado => {
            const ativo = mercadoFiltro === mercado;
            return (
              <Pressable
                key={mercado}
                onPress={() => setMercadoFiltro(ativo ? null : mercado)}
                style={[styles.filtro, ativo && { backgroundColor: cores.inverse }]}
              >
                <Texto
                  variante="small"
                  cor={ativo ? cores.onInverse : cores.textMuted}
                  numberOfLines={1}
                >
                  {mercado}
                </Texto>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centro, { backgroundColor: cores.background }]}>
        <ActivityIndicator color={cores.text} />
      </View>
    );
  }

  if (erro) {
    return (
      <View
        style={[
          styles.container,
          styles.erro,
          { backgroundColor: cores.background, paddingTop: insets.top + space.lg },
        ]}
      >
        <View style={styles.topo}>
          <Logo />
        </View>
        <Texto variante="title">Algo deu errado</Texto>
        <Texto cor={cores.textMuted} style={styles.vazioTexto}>
          {erro}
        </Texto>
        <Botao titulo="Tentar novamente" onPress={loadCupons} />
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
        data={cuponsVisiveis}
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
        ListEmptyComponent={
          <View style={styles.semResultado}>
            <Texto cor={cores.textMuted}>Nenhum cupom corresponde à busca.</Texto>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    marginBottom: space.xl,
  },
  acaoTopo: {
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
  },
  acoesTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
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
  erro: {
    justifyContent: 'center',
  },
  filtrosMercado: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  abrirFiltros: {
    alignSelf: 'flex-start',
    paddingVertical: space.sm,
  },
  filtrosAvancados: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.bobina,
    borderRadius: radius.card,
    marginBottom: space.md,
  },
  filtro: {
    maxWidth: 180,
    borderRadius: radius.tag,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  semResultado: {
    alignItems: 'center',
    paddingVertical: space.xxl,
  },
});
