import {
  formatarChaveAcesso,
  formatarDiaMes,
  formatarHora,
  formatarMes,
  formatarValor,
  iniciais,
} from '../src/utils/formatacao';

describe('formatacao', () => {
  it('valores e datas no padrão do manual', () => {
    expect(formatarValor(212.87)).toBe('212,87');
    expect(formatarValor(1060)).toBe('1.060,00');
    expect(formatarDiaMes('2026-10-14T18:42:00-03:00')).toBe('14 OUT');
    expect(formatarHora('2026-10-14T18:42:00')).toBe('18:42');
    expect(formatarHora('2026-10-01')).toBe('');
    expect(formatarMes('2026-10-14')).toBe('OUTUBRO');
  });

  it('iniciais do mercado', () => {
    expect(iniciais('Mercado Central')).toBe('MC');
    expect(iniciais('Supermercado do Povo LTDA')).toBe('SP');
    expect(iniciais('Atacadão')).toBe('A');
  });

  it('chave de acesso em grupos de 4', () => {
    expect(formatarChaveAcesso('31261012345678')).toBe('3126 1012 3456 78');
  });
});
