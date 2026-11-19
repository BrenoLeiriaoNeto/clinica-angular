export type UserRole = 'PACIENTE' | 'MEDICO' | 'GERENTE_ESTOQUE' | 'RECEPCIONISTA';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  document?: string;
}

export interface SupabaseAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email: string;
    user_metadata: {
      fullName?: string;
      role?: UserRole;
      document?: string;
    }
  }
}
