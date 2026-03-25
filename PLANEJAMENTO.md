# Plano do Projeto: App Cupom Favorito

## Visão Geral
Aplicativo mobile para escanear cupons fiscais, armazenar dados de compras e fornecer análises inteligentes sobre preços, descontos e recomendações de onde comprar.

---

## Stack Tecnológico Recomendado

### Frontend Mobile
- **React Native** com **Expo** - Desenvolvimento cross-platform (iOS/Android)
- **TypeScript** - Type safety e melhor manutenibilidade
- **React Navigation** - Navegação entre telas
- **React Native Vision Camera** ou **Expo Camera** - Captura de câmera
- **Vision Camera Code Scanner** - Leitura de códigos de barras/QR

### Banco de Dados
- **WatermelonDB** ou **Realm** - Banco de dados local reativo e performático
- Alternativa: **SQLite** com **expo-sqlite**

### Análise de Dados
- **Lodash** - Manipulação de dados
- **date-fns** - Manipulação de datas
- Algoritmos customizados para análise de preços

### Visualização
- **Victory Native** ou **React Native Chart Kit** - Gráficos e estatísticas
- **React Native Paper** ou **NativeBase** - UI components

### Parser de Cupom
- **Regex patterns** customizados para extrair dados do QR code (formato NFCe/NFe)
- Integração com **API SEFAZ** (opcional) para validação

---

## Arquitetura do Projeto

```
app_cupom_favorito/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   ├── screens/            # Telas do app
│   │   ├── ScanScreen      # Escaneamento de cupom
│   │   ├── CupomDetail     # Detalhes do cupom
│   │   ├── HistoryScreen   # Histórico de compras
│   │   ├── StatsScreen     # Dashboard de estatísticas
│   │   └── RecommendScreen # Recomendações
│   ├── services/           # Lógica de negócio
│   │   ├── scanner/        # Leitura de códigos
│   │   ├── parser/         # Parser de cupom fiscal
│   │   ├── analytics/      # Engine de análise
│   │   └── database/       # Camada de dados
│   ├── models/             # Modelos de dados
│   │   ├── Cupom
│   │   ├── Produto
│   │   ├── Estabelecimento
│   │   └── FormaPagamento
│   ├── utils/              # Utilitários
│   ├── hooks/              # Custom hooks
│   └── navigation/         # Configuração de rotas
├── assets/                 # Imagens, fontes, etc
└── tests/                  # Testes
```

---

## Modelos de Dados Principais

### Cupom
- id, qrCode, chaveAcesso
- estabelecimentoId
- data, total, subtotal
- formaPagamento
- itens[] (produtos)

### Produto
- id, nome, codigo
- preco, quantidade
- desconto, precoFinal
- cupomId

### Estabelecimento
- id, nome, cnpj
- endereco, cidade, estado

### Estatísticas (calculadas)
- precoMedioPorProduto
- precoMedioPorMercado
- descontosMercado
- rankingMercados

---

## Funcionalidades Core

### 1. Escaneamento
- Câmera para ler QR Code do cupom fiscal (NFCe/NFe)
- Parser para extrair dados estruturados
- Validação e armazenamento local

### 2. Armazenamento
- Salvar cupom completo com todos os itens
- Normalização de nomes de produtos (ex: "ARROZ TIOJOAO" = "Arroz Tio João")
- Indexação para buscas rápidas

### 3. Análises
- **Mercado mais barato**: Média de preços por estabelecimento
- **Produto mais barato**: Menor preço por produto + localização
- **Mais descontos**: Ranking de estabelecimentos por % de desconto
- **Tendências**: Variação de preços ao longo do tempo

### 4. Recomendações
- Algoritmo baseado em:
  - Histórico de compras do usuário
  - Produtos mais comprados
  - Preços médios por mercado
  - Distância (opcional, com geolocalização)

---

## Fluxo do Usuário

1. **Primeira vez**: Tutorial sobre como escanear cupom
2. **Escanear**: Abre câmera → lê QR code → processa dados
3. **Revisar**: Mostra detalhes do cupom → confirma/edita
4. **Salvar**: Armazena no banco local
5. **Explorar**: Visualiza estatísticas, histórico e recomendações
6. **Decidir**: Vê qual mercado ir baseado em análises

---

## Desafios Técnicos

1. **Parser de Cupom**: Cupons fiscais têm formatos variados (NFCe, NFe, SAT)
2. **Normalização de Dados**: Mesmo produto com nomes diferentes
3. **Performance**: Análise de milhares de produtos rapidamente
4. **Precisão**: Algoritmo de recomendação relevante

---

## Roadmap de Desenvolvimento

### Fase 1: Setup e Fundação
- [ ] Configurar estrutura base do projeto (React Native + Expo)
- [ ] Configurar TypeScript e linting
- [ ] Definir estrutura de pastas

### Fase 2: Core - Escaneamento
- [ ] Implementar leitor de código de barras/QR code
- [ ] Criar parser para extrair dados do cupom fiscal
- [ ] Desenvolver tela de escaneamento

### Fase 3: Persistência de Dados
- [ ] Configurar banco de dados local (SQLite/Realm/WatermelonDB)
- [ ] Implementar modelos de dados (cupons, produtos, estabelecimentos)
- [ ] Criar camada de serviços para acesso aos dados

### Fase 4: Interface Básica
- [ ] Desenvolver tela de detalhes do cupom
- [ ] Desenvolver tela de histórico de compras
- [ ] Implementar navegação entre telas

### Fase 5: Analytics Engine
- [ ] Implementar engine de análise de preços por mercado
- [ ] Implementar análise de preços por produto
- [ ] Implementar análise de descontos

### Fase 6: Dashboard e Visualizações
- [ ] Desenvolver dashboard de estatísticas
- [ ] Criar visualizações gráficas (charts) para comparações
- [ ] Implementar sistema de recomendação de mercados

### Fase 7: Funcionalidades Avançadas
- [ ] Implementar busca e filtros de produtos/estabelecimentos
- [ ] Adicionar funcionalidade de exportação de dados
- [ ] Implementar notificações de ofertas

### Fase 8: Qualidade e Performance
- [ ] Adicionar testes unitários e de integração
- [ ] Otimizar performance e UX do aplicativo
- [ ] Implementar tratamento de erros robusto

---

## Tecnologias por Funcionalidade

| Funcionalidade | Tecnologia Recomendada |
|----------------|------------------------|
| Escaneamento QR | expo-camera + expo-barcode-scanner |
| Parser NFCe | Regex + XML parsing |
| Banco de Dados | WatermelonDB ou Realm |
| Navegação | React Navigation v6 |
| Charts | Victory Native |
| UI Components | React Native Paper |
| State Management | React Context + Hooks |
| Análise de Dados | Lodash + Algoritmos customizados |
| Datas | date-fns |

---

## Considerações Importantes

### Privacidade
- Todos os dados armazenados localmente no dispositivo
- Não enviar dados sensíveis para servidores externos
- Opção de limpar dados do usuário

### UX/UI
- Interface intuitiva e rápida
- Feedback visual durante escaneamento
- Modo offline completo

### Escalabilidade
- Otimização para lidar com milhares de cupons
- Indexação eficiente do banco de dados
- Lazy loading de listas grandes

---

## Próximos Passos Imediatos

1. Criar projeto React Native com Expo
2. Configurar TypeScript e estrutura de pastas
3. Implementar protótipo de scanner
4. Testar parser com cupom fiscal real
5. Configurar banco de dados local
