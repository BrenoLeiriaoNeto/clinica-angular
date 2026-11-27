export interface CreatePacienteDto {
  nome_completo: string;
  email: string;
  documento: string;
  data_nascimento: string;
  telefone: string;
  senha_inicial: string;
}

export interface UpdatePacienteDto {
  nome_completo: string;
  documento: string;
  data_nascimento: string;
  telefone: string;
}
