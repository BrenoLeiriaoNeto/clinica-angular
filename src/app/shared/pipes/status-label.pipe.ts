import { Pipe, PipeTransform } from '@angular/core';

export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

const STATUS_LABELS: Record<string, string> = {
  NORMAL: 'Estoque Normal',
  REPOSICAO: 'Reposição Necessária',
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  AJUSTE: 'Ajuste de Inventário',
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  RECEBIDO: 'Recebido',
  CANCELADO: 'Cancelado',
  ATIVO: 'Ativo',
  INATIVO: 'Descontinuado',
};

const STATUS_SEVERITIES: Record<string, TagSeverity> = {
  NORMAL: 'success',
  REPOSICAO: 'danger',
  ENTRADA: 'success',
  SAIDA: 'warn',
  AJUSTE: 'info',
  PENDENTE: 'warn',
  APROVADO: 'info',
  RECEBIDO: 'success',
  CANCELADO: 'secondary',
  ATIVO: 'success',
  INATIVO: 'secondary',
};

export function getStatusSeverity(status: string): TagSeverity {
  return STATUS_SEVERITIES[status] ?? 'secondary'
}

@Pipe({
  name: 'statusLabel',
})
export class StatusLabelPipe implements PipeTransform {
  transform(value: string | null | undefined,): string {
    if (!value) return '-';
    return STATUS_LABELS[value] ?? value;
  }
}
