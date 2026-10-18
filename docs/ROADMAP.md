# Roadmap do Cupom Favorito

Este documento registra o que ainda falta para levar o aplicativo de uma versão local funcional para uma versão completa de produção.

## Já concluído no app local

- Escaneamento de NFC-e e armazenamento local em SQLite.
- Histórico, busca, filtros por mercado, período e valor.
- Favoritos, observações, exclusão e backup/restauração.
- Comparação de preços por produto e ranking de mercados.
- Evolução mensal com gráfico visual.
- Lista de compras com estimativa de cesta por mercado.
- Relatório PDF compartilhável.
- Geolocalização opcional dos estabelecimentos.
- Camada `NfceProvider` configurável para API externa da SEFAZ.
- Tutorial na primeira abertura.
- Revisão do cupom antes de salvar, com correção do nome do mercado e dos produtos.
- Correção manual de nomes de produtos, lembrada nos próximos cupons.
- Alertas de preço configuráveis: produtos monitorados, preço-alvo, queda mínima, sem avisos repetidos e histórico de alertas enviados.
- Distância até o mercado no score de recomendação.
- Gráfico de evolução de preço por produto, projeção de gastos do mês e inflação da cesta pessoal.
- Integração contínua (lint, checagem de tipos e testes) no GitHub Actions.

## Próxima prioridade: backend e produção

### 1. Backend real

- Criar cadastro, login e recuperação de conta.
- Sincronizar cupons, produtos, listas e preferências na nuvem.
- Permitir uso em múltiplos dispositivos.
- Definir API, banco, autenticação, logs e política de privacidade.
- Armazenar credenciais de fornecedores somente no backend.

### 2. Integração fiscal completa

- Conectar uma API comercial ou backend próprio ao `NfceProvider`.
- Implementar suporte aos layouts estaduais ainda incompatíveis, como MG.
- Tratar CAPTCHA, indisponibilidade e limites de consulta.
- Testar cupons reais de diferentes estados e versões de QR Code.

## Melhorias de produto

### 3. Normalização inteligente de produtos

- Normalizar marca, categoria, unidade e embalagem (ex.: "ARROZ TIO JOAO 5KG").
- Agrupar automaticamente nomes equivalentes sem código de barras.
- Avaliar uma camada de ML somente após formar uma base de dados confiável.

### 4. Geolocalização e recomendação

- Ordenar o ranking de mercados por combinação de preço, distância e frequência.
- Permitir corrigir endereço ou coordenadas manualmente.
- Considerar rotas e tempo de deslocamento em uma etapa futura.

### 5. Análises avançadas

- Comparação livre entre dois períodos escolhidos pelo usuário.
- Exportação de análises filtradas.

## Validação e qualidade

- Testar o fluxo completo em aparelhos iOS e Android reais.
- Validar permissões de câmera, localização e notificações.
- Testar migrações SQLite a partir de versões antigas.
- Criar testes de integração para consulta SEFAZ e importação de backups.
- Revisar as vulnerabilidades apontadas pelo npm sem aplicar correções quebradoras automaticamente.

## Ordem recomendada

1. Backend, autenticação e sincronização.
2. API fiscal real e cobertura dos estados.
3. Testes em dispositivos e endurecimento de segurança.
4. Normalização inteligente, recomendação e análises restantes.

## Critérios para considerar a versão de produção pronta

- Usuário consegue criar conta, trocar de aparelho e recuperar os dados.
- Consulta fiscal funciona com fallback e fornecedor configurado.
- Permissões e falhas de rede são tratadas sem perda de dados.
- Cupons e produtos têm testes de integração representativos.
- Política de privacidade, backup e exclusão de conta estão implementados.
