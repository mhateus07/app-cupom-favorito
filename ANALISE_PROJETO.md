# Análise do Projeto: App Cupom Favorito

## Visão Geral
Aplicativo **React Native** (Expo SDK 54) para escanear e gerenciar **cupons fiscais eletrônicos (NFCe)**. O usuário escaneia QR codes de notas fiscais, e o app armazena o histórico de compras, analisa preços e recomenda onde comprar mais barato.

---

## Stack Tecnológica
| Camada | Tecnologia |
|---|---|
| Framework | React Native 0.81.5 + React 19.1.0 |
| Plataforma | Expo SDK 54 (com EAS Build) |
| UI | React Native Paper (Material Design) |
| Navegação | React Navigation (Tabs + Stacks) |
| Banco de dados | SQLite (expo-sqlite) |
| HTTP | Axios |
| Parser XML | fast-xml-parser |
| Utilitários | lodash, date-fns |

---

## Estrutura do Projeto (13 arquivos fonte)

```
src/
├── models/types.ts          → Tipos TypeScript (Cupom, Produto, Estabelecimento, etc.)
├── services/
│   ├── database/database.ts → SQLite: 3 tabelas (estabelecimentos, cupons, produtos)
│   ├── sefaz/sefazService.ts→ Consulta NFCe nos portais SEFAZ dos 27 estados
│   ├── parser/cupomParser.ts→ Parse de QR codes e conversão de dados XML
│   └── analytics/analyticsService.ts → Estatísticas, comparações e recomendações
├── screens/
│   ├── ScanScreen.tsx       → Tela de escaneamento de QR codes
│   ├── CupomDetailScreen.tsx→ Detalhes de um cupom
│   ├── HistoryScreen.tsx    → Lista de cupons escaneados
│   └── StatsScreen.tsx      → Dashboard de analytics
├── components/Scanner.tsx   → Componente de scanner (atualmente em modo mock)
├── hooks/useScanner.ts      → Hook para controle da câmera/scanner
└── navigation/AppNavigator.tsx → Navegação com tabs (Histórico + Estatísticas)
```

---

## Fluxo Principal
1. Usuário escaneia QR code de uma NFCe
2. O app extrai a **chave de acesso** (44 dígitos) da URL
3. Tenta consultar dados no portal SEFAZ do estado (fallback para dados mock)
4. Salva no SQLite (estabelecimento + cupom + produtos)
5. Dados disponíveis no histórico e no dashboard de analytics

---

## Pontos Fortes
- **Arquitetura bem organizada** — camada de serviços separada da UI
- **Tipagem TypeScript** completa com interfaces bem definidas
- **Analytics robusto** — comparação de preços, ranking de lojas, recomendações com score
- **Tratamento de erros** adequado com fallbacks (dados mock quando SEFAZ não responde)
- **Normalização de nomes** de produtos para melhorar buscas
- **Suporte a todos os 27 estados** brasileiros na consulta SEFAZ

---

## Pontos de Atenção / Melhorias

1. **Scanner em modo mock** — A câmera real está desabilitada (limitação do Expo Go). Precisa de **Development Build** para funcionar de verdade.

2. **Sem testes** — O diretório `tests/` está vazio. Não há nenhum teste unitário ou de integração.

3. **Consulta SEFAZ frágil** — Muitos portais estaduais têm CAPTCHA ou bloqueiam apps. Para produção, seria ideal usar uma **API comercial** (ex: NFe.io, PlugNotas).

4. **Sem Git inicializado** — O repositório não está versionado com Git.

5. **Diretório `utils/` vazio** — Existe mas não tem conteúdo.

6. **Arquivo `App-backup.tsx`** na raiz — Código duplicado que poderia ser removido.

7. **Sem gerenciamento de estado global** — Para escalar (ex: autenticação, sincronização), pode precisar de Context API ou similar.

8. **Sem validação offline** — O app depende de rede para consultar SEFAZ, mas não tem tratamento explícito de modo offline.
