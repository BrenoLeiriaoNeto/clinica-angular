import { Medicamento, TipoMovimentacao } from '../estoque.model';

export interface CreateMedicamentoDto {
  codigo_sku: string;
  nome: string;
  principio_ativo: string;
  unidade_medida: string;
  quantidade_atual: number;
  estoque_minimo: number;
}

export interface UpdateMedicamentoDto {
  nome: string;
  principio_ativo: string;
  unidade_medida: string;
  estoque_minimo: number;
}

export interface CreatePedidoEstoqueDto {
  medicamento_id: string;
  quantidade_solicitada: number;
  justificativa: string;
}

export interface RegistrarMovimentacaoDto {
  medicamento: Medicamento;
  tipo: TipoMovimentacao;
  quantidade: number;
  observacao: string;
  medico_solicitante_id?: string | null;
}

export interface MovimentacaoDto {
  tipo: TipoMovimentacao;
  quantidade: number;
  observacao: string;
}
