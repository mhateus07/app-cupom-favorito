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
- Alertas locais de queda de preço.
- Camada `NfceProvider` configurável para API externa da SEFAZ.

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

- Criar aliases para nomes equivalentes.
- Normalizar marca, categoria, unidade e embalagem.
- Permitir correção manual pelo usuário.
- Avaliar uma camada de ML somente após formar uma base de dados confiável.

### 4. Alertas de preço

- Criar tela de produtos monitorados.
- Permitir definir preço-alvo e percentual mínimo de queda.
- Evitar notificações duplicadas.
- Exibir histórico de alertas enviados.

### 5. Geolocalização e recomendação

- Incorporar distância ao score de recomendação.
- Ordenar mercados por combinação de preço, distância e frequência.
- Permitir corrigir endereço ou coordenadas manualmente.
- Considerar rotas e tempo de deslocamento em uma etapa futura.

### 6. Análises avançadas

- Gráfico de evolução de preço por produto.
- Comparação entre períodos.
- Projeção de gastos mensais.
- Exportação de análises filtradas.
- Indicadores de inflação da cesta pessoal.

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
4. Alertas configuráveis e recomendação por distância.
5. Normalização inteligente e análises avançadas.

## Critérios para considerar a versão de produção pronta

- Usuário consegue criar conta, trocar de aparelho e recuperar os dados.
- Consulta fiscal funciona com fallback e fornecedor configurado.
- Permissões e falhas de rede são tratadas sem perda de dados.
- Cupons e produtos têm testes de integração representativos.
- Política de privacidade, backup e exclusão de conta estão implementados.
