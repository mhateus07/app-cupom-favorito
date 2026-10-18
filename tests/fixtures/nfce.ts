import { calcularDigitoVerificador } from '../../src/services/parser/cupomParser';

/** Monta uma chave de acesso válida (UF 35 = SP) para o CNPJ informado */
export const montarChave = (cnpj: string, numero = '000012345'): string => {
  const chave43 = `352610${cnpj}65001${numero}123456789`;
  return chave43 + calcularDigitoVerificador(chave43);
};

export const CNPJ_COM_ZERO = '06057223000171';

export const xmlNFCe = (chave: string) => `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe${chave}" versao="4.00">
      <ide><nNF>12345</nNF><serie>1</serie><dhEmi>2026-10-15T18:30:12-03:00</dhEmi></ide>
      <emit>
        <CNPJ>${CNPJ_COM_ZERO}</CNPJ>
        <xNome>MERCADO EXEMPLO LTDA</xNome>
        <xFant>Mercado Bom Preço</xFant>
        <enderEmit>
          <xLgr>RUA DAS FLORES</xLgr><nro>100</nro><xBairro>CENTRO</xBairro>
          <xMun>SAO PAULO</xMun><UF>SP</UF><CEP>01001000</CEP>
        </enderEmit>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>000123</cProd><cEAN>4006381333931</cEAN><xProd>FEIJÃO  PRETO 1KG</xProd>
          <uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>8.50</vUnCom><vProd>17.00</vProd><vDesc>0.50</vDesc>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>000456</cProd><cEAN>SEM GTIN</cEAN><xProd>PAO FRANCES KG</xProd>
          <uCom>KG</uCom><qCom>0.5000</qCom><vUnCom>16.00</vUnCom><vProd>8.00</vProd>
        </prod>
      </det>
      <total><ICMSTot><vProd>25.00</vProd><vDesc>0.50</vDesc><vNF>24.50</vNF></ICMSTot></total>
      <pag><detPag><tPag>17</tPag><vPag>24.50</vPag></detPag></pag>
    </infNFe>
  </NFe>
</nfeProc>`;

/** Trecho no layout padrão da consulta pública da NFC-e */
export const htmlNFCe = `
<html><body><div id="conteudo">
  <div class="txtCenter">
    <div id="u20" class="txtTopo">SUPERMERCADO CENTRAL</div>
    <div class="text">CNPJ: 06.057.223/0001-71</div>
    <div class="text">AV. BRASIL, 500, , JARDIM AMERICA, CAMPINAS, SP</div>
  </div>
  <table id="tabResult" cellspacing="0" cellpadding="0" border="0" align="center">
    <tr id="Item + 1">
      <td valign="top"><span class="txtTit">ARROZ TIPO 1 5KG</span><span class="RCod">(Código: 4006381333931 )</span><br/>
        <span class="Rqtd"><strong>Qtde.:</strong>2</span><span class="RUN"><strong>UN: </strong>UN</span>
        <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;25,90</span></td>
      <td align="right" valign="top" class="txtTit noWrap">Vl. Total<br/><span class="valor">51,80</span></td>
    </tr>
    <tr id="Item + 2">
      <td valign="top"><span class="txtTit">BANANA PRATA KG</span><span class="RCod">(Código: 2001 )</span><br/>
        <span class="Rqtd"><strong>Qtde.:</strong>1,235</span><span class="RUN"><strong>UN: </strong>KG</span>
        <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;6,99</span></td>
      <td align="right" valign="top" class="txtTit noWrap">Vl. Total<br/><span class="valor">8,63</span></td>
    </tr>
  </table>
  <div id="totalNota" class="txtRight">
    <div id="linhaTotal"><label>Qtd. total de itens:</label><span class="totalNumb">2</span></div>
    <div id="linhaTotal"><label>Valor total R$:</label><span class="totalNumb">1.060,43</span></div>
    <div id="linhaTotal"><label>Descontos R$:</label><span class="totalNumb">0,43</span></div>
    <div id="linhaTotal" class="linhaShade"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">1.060,00</span></div>
    <div id="linhaTotal"><label>Forma de pagamento:</label><span class="totalNumb txtTitR">Valor pago R$:</span></div>
    <div id="linhaTotal"><label class="tx">Cartão de Débito </label><span class="totalNumb">1.060,00</span></div>
    <div id="linhaTotal"><label>Troco </label><span class="totalNumb">0,00</span></div>
  </div>
  <div id="infos"><ul><li><strong>Número: </strong>12345 <strong>Série: </strong>1
    <strong>Emissão: </strong>15/10/2026 18:30:12-03:00 - Via Consumidor</li></ul></div>
</div></body></html>`;
