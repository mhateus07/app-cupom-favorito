# 📱 Como Usar o App Cupom Favorito

## ⚠️ IMPORTANTE: Este app NÃO funciona no navegador!

O App Cupom Favorito usa recursos nativos do celular (câmera para escanear QR Code e banco de dados SQLite) que **não estão disponíveis no navegador web**.

---

## ✅ Passo a Passo para Rodar no Celular

### 1️⃣ Instale o Expo Go

**No Android:**
1. Abra a **Play Store**
2. Busque por **"Expo Go"**
3. Instale o aplicativo

**No iPhone:**
1. Abra a **App Store**
2. Busque por **"Expo Go"**
3. Instale o aplicativo

---

### 2️⃣ Certifique-se que o computador e celular estão na mesma rede Wi-Fi

**Importante:** Ambos os dispositivos precisam estar conectados à **mesma rede Wi-Fi** para funcionar.

---

### 3️⃣ No Computador (Terminal)

Abra o terminal na pasta do projeto e execute:

```bash
cd /Users/mateus/ola_mundo/app_cupom_favorito
npx expo start
```

Aguarde 1-2 minutos. Você verá algo assim:

```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

█▀▀▀▀▀█ ▀▀  █▄ ▀ █▀▀▀▀▀█
█ ███ █ ▀█▀▄ ▀█▀▀ █ ███ █
█ ▀▀▀ █ ▄▄ ██▄ ▄ █ ▀▀▀ █
▀▀▀▀▀▀▀ █ ▀ █ █ █ ▀▀▀▀▀▀
... (QR Code em ASCII) ...
```

---

### 4️⃣ No Celular

**Android:**
1. Abra o app **Expo Go**
2. Toque em **"Scan QR Code"**
3. Aponte a câmera para o QR Code no terminal
4. Aguarde o app carregar (pode demorar 1-2 minutos na primeira vez)

**iPhone:**
1. Abra a **Câmera** nativa do iPhone
2. Aponte para o QR Code no terminal
3. Toque na notificação que aparecer
4. O app abrirá no Expo Go

---

## 🎯 Usando o App

### Funcionalidades Disponíveis:

1. **📸 Escanear Cupom**
   - Toque no botão **"+"** (FAB)
   - Aponte a câmera para o QR Code do cupom fiscal
   - O app salvará automaticamente

2. **📜 Histórico**
   - Veja todos os cupons escaneados
   - Toque em um cupom para ver detalhes
   - Pull-to-refresh para atualizar

3. **📊 Estatísticas**
   - Resumo geral de gastos
   - Mercado favorito
   - Produto mais comprado
   - Economia com descontos

4. **🏆 Recomendações**
   - Sistema com score 0-100
   - Ranking de mercados mais baratos
   - Produtos com melhores preços

---

## ❓ Problemas Comuns

### QR Code não aparece no terminal

**Solução:**
- Aguarde 1-2 minutos
- Se não aparecer, pressione `r` no terminal
- Ou tente: `npx expo start --clear`

### Celular não conecta

**Solução:**
- Certifique que celular e computador estão na **mesma rede Wi-Fi**
- Tente modo tunnel: `npx expo start --tunnel`
- Verifique o firewall do computador

### App demora muito para carregar

**Normal:**
- Na primeira vez pode demorar 2-3 minutos
- Próximas vezes será mais rápido
- Aguarde pacientemente

### Erro no escaneamento

**O app está usando dados mockados por enquanto:**
- O parser ainda não está integrado com API real da SEFAZ
- Ao escanear, você verá dados de exemplo
- A funcionalidade de análise e estatísticas funciona normalmente

---

## 🔧 Comandos Úteis no Terminal

Quando o servidor Expo estiver rodando, você pode pressionar:

- **`w`** - Tentar abrir no web (não recomendado para este app)
- **`a`** - Abrir no emulador Android (precisa Android Studio)
- **`i`** - Abrir no simulador iOS (precisa Xcode, só Mac)
- **`r`** - Recarregar app
- **`m`** - Alternar menu
- **`c`** - Limpar console
- **`Ctrl+C`** - Parar servidor

---

## 📸 Testando com Cupom Real

Para testar com um cupom fiscal real:

1. Faça uma compra em qualquer estabelecimento
2. Peça o cupom fiscal (NFCe)
3. Localize o QR Code impresso no cupom
4. Abra o app e toque no botão "+"
5. Escaneie o QR Code

**Nota:** Por enquanto, o app mostrará dados mockados mesmo com cupom real, pois a integração com a API SEFAZ ainda não foi implementada.

---

## 🚀 Próximos Passos do Projeto

- [ ] Integrar com API SEFAZ para dados reais
- [ ] Implementar normalização inteligente de produtos
- [ ] Adicionar gráficos visuais
- [ ] Sistema de exportação (CSV, PDF)
- [ ] Geolocalização para recomendações
- [ ] Notificações de ofertas

---

## 📞 Suporte

Se tiver problemas:

1. Leia este guia completo
2. Verifique se seguiu todos os passos
3. Certifique que celular e PC estão na mesma rede Wi-Fi
4. Tente reiniciar o servidor: `Ctrl+C` depois `npx expo start`

---

**Desenvolvido com React Native + Expo + TypeScript**
