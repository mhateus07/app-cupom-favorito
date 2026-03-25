# 🚀 Como Rodar o App - Guia Rápido

## Opção 1: Testar no Navegador (Mais Fácil) ⭐

```bash
cd /Users/mateus/ola_mundo/app_cupom_favorito
npm run web
```

Isso abrirá o app automaticamente no navegador!

**Nota**: No navegador, a câmera pode não funcionar perfeitamente, mas você consegue ver a interface e navegação.

---

## Opção 2: Usar no Celular com Expo Go

### Passo 1: Instalar Expo Go

- **Android**: Play Store → buscar "Expo Go"
- **iPhone**: App Store → buscar "Expo Go"

### Passo 2: Abrir novo terminal e executar:

```bash
cd /Users/mateus/ola_mundo/app_cupom_favorito
npx expo start
```

### Passo 3: Aguardar o QR Code aparecer

Você verá algo assim:

```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

█▀▀▀▀▀█ ▀▀  █▄ ▀ █▀▀▀▀▀█
█ ███ █ ▀█▀▄ ▀█▀▀ █ ███ █
█ ▀▀▀ █ ▄▄ ██▄ ▄ █ ▀▀▀ █
▀▀▀▀▀▀▀ █ ▀ █ █ █ ▀▀▀▀▀▀
```

### Passo 4: Escanear com o celular

- **Android**: Abra Expo Go → toque "Scan QR Code"
- **iPhone**: Abra Câmera nativa → aponte para QR code

---

## Opção 3: Usar Emulador/Simulator

### Android (precisa ter Android Studio):
```bash
npm run android
```

### iOS (só Mac, precisa Xcode):
```bash
npm run ios
```

---

## ⚠️ Problemas Comuns

### 1. "Metro bundler não inicia"
```bash
# Limpar cache e reinstalar
rm -rf node_modules
npm install
npx expo start --clear
```

### 2. "Porta 8081 ocupada"
```bash
# Matar processo na porta
lsof -ti:8081 | xargs kill -9
npx expo start
```

### 3. "QR Code não aparece"
- Aguarde 1-2 minutos para o Metro Bundler inicializar
- Pressione 'r' no terminal para recarregar
- Tente: `npx expo start --clear`

### 4. "Celular não conecta"
- Certifique-se que celular e computador estão na mesma rede Wi-Fi
- Tente modo tunnel: `npx expo start --tunnel`

---

## 🎯 Comandos Úteis no Terminal do Expo

Quando o servidor estiver rodando, você pode pressionar:

- `w` - Abrir no navegador web
- `a` - Abrir no emulador Android
- `i` - Abrir no simulador iOS
- `r` - Recarregar app
- `m` - Alternar menu
- `c` - Limpar console
- `?` - Mostrar ajuda

---

## 💡 Recomendação

Para começar rapidamente, use:

```bash
npm run web
```

Isso abre direto no navegador e você pode testar a navegação e interface!
