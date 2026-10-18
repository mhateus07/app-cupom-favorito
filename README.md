# App Cupom Favorito

Aplicativo mobile para escanear cupons fiscais (NFCe), armazenar dados de compras e fornecer análises inteligentes sobre preços, descontos e recomendações de onde comprar.

## Funcionalidades

- **Escaneamento de Cupons**: Leia QR Codes de cupons fiscais usando a câmera do dispositivo
- **Armazenamento Local**: Todos os dados salvos localmente com SQLite
- **Histórico de Compras**: Visualize todos os cupons escaneados
- **Análises Inteligentes**:
  - Qual mercado é mais barato
  - Qual produto é mais barato e em qual mercado
  - Ranking de estabelecimentos por desconto
  - Produtos mais comprados
  - Economia com descontos
- **Recomendações**: Sistema que sugere onde comprar baseado no histórico

## Stack Tecnológica

- **React Native** + **Expo** - Framework mobile cross-platform
- **TypeScript** - Type safety
- **React Navigation** - Navegação
- **Expo Camera** (`CameraView`) - Escaneamento de QR Code
- **Expo SQLite** - Banco de dados local
- **React Native Paper** - UI Components
- **Lodash** - Utilitários de manipulação de dados
- **date-fns** - Manipulação de datas
- **fast-xml-parser** + **axios** - Consulta e leitura da NFC-e
- **Jest** (`jest-expo`) - Testes

## Estrutura do Projeto

```
app_cupom_favorito/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   └── Scanner.tsx      # Componente de scanner QR
│   ├── screens/            # Telas do app
│   │   ├── ScanScreen.tsx
│   │   ├── CupomDetailScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── StatsScreen.tsx
│   ├── services/           # Lógica de negócio
│   │   ├── sefaz/          # Consulta à SEFAZ e leitura do XML/HTML da NFC-e
│   │   ├── parser/         # QR Code, chave de acesso e conversão para CupomData
│   │   ├── analytics/      # Engine de análise
│   │   └── database/       # Camada de dados SQLite
│   ├── models/             # Tipos TypeScript
│   ├── hooks/              # Custom hooks
│   │   └── useScanner.ts
│   ├── navigation/         # Rotas e tipos de parâmetros
│   └── utils/              # Utilitários
└── tests/                  # Testes (Jest) do parser e das análises
```

## Como Executar

### Pré-requisitos

- Node.js 20 ou superior
- npm ou yarn
- Expo Go app no seu dispositivo móvel (iOS/Android)

### Instalação

1. Clone o repositório:
```bash
cd app_cupom_favorito
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor Expo:
```bash
npm start
```

4. Escaneie o QR Code com o app Expo Go:
   - **iOS**: Use a câmera nativa
   - **Android**: Use o app Expo Go

### Scripts Disponíveis

```bash
npm start          # Inicia o Expo
npm run android    # Abre no emulador Android
npm run ios        # Abre no simulador iOS
npm run web        # Abre no navegador
npm run lint       # Executa o linter
npm run lint:fix   # Corrige problemas do linter
npm run typecheck  # Verifica os tipos (tsc)
npm test           # Executa os testes
npm run format     # Formata código com Prettier
```

## Como Usar o App

### 1. Escanear Cupom

1. Abra o app e vá para a aba "Histórico"
2. Toque no botão "+" (FAB) para abrir o scanner
3. Posicione o QR Code do cupom fiscal dentro da moldura
4. O app consulta a SEFAZ e salva o cupom. Se o portal não devolver os dados (fora do ar,
   CAPTCHA ou layout não suportado), o app mostra o motivo e **não salva nada**

### 2. Visualizar Detalhes

1. Na tela de histórico, toque em qualquer cupom
2. Veja todos os produtos, preços, descontos e informações do estabelecimento

### 3. Análises e Estatísticas

1. Vá para a aba "Estatísticas"
2. Visualize:
   - Resumo geral (total gasto, economia, mercado favorito)
   - Recomendações de onde comprar
   - Ranking de mercados mais baratos
   - Produtos mais comprados

## Modelos de Dados

### Cupom
```typescript
{
  chaveAcesso: string;      // Chave de 44 dígitos
  qrCode: string;           // URL do QR Code
  estabelecimento: {...};   // Dados do mercado
  produtos: [...];          // Lista de produtos
  data: string;             // Data da compra
  total: number;            // Valor total
  formaPagamento: string;   // Como foi pago
}
```

### Produto
```typescript
{
  nome: string;
  codigo: string;           // Código de barras
  preco: number;
  quantidade: number;
  desconto: number;
  precoFinal: number;
}
```

## Limitações Atuais

1. **Consulta à SEFAZ**: o app lê o XML (quando o portal o fornece) e o HTML no layout
   padrão da consulta pública, usado pela maioria dos estados. Portais com CAPTCHA ou layout
   próprio (ex.: MG) ainda não são suportados. Para cobertura completa, integre uma API
   comercial (Focus NFe, Webmania). Detalhes em `docs/INTEGRACAO_SEFAZ.md`.

2. **Comparação de Produtos**: produtos com código de barras (GTIN) são comparados entre
   mercados pelo código. Os sem código (pão, hortifrúti) são comparados pelo nome, então
   nomes diferentes para o mesmo produto contam como itens separados.

3. **Ranking de Mercados**: compara o preço dos mesmos produtos entre mercados. Um mercado só
   entra na comparação depois que você comprar lá algum produto que também comprou em outro.

4. **Geolocalização**: Não implementado ainda (planejado para futuras versões)

## Próximas Funcionalidades

- [x] Consulta à SEFAZ para dados reais (XML e HTML padrão)
- [ ] Suporte a portais com layout próprio (MG) e API comercial
- [ ] Sistema de normalização inteligente de produtos (ML)
- [ ] Geolocalização para recomendação baseada em distância
- [ ] Exportação de dados (CSV, PDF)
- [ ] Notificações de ofertas
- [ ] Gráficos de evolução de preços ao longo do tempo
- [ ] Busca e filtros avançados
- [ ] Lista de compras inteligente
- [ ] Compartilhamento de análises

## Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT.

## Autor

Desenvolvido como parte de um projeto de análise de cupons fiscais.

## Suporte

Para reportar bugs ou sugerir melhorias, abra uma issue no repositório.
