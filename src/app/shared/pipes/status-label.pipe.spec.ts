import { getStatusSeverity, StatusLabelPipe, TagSeverity } from './status-label.pipe';

describe('StatusLabelPipe', () => {
  const pipe = new StatusLabelPipe();

  it.each<[string, string, TagSeverity]>([
    ['NORMAL', 'Estoque Normal', 'success'],
    ['REPOSICAO', 'Reposição Necessária', 'danger'],
    ['ENTRADA', 'Entrada', 'success'],
    ['SAIDA', 'Saída', 'warn'],
    ['AJUSTE', 'Ajuste de Inventário', 'info'],
    ['PENDENTE', 'Pendente', 'warn'],
    ['APROVADO', 'Aprovado', 'info'],
    ['RECEBIDO', 'Recebido', 'success'],
    ['CANCELADO', 'Cancelado', 'secondary'],
    ['ATIVO', 'Ativo', 'success'],
    ['INATIVO', 'Descontinuado', 'secondary'],
  ])('maps %s to label "%s" and severity "%s"', (status, expectedLabel, expectedSeverity) => {
    expect(pipe.transform(status)).toBe(expectedLabel);
    expect(getStatusSeverity(status)).toBe(expectedSeverity);
  });

  it('returns "-" for null, undefined, or empty string', () => {
    expect(pipe.transform(null)).toBe('-');
    expect(pipe.transform(undefined)).toBe('-');
    expect(pipe.transform('')).toBe('-');
  });

  it('returns raw value and secondary severity for unknown status codes', () => {
    expect(pipe.transform('DESCONHECIDO')).toBe('DESCONHECIDO');
    expect(getStatusSeverity('DESCONHECIDO')).toBe('secondary');
  });
});
