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
- **Expo Camera + Barcode Scanner** - Escaneamento de QR Code
- **Expo SQLite** - Banco de dados local
- **React Native Paper** - UI Components
- **Lodash** - Utilitários de manipulação de dados
- **date-fns** - Manipulação de datas

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
│   │   ├── scanner/
│   │   ├── parser/         # Parser de cupom fiscal
│   │   ├── analytics/      # Engine de análise
│   │   └── database/       # Camada de dados SQLite
│   ├── models/             # Tipos TypeScript
│   ├── hooks/              # Custom hooks
│   │   └── useScanner.ts
│   ├── navigation/         # Configuração de rotas
│   └── utils/              # Utilitários
└── tests/                  # Testes
```

## Como Executar

### Pré-requisitos

- Node.js (v16 ou superior)
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
npm run format     # Formata código com Prettier
```

## Como Usar o App

### 1. Escanear Cupom

1. Abra o app e vá para a aba "Histórico"
2. Toque no botão "+" (FAB) para abrir o scanner
3. Posicione o QR Code do cupom fiscal dentro da moldura
4. O app processará e salvará automaticamente os dados

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

1. **Parser de Cupom**: Atualmente usa dados mockados. Para produção, seria necessário:
   - Integrar com API da SEFAZ para obter XML completo
   - Implementar parser XML robusto
   - Tratar diferentes formatos de NFCe/NFe por estado

2. **Normalização de Produtos**: Produtos com nomes diferentes podem ser tratados como itens separados

3. **Geolocalização**: Não implementado ainda (planejado para futuras versões)

## Próximas Funcionalidades

- [ ] Integração com API SEFAZ para dados reais
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
