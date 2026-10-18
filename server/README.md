# API do Cupom Favorito

Conta (e-mail e senha) e sincronização dos dados do app entre aparelhos.
Fastify + PostgreSQL, publicada na VPS Contabo em `https://api.cupom.impulsiodigital.com`.

## Rotas

| Rota | O que faz |
|---|---|
| `GET /saude` | Confere a API e o banco |
| `POST /auth/cadastro` | Cria a conta (`email`, `senha` com 8+ caracteres) |
| `POST /auth/entrar` | Entra e recebe `accessToken` (15 min) e `refreshToken` (90 dias) |
| `POST /auth/renovar` | Troca o `refreshToken` por um par novo (o antigo deixa de valer) |
| `POST /auth/sair` | Encerra a sessão do aparelho |
| `POST /auth/esqueci-senha` | Envia um código de 6 dígitos por e-mail (vale 15 min, 5 tentativas) |
| `POST /auth/redefinir-senha` | Troca a senha com o código e encerra todas as sessões |
| `GET /conta` | Dados da conta |
| `DELETE /conta` | Exclui a conta e todos os dados (pede a senha) |
| `POST /sync` | Envia as alterações do aparelho e recebe as que vieram de outros |

## Sincronização

Cada entidade do app vira um registro `(tipo, chave)`: `cupom` (chave de acesso),
`item_lista` (uuid), `monitorado` (chave do produto) e `apelido` (nome original).
O aparelho envia o que mudou e o seu cursor; a API grava e devolve tudo com `seq`
maior que o cursor. Em conflito vale o `atualizadoEm` mais recente (limitado ao
horário do servidor). Exclusões ficam marcadas para chegar aos outros aparelhos.

## Desenvolvimento

```bash
cd server
npm install
docker run -d --name cupom-pg-teste -e POSTGRES_PASSWORD=teste -p 127.0.0.1:55432:5432 postgres:16-alpine
DATABASE_URL_TESTE=postgres://postgres:teste@127.0.0.1:55432/postgres npm test
```

## Deploy

```bash
sh server/deploy/deploy.sh                  # origin/main
sh server/deploy/deploy.sh origin/<branch>  # outra branch já enviada ao GitHub
```

Na primeira vez, o script gera `/opt/cupom-favorito/.env` na VPS com senha do banco
e `JWT_SECRET`. Para a recuperação de senha funcionar, preencha `SMTP_URL` nesse
arquivo (ex.: `smtps://usuario:senha@smtp.servidor.com:465`) e rode o deploy de novo.
