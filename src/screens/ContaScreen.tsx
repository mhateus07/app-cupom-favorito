import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CaretLeft } from 'phosphor-react-native';
import {
  cadastrar,
  entrar,
  EstadoConta,
  excluirConta,
  getEstadoConta,
  inscreverConta,
  pedirCodigoSenha,
  redefinirSenha,
  sair,
  sincronizar,
} from '../services/sync/contaService';
import { RootScreenProps } from '../navigation/types';
import { Botao, Card, CampoTexto, FundoStatusBar, Texto } from '../components/ui';
import { radius, space, useTema } from '../theme';
import { formatarDiaMes, formatarHora } from '../utils/formatacao';

type Modo = 'entrar' | 'cadastrar' | 'esqueci' | 'redefinir';

export const ContaScreen: React.FC<RootScreenProps<'Conta'>> = ({ navigation }) => {
  const { cores } = useTema();
  const [conta, setConta] = useState<EstadoConta>(getEstadoConta());
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => inscreverConta(setConta), []);

  const trocarModo = (novo: Modo) => {
    setModo(novo);
    setErro(null);
    setAviso(null);
    setSenha('');
  };

  const executar = async (acao: () => Promise<void>) => {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await acao();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const enviar = () =>
    executar(async () => {
      if (modo === 'entrar') {
        await entrar(email, senha);
        setSenha('');
      } else if (modo === 'cadastrar') {
        await cadastrar(email, senha);
        setSenha('');
      } else if (modo === 'esqueci') {
        await pedirCodigoSenha(email);
        setModo('redefinir');
        setAviso(`Se existir uma conta com ${email.trim()}, enviamos um código para ele.`);
      } else {
        await redefinirSenha(email, codigo, senha);
        setCodigo('');
        setModo('entrar');
        setAviso('Senha alterada. Entre com a senha nova.');
      }
    });

  const confirmarSaida = () => {
    Alert.alert('Sair da conta?', 'Os dados continuam neste aparelho, mas param de sincronizar.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => executar(sair) },
    ]);
  };

  const confirmarExclusao = () => {
    Alert.alert(
      'Excluir conta?',
      'A conta e os dados guardados no servidor serão apagados. Os dados deste aparelho continuam nele.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () =>
            executar(async () => {
              await excluirConta(senha);
              setSenha('');
              setExcluindo(false);
            }),
        },
      ]
    );
  };

  const titulos: Record<Modo, string> = {
    entrar: 'Entrar',
    cadastrar: 'Criar conta',
    esqueci: 'Recuperar senha',
    redefinir: 'Senha nova',
  };
  const botoes: Record<Modo, string> = {
    entrar: 'Entrar',
    cadastrar: 'Criar conta',
    esqueci: 'Enviar código',
    redefinir: 'Salvar senha nova',
  };

  const ultima = conta.ultimaSincronizacao;

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
          Conta
        </Texto>
        <View style={styles.voltarEspaco} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingBottom: space.xxl }}
      >
        {conta.conectado ? (
          <>
            <Texto variante="display" style={styles.titulo}>
              Sua conta
            </Texto>
            <Card style={styles.bloco}>
              <View>
                <Texto variante="label" cor={cores.textMuted}>
                  E-mail
                </Texto>
                <Texto forte>{conta.email}</Texto>
              </View>
              <View>
                <Texto variante="label" cor={cores.textMuted}>
                  Última sincronização
                </Texto>
                <Texto>
                  {conta.sincronizando
                    ? 'Sincronizando…'
                    : ultima
                      ? `${formatarDiaMes(ultima)} às ${formatarHora(ultima)}`
                      : 'Ainda não sincronizou'}
                </Texto>
              </View>
              {conta.erro && <Texto cor={cores.danger}>{conta.erro}</Texto>}
              <Botao
                titulo={conta.sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
                onPress={() => sincronizar()}
              />
            </Card>
            <Texto variante="small" cor={cores.textMuted} style={styles.nota}>
              Cupons, lista de compras, produtos monitorados e nomes corrigidos ficam guardados na
              sua conta e aparecem em todos os aparelhos em que você entrar.
            </Texto>
            {erro && (
              <Texto cor={cores.danger} style={styles.nota}>
                {erro}
              </Texto>
            )}
            <Botao
              titulo="Sair da conta"
              variante="contorno"
              onPress={confirmarSaida}
              style={styles.acao}
            />
            {excluindo ? (
              <Card style={[styles.bloco, styles.acao]}>
                <CampoTexto
                  rotulo="Digite sua senha para excluir a conta"
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Botao titulo="Excluir conta e dados na nuvem" onPress={confirmarExclusao} />
                <Botao
                  titulo="Cancelar"
                  variante="contorno"
                  onPress={() => {
                    setExcluindo(false);
                    setSenha('');
                  }}
                />
              </Card>
            ) : (
              <Botao
                titulo="Excluir conta"
                variante="contorno"
                onPress={() => setExcluindo(true)}
                style={styles.acao}
              />
            )}
          </>
        ) : (
          <>
            <Texto variante="display" style={styles.titulo}>
              {titulos[modo]}
            </Texto>
            {modo === 'entrar' || modo === 'cadastrar' ? (
              <Texto cor={cores.textMuted} style={styles.intro}>
                Com uma conta, seus cupons ficam guardados na nuvem e você pode usar o app em mais
                de um aparelho. Sem conta, tudo continua funcionando só neste celular.
              </Texto>
            ) : null}

            <Card style={styles.bloco}>
              <CampoTexto
                rotulo="E-mail"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
              />
              {modo === 'redefinir' && (
                <CampoTexto
                  rotulo="Código recebido por e-mail"
                  value={codigo}
                  onChangeText={setCodigo}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                />
              )}
              {modo !== 'esqueci' && (
                <CampoTexto
                  rotulo={modo === 'redefinir' ? 'Senha nova' : 'Senha'}
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType={modo === 'entrar' ? 'password' : 'newPassword'}
                  placeholder={modo === 'entrar' ? undefined : 'Pelo menos 8 caracteres'}
                />
              )}
              {aviso && <Texto cor={cores.textMuted}>{aviso}</Texto>}
              {erro && <Texto cor={cores.danger}>{erro}</Texto>}
              <Botao titulo={enviando ? 'Aguarde…' : botoes[modo]} onPress={enviar} />
            </Card>

            <View style={styles.links}>
              {modo !== 'entrar' && (
                <Pressable accessibilityRole="button" onPress={() => trocarModo('entrar')}>
                  <Texto forte>Já tenho conta</Texto>
                </Pressable>
              )}
              {modo !== 'cadastrar' && (
                <Pressable accessibilityRole="button" onPress={() => trocarModo('cadastrar')}>
                  <Texto forte>Criar conta</Texto>
                </Pressable>
              )}
              {modo === 'entrar' && (
                <Pressable accessibilityRole="button" onPress={() => trocarModo('esqueci')}>
                  <Texto cor={cores.textMuted}>Esqueci a senha</Texto>
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>
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
  titulo: { marginTop: space.lg, marginBottom: space.md },
  intro: { marginBottom: space.xl },
  bloco: { gap: space.lg },
  nota: { marginTop: space.lg },
  acao: { marginTop: space.md },
  links: { marginTop: space.xl, gap: space.lg, alignItems: 'center' },
});
