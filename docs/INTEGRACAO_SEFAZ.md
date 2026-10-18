# 📡 Integração com API SEFAZ - NFCe

## Visão Geral

Este documento descreve a integração com a API SEFAZ para consulta de Notas Fiscais de Consumidor Eletrônicas (NFCe).

---

## 🔍 Como Funciona o QR Code da NFCe

### Estrutura do QR Code

O QR Code impresso no cupom fiscal contém uma **URL de consulta** que leva ao portal da SEFAZ do estado emissor.

**Exemplo de URL:**
```
http://www.fazenda.sp.gov.br/nfce/qrcode?p=35210812345678901234550010000123451234567890|2|1|1|E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855
```

### Parâmetros da URL

A URL contém parâmetros separados por `|` ou como query params:

- **Chave de Acesso (44 dígitos)**: Identificador único da NFCe
- **Versão**: Versão do QR Code (2 ou 3)
- **Ambiente**: 1 = Produção, 2 = Homologação
- **ID Token**: Identificador do CSC
- **Hash**: Código de segurança (até v2, removido em v3)

---

## 📋 Mudanças em 2025 - QR Code v3

### Nota Técnica 2025.001

A partir de **01/09/2025**, todas as NFCe devem usar **QR Code versão 3**:

**Principais mudanças:**
- ❌ **CSC (Código de Segurança) não é mais usado**
- ✅ **Segurança garantida por assinatura digital** do certificado da empresa
- ✅ **URL simplificada** sem hash CSC

**Prazos:**
- **02/06/2025**: Disponível em homologação
- **01/09/2025**: Obrigatório em produção

**Mudança adicional (03/11/2025):**
- NFCe não poderá mais ser emitida para clientes com CNPJ
- NFCe será exclusiva para CPF (pessoa física)

---

## 🌐 URLs de Consulta por Estado

### Principais Estados

#### São Paulo (SP)
```
Produção: https://www.fazenda.sp.gov.br/nfce/consulta
Homologação: https://homologacao.nfce.fazenda.sp.gov.br/NFCeConsultaPublica
```

#### Rio de Janeiro (RJ)
```
Produção: http://www4.fazenda.rj.gov.br/consultaNFCe/QRCode
```

#### Minas Gerais (MG)
```
Produção: http://nfce.fazenda.mg.gov.br/portalnfce
```

#### Rio Grande do Sul (RS)
```
Produção: https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx
```

#### Paraná (PR)
```
Produção: http://www.fazenda.pr.gov.br/nfce/qrcode
```

---

## 📦 Estrutura do XML da NFCe

### Tags Principais

```xml
<nfeProc>
  <NFe>
    <infNFe>
      <ide>
        <!-- Informações gerais -->
        <cUF>35</cUF>                    <!-- Código UF -->
        <natOp>VENDA</natOp>             <!-- Natureza operação -->
        <mod>65</mod>                    <!-- Modelo (65 = NFCe) -->
        <serie>1</serie>
        <nNF>123</nNF>                   <!-- Número da nota -->
        <dhEmi>2025-01-15T10:30:00</dhEmi> <!-- Data/hora emissão -->
      </ide>

      <emit>
        <!-- Dados do emitente (estabelecimento) -->
        <CNPJ>12345678000190</CNPJ>
        <xNome>Supermercado XYZ Ltda</xNome>
        <xFant>Mercado XYZ</xFant>
        <enderEmit>
          <xLgr>Rua das Flores</xLgr>
          <nro>123</nro>
          <xBairro>Centro</xBairro>
          <cMun>3550308</cMun>
          <xMun>São Paulo</xMun>
          <UF>SP</UF>
          <CEP>01234567</CEP>
        </enderEmit>
      </emit>

      <det nItem="1">
        <!-- Produtos (múltiplos <det>) -->
        <prod>
          <cProd>001</cProd>             <!-- Código produto -->
          <cEAN>7891234567890</cEAN>     <!-- Código de barras -->
          <xProd>Arroz Tipo 1 5kg</xProd> <!-- Descrição -->
          <NCM>10063021</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>                <!-- Unidade -->
          <qCom>1.0000</qCom>            <!-- Quantidade -->
          <vUnCom>15.90</vUnCom>         <!-- Valor unitário -->
          <vProd>15.90</vProd>           <!-- Valor total -->
          <vDesc>0.00</vDesc>            <!-- Desconto -->
        </prod>
        <imposto>
          <ICMS>
            <ICMSSN102>
              <orig>0</orig>
              <CSOSN>102</CSOSN>
            </ICMSSN102>
          </ICMS>
        </imposto>
      </det>

      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vProd>15.90</vProd>           <!-- Total produtos -->
          <vDesc>0.00</vDesc>            <!-- Total descontos -->
          <vNF>15.90</vNF>               <!-- Valor total NFCe -->
        </ICMSTot>
      </total>

      <pag>
        <!-- Formas de pagamento -->
        <detPag>
          <tPag>01</tPag>                <!-- 01=Dinheiro, 03=Cartão Crédito, etc -->
          <vPag>15.90</vPag>
        </detPag>
      </pag>
    </infNFe>
  </NFe>

  <infNFeSupl>
    <qrCode><![CDATA[http://www.fazenda.sp.gov.br/nfce/qrcode?p=...]]></qrCode>
  </infNFeSupl>
</nfeProc>
```

---

## 🔑 Extração da Chave de Acesso

A chave de acesso possui **44 dígitos** e contém informações codificadas:

### Estrutura (44 dígitos):
```
35 21 08 12345678 65 001 000012345 1 23456789 0
│  │  │  │        │  │   │         │ │        │
│  │  │  │        │  │   │         │ │        └─ Dígito verificador
│  │  │  │        │  │   │         │ └────────── Código numérico
│  │  │  │        │  │   │         └──────────── Tipo emissão
│  │  │  │        │  │   └────────────────────── Número da NF
│  │  │  │        │  └────────────────────────── Série
│  │  │  │        └───────────────────────────── Modelo (65=NFCe)
│  │  │  └────────────────────────────────────── CNPJ emitente
│  │  └───────────────────────────────────────── Ano/mês emissão
│  └──────────────────────────────────────────── Mês emissão
└─────────────────────────────────────────────── Código UF

```

### Decodificação:
- **Posições 0-1**: UF (35 = SP, 33 = RJ, 31 = MG, etc)
- **Posições 2-7**: AAMM (Ano e Mês de emissão)
- **Posições 8-21**: CNPJ do emitente
- **Posições 22-23**: Modelo (65 = NFCe)
- **Posições 24-26**: Série
- **Posições 27-35**: Número da NF
- **Posições 36-36**: Tipo de emissão
- **Posições 37-44**: Código numérico + DV

---

## 🚀 Estratégias de Implementação

### Opção 1: API Comercial (Recomendado para produção)
**Serviços disponíveis:**
- **Webmania** (https://webmaniabr.com)
- **Focus NFE** (https://focusnfe.com.br)
- **NFE.io** (https://nfe.io)

**Vantagens:**
- ✅ Fácil integração via REST API
- ✅ Suporte técnico
- ✅ Atualização automática de legislação
- ✅ Certificados digitais gerenciados

**Desvantagens:**
- ❌ Custo mensal (planos pagos)

---

### Opção 2: Scraping do Portal SEFAZ (Implementação atual)
**Como funciona:**
1. Extrair URL do QR Code escaneado
2. Fazer requisição HTTP para a URL
3. Fazer parsing do HTML retornado
4. Extrair dados do cupom

**Vantagens:**
- ✅ Gratuito
- ✅ Não precisa de certificado digital
- ✅ Funciona para consulta pública

**Desvantagens:**
- ❌ Depende da estrutura HTML do site (pode quebrar)
- ❌ Pode ter CAPTCHA
- ❌ Limitações de taxa de requisição
- ❌ Não retorna XML completo (apenas visualização)

---

### Opção 3: API Oficial SEFAZ (Mais complexo)
**Requer:**
- Certificado digital A1 ou A3
- Implementação de Web Services SOAP
- Validação de assinatura digital
- Conhecimento de schemas XSD

**Vantagens:**
- ✅ Dados oficiais completos
- ✅ XML completo com assinatura
- ✅ Gratuito (após investimento inicial)

**Desvantagens:**
- ❌ Complexidade alta
- ❌ Precisa de certificado digital (custo)
- ❌ Implementação trabalhosa

---

## 📱 Implementação Recomendada para o App

Para o **App Cupom Favorito**, vamos usar uma **abordagem híbrida**:

### Fase 1: Extração de dados do QR Code ✅
- Extrair chave de acesso do QR Code (parâmetro `p`, QR Code v2 e v3)
- Validar o dígito verificador (módulo 11) da chave
- Identificar UF e CNPJ do emitente a partir da chave

### Fase 2: Consulta simplificada ✅ (atual)
- Requisição HTTP para a URL do QR Code (`src/services/sefaz/sefazService.ts`)
- Se a resposta trouxer o XML (`nfeProc`), ele é lido com `fast-xml-parser`, mantendo
  todos os valores como texto para não perder zeros à esquerda (CNPJ, GTIN, CEP)
- Senão, o HTML é lido no layout padrão da consulta pública (tabela `tabResult`,
  classes `txtTit`, `RCod`, `Rqtd`, `RvlUnit`, `valor`, `totalNumb`), usado pela maioria
  das SEFAZ (`src/services/sefaz/nfceExtractor.ts`)
- **Se nada disso funcionar, o cupom não é salvo** e o usuário vê o motivo. O app nunca
  grava dados fictícios.

Limitações conhecidas: portais com CAPTCHA ou com layout próprio (ex.: MG) ainda não são
lidos. O HTML só informa o desconto total da nota, não o desconto de cada item.

### Fase 3: Integração com API comercial (Futuro)
- Integrar com Webmania ou Focus NFE
- Obter XML completo da NFCe
- Parser completo de todos os dados

---

## 🛠️ Dependências Necessárias

```bash
npm install fast-xml-parser       # Parser de XML
npm install axios                # Cliente HTTP
```

O HTML é lido com expressões regulares próprias (sem `cheerio`, que depende de APIs do
Node.js indisponíveis no React Native).

---

## 📚 Referências

- [Portal NFCe - SEFAZ](https://www.nfe.fazenda.gov.br/portal/principal.aspx)
- [Nota Técnica 2025.001 - QR Code v3](https://desenvolvedores.migrate.info/2025/07/qr-code-versao-3-para-nfc-e/)
- [Schemas XML NFCe](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w%3D)
- [nfephp-org/sped-nfe](https://github.com/nfephp-org/sped-nfe)
- [Webmania API Docs](https://webmaniabr.com/docs/rest-api-consulta-nota-fiscal/)

---

**Última atualização:** Outubro 2026

## Provedor configurável para produção

O aplicativo consulta o portal público da SEFAZ por padrão. Para produção, uma API comercial ou um backend próprio pode ser conectado sem alterar o parser: `consultarNFCe` aceita um `provider` que implemente `NfceProvider`.

O provedor recebe a URL do QR Code, a chave de acesso e o `AbortSignal`. A resposta deve conter `success: true` e pelo menos um destes campos:

- `xmlContent`: XML da NFC-e, preferencialmente o XML autorizado;
- `htmlContent`: HTML da consulta, caso o fornecedor não entregue XML.

Exemplo de adaptação (o endpoint, autenticação e contrato ficam sob responsabilidade do backend):

```ts
const provider: NfceProvider = {
  nome: 'Backend NFC-e da empresa',
  consultar: async ({ chaveAcesso, signal }) => {
    const resposta = await axios.get(`${BACKEND_URL}/consulta`, {
      params: { chaveAcesso },
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal,
    });

    return {
      success: true,
      xmlContent: resposta.data.xml,
      chaveAcesso,
    };
  },
};

const cupom = await obterDadosCupom(chave, qrCode, { provider });
```

Não existe endpoint ou credencial fixa no aplicativo. Isso evita expor segredo no bundle e permite trocar o fornecedor depois, mantendo o mesmo fluxo de extração e validação dos produtos.
