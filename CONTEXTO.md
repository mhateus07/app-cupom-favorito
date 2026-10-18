# Contexto do Cupom Favorito

Arquivo para retomar o trabalho entre sessões. Atualize ao fim de cada sessão.

## O que é

App React Native (Expo SDK 58) que lê o QR Code da NFC-e, guarda os cupons no
celular (SQLite) e compara preços entre mercados. Desde 18/10/2026 tem conta
opcional com sincronização na nuvem (API própria na VPS Contabo).

## Estado em 18/10/2026

### Branches e PRs (empilhados, mesclar nesta ordem)

| PR | Branch | Conteúdo |
|---|---|---|
| #2 | `feat/lista-comparacao-alertas` | Lista de compras, comparação de produtos, PDF/backup, localização, alertas automáticos |
| #3 | `feat/planejamento-completo` | Revisão do cupom antes de salvar, tutorial, alertas configuráveis, distância na recomendação, gráfico de preço, projeção de gastos, inflação da cesta, CI |
| #4 | `feat/conta-sincronizacao` | API (`server/`), conta com e-mail e senha, sincronização, tela de conta |

Nenhum foi mesclado na `main` ainda. Ao mesclar um, o GitHub só muda a base do
seguinte para `main` se a branch mesclada for apagada.

### App

- Banco local na versão **v7** (`src/services/database/database.ts`, array `MIGRATIONS`).
- Sincronização: toda alteração local entra em `sync_pendentes`; `src/services/sync/`
  envia a fila e aplica o que vem do servidor. Conflito: vale o `atualizadoEm` mais recente.
- A API padrão é `https://api.cupom.impulsiodigital.com` (troque com `EXPO_PUBLIC_API_URL`).
- Testes: `npm test` (50), `npm run lint`, `npm run typecheck`.

### API (`server/`)

- Fastify + PostgreSQL 16. Rotas e protocolo de sincronização em `server/README.md`.
- Produção: VPS Contabo `173.212.208.109`, pasta `/opt/cupom-favorito`, containers
  `cupom-favorito-api` e `cupom-favorito-postgres` (só em `127.0.0.1:5470`).
  HTTPS pelo Traefik do EasyPanel. Segredos só no `.env` da VPS.
- Deploy: `sh server/deploy/deploy.sh [origin/<branch>]` (faz backup do banco antes).
- DNS: registro A `api.cupom` na Hostinger, TTL 3600. Certificado Let's Encrypt até 16/01/2027.
- Se o primeiro certificado falhar (ex.: DNS criado depois do deploy), o Traefik não
  tenta de novo sozinho: `docker compose restart api` em `/opt/cupom-favorito`.
- Testes: `DATABASE_URL_TESTE=... npm test` dentro de `server/` (14, precisam de Postgres).

### Ambiente (Mac com Xcode 27)

- Não há o app Simulator: o substituto é o DeviceHub. `npx expo run:ios` falha; compilar
  com `xcodebuild` e instalar com `xcrun simctl install` (simulador) ou
  `xcrun devicectl device install app` (iPhone).
- A pasta `ios/` é gerada (fora do git). Depois de instalar um pacote nativo, rode
  `npx expo prebuild -p ios` antes de compilar.
- O iPhone usa conta Apple gratuita: o app instalado vale 7 dias e precisa ser reinstalado.
  Build: `xcodebuild ... -configuration Release -destination id=<UDID>
  DEVELOPMENT_TEAM=FLYUDYHKDQ CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates build`.
- A conta gratuita não aceita a permissão de push (`aps-environment`), que o
  `expo-notifications` coloca em `ios/cupomfavorito/cupomfavorito.entitlements`. Para o
  iPhone, apague essa chave depois de cada `prebuild` (o app só usa notificações locais).

## Pendências

1. **E-mail da recuperação de senha:** nenhum SMTP configurado. Opções: a chave da
   Resend do Amigofit (precisa de autorização e domínio verificado) ou outro SMTP.
   Preencher `SMTP_URL` em `/opt/cupom-favorito/.env` e rodar o deploy de novo.
2. **Teste real da SEFAZ** com o link do QR Code de um cupom (sem dados pessoais em fixture).
3. **Testar no app** login e sincronização entre dois aparelhos (no simulador, os toques
   automáticos precisam do AXe, que só deve ser reinstalado com autorização).
4. **API fiscal comercial** para o `NfceProvider` e suporte ao layout de MG.
5. **LGPD:** a Contabo não tem datacenter no Brasil; avaliar migrar antes de publicar o app.
6. Itens restantes do `docs/ROADMAP.md` (normalização automática de produtos, ranking
   por preço + distância, correção manual de endereço, comparação livre entre períodos).
