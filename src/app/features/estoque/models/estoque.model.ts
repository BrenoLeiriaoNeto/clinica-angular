export type EstoqueStatus = 'NORMAL' | 'REPOSICAO';
export type TipoMovimentacao = 'ENTRADA' | 'SAIDA' | 'AJUSTE';
export type PedidoStatus = 'PENDENTE' | 'APROVADO' | 'RECEBIDO' | 'CANCELADO';

export interface Medicamento {
  id: string;
  codigo_sku: string;
  nome: string;
  principio_ativo: string;
  unidade_medida: string;
  quantidade_atual: number;
  estoque_minimo: number;
  status: EstoqueStatus;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface PedidoEstoque {
  id: string;
  medicamento_id: string;
  quantidade_solicitada: number;
  status: PedidoStatus;
  medico_solicitante_id: string | null;
  gerente_responsavel_id: string | null;
  justificativa: string | null;
  criado_em: string;
  atualizado_em: string;
  medicamento?: {
    id: string;
    codigo_sku: string;
    nome: string;
    unidade_medida: string;
    quantidade_atual: number;
    estoque_minimo: number;
  };
  solicitante?: {
    id: string;
    nome_completo: string;
    role: string;
  } | null;
  gerente?: {
    id: string;
    nome_completo: string;
  } | null;
}

export interface EstoqueMovimentacao {
  id: string;
  medicamento_id: string;
  tipo: TipoMovimentacao;
  quantidade_anterior: number;
  quantidade_movimentada: number;
  quantidade_posterior: number;
  gerente_responsavel_id: string;
  medico_solicitante_id: string | null;
  observacao: string | null;
  criado_em: string;
  medicamento?: {
    id: string;
    codigo_sku: string;
    nome: string;
    unidade_medida: string;
  };
  gerente?: {
    id: string;
    nome_completo: string;
  };
  medico?: {
    id: string;
    nome_completo: string;
  } | null;
}

