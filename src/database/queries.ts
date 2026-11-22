export const PEDIDOS_SELECT =
  '*,medicamento:medicamentos(id,codigo_sku,nome,unidade_medida,quantidade_atual,estoque_minimo),solicitante:perfis!medico_solicitante_id(id,nome_completo,role),gerente:perfis!gerente_responsavel_id(id,nome_completo)';

export const MOVIMENTACOES_SELECT =
  '*,medicamento:medicamentos(id,codigo_sku,nome,unidade_medida),gerente:perfis!gerente_responsavel_id(id,nome_completo),medico:perfis!medico_solicitante_id(id,nome_completo)';
