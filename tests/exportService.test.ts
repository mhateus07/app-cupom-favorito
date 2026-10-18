import {
  gerarBackupJson,
  gerarCsvCupons,
  lerBackupJson,
} from '../src/services/export/exportService';
import { CupomData } from '../src/models/types';

const cupom: CupomData = {
  chaveAcesso: '123',
  qrCode: 'https://sefaz.example/qrcode',
  estabelecimento: { nome: 'Mercado Central', cnpj: '06057223000171' },
  produtos: [
    {
      nome: 'Feijão, Preto',
      codigo: '001',
      gtin: null,
      unidade: 'UN',
      preco: 10,
      quantidade: 2,
      desconto: 1,
      precoFinal: 19,
    },
  ],
  data: '2026-10-15T18:30:12-03:00',
  subtotal: 20,
  descontoTotal: 1,
  total: 19,
  formaPagamento: 'PIX',
};

describe('exportService', () => {
  it('gera CSV com BOM, cabeçalho e valores escapados', () => {
    const csv = gerarCsvCupons([cupom]);
    expect(csv.startsWith('\uFEFFchave_acesso;')).toBe(true);
    expect(csv).toContain('"Feijão, Preto"');
    expect(csv).toContain('Mercado Central');
  });

  it('gera backup JSON versionado', () => {
    const backup = JSON.parse(gerarBackupJson([cupom]));
    expect(backup).toMatchObject({ schema: 1, app: 'cupom-favorito' });
    expect(backup.cupons).toHaveLength(1);
    expect(lerBackupJson(JSON.stringify(backup))).toHaveLength(1);
  });

  it('rejeita conteúdo que não é backup', () => {
    expect(() => lerBackupJson('{"items":[]}')).toThrow('backup válido');
  });
});
