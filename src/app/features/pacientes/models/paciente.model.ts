export interface Paciente {
  id: string;
  email: string;
  nome_completo: string;
  role: 'PACIENTE';
  documento: string | null;
  data_nascimento: string;
  telefone: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface PacienteAgendamentoResumo {
  id: string;
  paciente_id: string;
  medico_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  status: string;
  observacoes: string | null;
  medico?: {
    id: string;
    nome_completo: string;
    especialidade: string | null;
  } | null;
}
