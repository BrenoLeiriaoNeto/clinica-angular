export const PEDIDOS_SELECT =
  '*,medicamento:medicamentos(id,codigo_sku,nome,unidade_medida,quantidade_atual,estoque_minimo),solicitante:perfis!medico_solicitante_id(id,nome_completo,role),gerente:perfis!gerente_responsavel_id(id,nome_completo)';

export const MOVIMENTACOES_SELECT =
  '*,medicamento:medicamentos(id,codigo_sku,nome,unidade_medida),gerente:perfis!gerente_responsavel_id(id,nome_completo),medico:perfis!medico_solicitante_id(id,nome_completo)';

export const PACIENTE_AGENDAMENTOS_SELECT =
  'id,paciente_id,medico_id,data_hora_inicio,data_hora_fim,status,observacoes,medico:perfis!medico_id(id,nome_completo,especialidade)';
