# Guia de Desenvolvimento

## Visão Geral Técnica

Este documento contém informações técnicas para desenvolvedores que desejam contribuir ou estender o projeto.

## Arquitetura

### Camada de Apresentação (Screens)

- **ScanScreen**: Gerencia o escaneamento de QR Codes
- **HistoryScreen**: Lista todos os cupons salvos
- **CupomDetailScreen**: Exibe detalhes de um cupom específico
- **StatsScreen**: Dashboard de estatísticas e análises

### Camada de Serviços

#### Scanner Service
```typescript
// Hook customizado para escaneamento
const { hasPermission, scanned, handleBarCodeScanned, resetScanner } = useScanner(onScan);
```

#### Parser Service
```typescript
// Parse QR Code
const parsedQR = parseQRCode(qrCodeData);

// Parse XML NFCe (simulado por enquanto)
const cupomData = await parseNFCeXML(chaveAcesso, url);

// Normalizar nome de produto
const nomeNormalizado = normalizeProdutoNome(nome);
```

#### Database Service
```typescript
// Inicializar banco
await initDatabase();

// Inserir cupom
const cupomId = await insertCupom(cupomData);

// Buscar todos os cupons
const cupons = await getAllCupons();

// Buscar cupom por ID
const cupom = await getCupomById(id);

// Deletar cupom
await deleteCupom(id);
```

#### Analytics Service
```typescript
// Análise de produtos
const produtosStats = analisarProdutos(cupons);

// Análise de estabelecimentos
const estabelecimentosStats = analisarEstabelecimentos(cupons);

// Resumo geral
const resumo = gerarResumoGeral(cupons);

// Gerar recomendações
const recomendacoes = gerarRecomendacoes(cupons);

// Comparar preços
const comparacao = compararPrecoProduto('arroz', cupons);

// Produtos com maior variação
const variacoes = produtosComMaiorVariacao(cupons);
```

## Banco de Dados

### Esquema

**Tabela: estabelecimentos**
```sql
CREATE TABLE estabelecimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Tabela: cupons**
```sql
CREATE TABLE cupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chave_acesso TEXT UNIQUE NOT NULL,
  qr_code TEXT NOT NULL,
  estabelecimento_id INTEGER NOT NULL,
  data TEXT NOT NULL,
  subtotal REAL NOT NULL,
  desconto_total REAL NOT NULL,
  total REAL NOT NULL,
  forma_pagamento TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (estabelecimento_id) REFERENCES estabelecimentos (id)
);
```

**Tabela: produtos**
```sql
CREATE TABLE produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cupom_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL,
  codigo TEXT NOT NULL,
  preco REAL NOT NULL,
  quantidade REAL NOT NULL,
  desconto REAL NOT NULL,
  preco_final REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cupom_id) REFERENCES cupons (id)
);
```

### Índices

- `idx_cupons_data`: Otimiza buscas por data
- `idx_cupons_estabelecimento`: Otimiza joins com estabelecimentos
- `idx_produtos_cupom`: Otimiza busca de produtos por cupom
- `idx_produtos_nome`: Otimiza buscas por nome de produto
- `idx_produtos_codigo`: Otimiza buscas por código de barras

## Adicionando Novas Funcionalidades

### 1. Nova Tela

```typescript
// src/screens/MinhaNovaScreen.tsx
import React from 'react';
import { View, Text } from 'react-native';

export const MinhaNovaScreen: React.FC = () => {
  return (
    <View>
      <Text>Minha Nova Tela</Text>
    </View>
  );
};
```

Adicione ao navegador:
```typescript
// src/navigation/AppNavigator.tsx
import { MinhaNovaScreen } from '../screens/MinhaNovaScreen';

// Adicione ao Stack ou Tab Navigator
```

### 2. Novo Serviço de Análise

```typescript
// src/services/analytics/novaAnalise.ts
import { CupomData } from '../../models/types';

export const minhaNovaAnalise = (cupons: CupomData[]) => {
  // Implementar lógica de análise
  return resultado;
};
```

### 3. Novo Hook Customizado

```typescript
// src/hooks/useMeuHook.ts
import { useState, useEffect } from 'react';

export const useMeuHook = () => {
  const [state, setState] = useState(null);

  useEffect(() => {
    // Lógica do hook
  }, []);

  return { state, setState };
};
```

## Integração com API SEFAZ (Futuro)

Para implementar busca real de dados NFCe:

```typescript
// src/services/parser/sefazApi.ts
export const buscarNFCe = async (chaveAcesso: string, uf: string) => {
  const urls = {
    SP: 'https://www.fazenda.sp.gov.br/nfce/consulta',
    // Outros estados...
  };

  const response = await fetch(urls[uf], {
    method: 'POST',
    body: { chaveAcesso },
  });

  const xml = await response.text();
  return parseXML(xml);
};
```

## Performance

### Otimizações Implementadas

1. **Lazy Loading**: Listas grandes usam FlatList com virtualização
2. **Índices no DB**: Queries otimizadas com índices
3. **Memoização**: Componentes otimizados com useMemo/useCallback
4. **Debounce**: Buscas com debounce para reduzir queries

### Métricas Recomendadas

- Tempo de escaneamento: < 2s
- Tempo de carregamento de lista: < 500ms
- Tempo de análise de dados: < 1s (até 1000 cupons)

## Testes

### Estrutura de Testes (a implementar)

```typescript
// tests/services/analytics.test.ts
import { analisarProdutos } from '../../src/services/analytics/analyticsService';

describe('Analytics Service', () => {
  it('deve calcular preço médio corretamente', () => {
    const mockCupons = [...];
    const resultado = analisarProdutos(mockCupons);
    expect(resultado[0].precoMedio).toBe(25.90);
  });
});
```

### Executar Testes (quando implementado)

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Deploy

### Build para Produção

```bash
# Android
eas build --platform android

# iOS
eas build --platform ios

# Ambos
eas build --platform all
```

### Variáveis de Ambiente

Crie arquivo `.env`:
```
SEFAZ_API_KEY=sua_chave_api
ENVIRONMENT=production
```

## Debugging

### Expo DevTools

```bash
npm start
# Pressione 'd' para abrir DevTools
```

### React Native Debugger

1. Instale React Native Debugger
2. Execute o app
3. Shake device → Debug

### Logs do Banco de Dados

```typescript
// Ativar logs SQL
import * as SQLite from 'expo-sqlite';

const db = await SQLite.openDatabaseAsync(DB_NAME, {
  enableChangeListener: true,
});

db.onDatabaseChange(() => {
  console.log('Database changed');
});
```

## Boas Práticas

1. **TypeScript**: Sempre definir tipos explícitos
2. **Async/Await**: Usar try/catch para tratamento de erros
3. **Componentes**: Manter componentes pequenos e reutilizáveis
4. **Hooks**: Extrair lógica complexa para hooks customizados
5. **Comentários**: Documentar funções complexas com JSDoc

## Recursos Úteis

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Paper](https://reactnativepaper.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [NFCe Documentation](http://www.nfe.fazenda.gov.br/portal/principal.aspx)

## Contribuindo

Veja o arquivo [PLANEJAMENTO.md](./PLANEJAMENTO.md) para o roadmap completo do projeto.
