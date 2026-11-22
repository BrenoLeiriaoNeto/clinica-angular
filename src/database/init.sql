-- ============================================================================
-- MEDICORE ERP - SCRIPT DE INICIALIZAÇÃO IDEMPOTENTE (POSTGRESQL / SUPABASE)
-- ============================================================================

-- 1. EXTENSÕES NECESSÁRIAS PARA HASH DE SENHA NO SEED DE USUÁRIOS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. ENUMS IDEMPOTENTES (DOMÍNIO DA CLÍNICA)
DO $$ BEGIN
CREATE TYPE public.user_role AS ENUM (
    'PACIENTE',
    'RECEPCIONISTA',
    'GERENTE_ESTOQUE',
    'MEDICO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE public.agendamento_status AS ENUM (
    'AGENDADO',
    'CONFIRMADO',
    'EM_ATENDIMENTO',
    'CONCLUIDO',
    'CANCELADO',
    'FALTA_COBRADA',
    'REAGENDAMENTO_SOLICITADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE public.estoque_status AS ENUM (
    'NORMAL',
    'REPOSICAO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE public.tipo_movimentacao AS ENUM (
    'ENTRADA',
    'SAIDA',
    'AJUSTE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE public.pedido_status AS ENUM (
    'PENDENTE',
    'APROVADO',
    'RECEBIDO',
    'CANCELADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE public.receituario_status AS ENUM (
    'ATIVO',
    'VENCIDO',
    'REEMISSAO_SOLICITADA',
    'REEMITIDO',
    'RECUSADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 3. TABELAS PRINCIPAIS (IF NOT EXISTS)
-- ============================================================================

-- 3.1 Perfis (Pacientes, Médicos, Recepcionistas e Gerentes de Estoque)
CREATE TABLE IF NOT EXISTS public.perfis (
                                           id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nome_completo TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'PACIENTE',
  documento TEXT, -- CPF para paciente, CRM para médico ou matrícula
  especialidade TEXT, -- Preenchido quando role = 'MEDICO'
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

-- 3.2 Medicamentos & Controle de Estoque
CREATE TABLE IF NOT EXISTS public.medicamentos (
                                                 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_sku TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  principio_ativo TEXT NOT NULL,
  unidade_medida TEXT NOT NULL DEFAULT 'Caixa',
  quantidade_atual INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
  estoque_minimo INTEGER NOT NULL DEFAULT 50,
  status public.estoque_status NOT NULL DEFAULT 'NORMAL',
  ativo BOOLEAN NOT NULL DEFAULT TRUE, -- Soft delete para manter logs históricos
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

-- 3.3 Pedidos de Compra / Solicitação de Reestoque
CREATE TABLE IF NOT EXISTS public.pedidos_estoque (
                                                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id UUID NOT NULL REFERENCES public.medicamentos(id),
  quantidade_solicitada INTEGER NOT NULL CHECK (quantidade_solicitada > 0),
  status public.pedido_status NOT NULL DEFAULT 'PENDENTE',
  medico_solicitante_id UUID REFERENCES public.perfis(id),
  gerente_responsavel_id UUID REFERENCES public.perfis(id),
  justificativa TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

-- 3.4 Auditoria Imutável de Movimentações de Estoque
CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
                                                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicamento_id UUID NOT NULL REFERENCES public.medicamentos(id),
  tipo public.tipo_movimentacao NOT NULL,
  quantidade_anterior INTEGER NOT NULL,
  quantidade_movimentada INTEGER NOT NULL,
  quantidade_posterior INTEGER NOT NULL,
  gerente_responsavel_id UUID NOT NULL REFERENCES public.perfis(id),
  medico_solicitante_id UUID REFERENCES public.perfis(id),
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

-- 3.5 Agendamentos (Agenda Médica e Fluxo de Reagendamento)
CREATE TABLE IF NOT EXISTS public.agendamentos (
                                                 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.perfis(id),
  medico_id UUID NOT NULL REFERENCES public.perfis(id),
  data_hora_inicio TIMESTAMPTZ NOT NULL,
  data_hora_fim TIMESTAMPTZ NOT NULL,
  status public.agendamento_status NOT NULL DEFAULT 'AGENDADO',
  motivo_alteracao TEXT,
  horario_sugerido_paciente TIMESTAMPTZ,
  cobrar_taxa_cancelamento BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_horario_valido CHECK (data_hora_fim > data_hora_inicio)
  );

-- 3.6 Consultas e Diagnósticos Clínicos
CREATE TABLE IF NOT EXISTS public.consultas (
                                              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID UNIQUE NOT NULL REFERENCES public.agendamentos(id),
  paciente_id UUID NOT NULL REFERENCES public.perfis(id),
  medico_id UUID NOT NULL REFERENCES public.perfis(id),
  queixa_principal TEXT NOT NULL,
  diagnostico TEXT NOT NULL,
  cid_10 TEXT,
  conduta_clinica TEXT,
  realizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

-- 3.7 Receituários (Com Trava de Validade e Fluxo Retroativo)
CREATE TABLE IF NOT EXISTS public.receituarios (
                                                 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id UUID NOT NULL REFERENCES public.consultas(id),
  paciente_id UUID NOT NULL REFERENCES public.perfis(id),
  medico_id UUID NOT NULL REFERENCES public.perfis(id),
  emitido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validade_ate TIMESTAMPTZ NOT NULL,
  status public.receituario_status NOT NULL DEFAULT 'ATIVO',
  motivo_solicitacao_paciente TEXT,
  justificativa_medico TEXT,
  liberado_retroativamente_em TIMESTAMPTZ
  );

-- 3.8 Itens Prescritos no Receituário
CREATE TABLE IF NOT EXISTS public.receituario_itens (
                                                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receituario_id UUID NOT NULL REFERENCES public.receituarios(id) ON DELETE CASCADE,
  medicamento_id UUID NOT NULL REFERENCES public.medicamentos(id),
  dosagem TEXT NOT NULL,
  frequencia TEXT NOT NULL,
  duracao_dias INTEGER NOT NULL CHECK (duracao_dias > 0),
  instrucoes TEXT
  );

-- ============================================================================
-- 4. TRIGGERS DE REGRAS DE NEGÓCIO NO BANCO
-- ============================================================================

-- Regra: Medicamento com menos de 50 unidades entra automaticamente em REPOSICAO
CREATE OR REPLACE FUNCTION public.fn_atualizar_status_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantidade_atual < NEW.estoque_minimo THEN
    NEW.status := 'REPOSICAO';
ELSE
    NEW.status := 'NORMAL';
END IF;
  NEW.atualizado_em := NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_medicamentos_status_estoque ON public.medicamentos;
CREATE TRIGGER trg_medicamentos_status_estoque
  BEFORE INSERT OR UPDATE OF quantidade_atual, estoque_minimo
                   ON public.medicamentos
                     FOR EACH ROW
                     EXECUTE FUNCTION public.fn_atualizar_status_estoque();

-- ============================================================================
-- FUNÇÕES ATÔMICAS DE ESTOQUE (TRANSAÇÃO ACID + BLOQUEIO DE CONCORRÊNCIA)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_estoque(
  p_medicamento_id UUID,
  p_tipo public.tipo_movimentacao,
  p_quantidade INTEGER,
  p_observacao TEXT DEFAULT NULL,
  p_medico_solicitante_id UUID DEFAULT NULL
)
RETURNS public.medicamentos
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
v_user_id UUID := auth.uid();
  v_med public.medicamentos;
  v_anterior INTEGER;
  v_posterior INTEGER;
  v_movimentada INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
END IF;

SELECT * INTO v_med
FROM public.medicamentos
WHERE id = p_medicamento_id
  FOR UPDATE;

IF NOT FOUND THEN
    RAISE EXCEPTION 'Medicamento não encontrado.';
END IF;

  v_anterior := v_med.quantidade_atual;

  IF p_tipo = 'ENTRADA' THEN
    IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
      RAISE EXCEPTION 'A quantidade de entrada deve ser maior que zero.';
END IF;
    v_posterior := v_anterior + p_quantidade;
    v_movimentada := p_quantidade;
  ELSIF p_tipo = 'SAIDA' THEN
    IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
      RAISE EXCEPTION 'A quantidade de saída deve ser maior que zero.';
END IF;
    IF p_quantidade > v_anterior THEN
      RAISE EXCEPTION 'Saldo insuficiente em estoque para esta saída.';
END IF;
    v_posterior := v_anterior - p_quantidade;
    v_movimentada := p_quantidade;
ELSE
    IF p_quantidade IS NULL OR p_quantidade < 0 THEN
      RAISE EXCEPTION 'O saldo ajustado não pode ser negativo.';
END IF;
    v_posterior := p_quantidade;
    v_movimentada := ABS(v_posterior - v_anterior);
END IF;

UPDATE public.medicamentos
SET quantidade_atual = v_posterior
WHERE id = p_medicamento_id
  RETURNING * INTO v_med;

INSERT INTO public.estoque_movimentacoes (
  medicamento_id,
  tipo,
  quantidade_anterior,
  quantidade_movimentada,
  quantidade_posterior,
  gerente_responsavel_id,
  medico_solicitante_id,
  observacao
) VALUES (
           p_medicamento_id,
           p_tipo,
           v_anterior,
           v_movimentada,
           v_posterior,
           v_user_id,
           p_medico_solicitante_id,
           NULLIF(TRIM(COALESCE(p_observacao, '')), '')
         );

RETURN v_med;
END;
$$;

CREATE OR REPLACE FUNCTION public.receber_pedido_estoque(
  p_pedido_id UUID
)
RETURNS public.pedidos_estoque
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
v_user_id UUID := auth.uid();
  v_pedido public.pedidos_estoque;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
END IF;

SELECT * INTO v_pedido
FROM public.pedidos_estoque
WHERE id = p_pedido_id
  FOR UPDATE;

IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de estoque não encontrado.';
END IF;

  IF v_pedido.status NOT IN ('PENDENTE', 'APROVADO') THEN
    RAISE EXCEPTION 'Apenas pedidos pendentes ou aprovados podem ser marcados como recebidos.';
END IF;

UPDATE public.pedidos_estoque
SET status = 'RECEBIDO',
    gerente_responsavel_id = v_user_id,
    atualizado_em = NOW()
WHERE id = p_pedido_id
  RETURNING * INTO v_pedido;

PERFORM public.registrar_movimentacao_estoque(
    v_pedido.medicamento_id,
    'ENTRADA',
    v_pedido.quantidade_solicitada,
    'Recebimento do pedido #' || LEFT(v_pedido.id::text, 8),
    v_pedido.medico_solicitante_id
  );

RETURN v_pedido;
END;
$$;

-- ============================================================================
-- 5. SEGURANÇA: ROW LEVEL SECURITY (RLS) E POLÍTICAS POR ROLE
-- ============================================================================

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receituarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receituario_itens ENABLE ROW LEVEL SECURITY;

-- Helper para ler a role direto do JWT sem causar recursão em queries
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT COALESCE(
         (SELECT role::text FROM public.perfis WHERE id = auth.uid()),
         'ANON'
       );
$$;

-- Políticas: PERFIS
DROP POLICY IF EXISTS "perfis_leitura_autenticada" ON public.perfis;
CREATE POLICY "perfis_leitura_autenticada" ON public.perfis
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "perfis_gestao_recepcao" ON public.perfis;
CREATE POLICY "perfis_gestao_recepcao" ON public.perfis
  FOR ALL TO authenticated
  USING (public.current_app_role() = 'RECEPCIONISTA' OR auth.uid() = id)
  WITH CHECK (public.current_app_role() = 'RECEPCIONISTA' OR auth.uid() = id AND role::text = public.current_app_role());

-- Políticas: MEDICAMENTOS
DROP POLICY IF EXISTS "medicamentos_leitura_geral" ON public.medicamentos;
CREATE POLICY "medicamentos_leitura_geral" ON public.medicamentos
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "medicamentos_escrita_gerente" ON public.medicamentos;
CREATE POLICY "medicamentos_escrita_gerente" ON public.medicamentos
  FOR ALL TO authenticated
  USING (public.current_app_role() = 'GERENTE_ESTOQUE')
  WITH CHECK (public.current_app_role() = 'GERENTE_ESTOQUE');

-- Políticas: PEDIDOS DE ESTOQUE (Gerente gerencia; Médico pode solicitar)
DROP POLICY IF EXISTS "pedidos_estoque_leitura" ON public.pedidos_estoque;
CREATE POLICY "pedidos_estoque_leitura" ON public.pedidos_estoque
  FOR SELECT TO authenticated
                                USING (public.current_app_role() IN ('GERENTE_ESTOQUE', 'MEDICO'));

DROP POLICY IF EXISTS "pedidos_estoque_insercao" ON public.pedidos_estoque;
CREATE POLICY "pedidos_estoque_insercao" ON public.pedidos_estoque
  FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() IN ('GERENTE_ESTOQUE', 'MEDICO'));

DROP POLICY IF EXISTS "pedidos_estoque_update_gerente" ON public.pedidos_estoque;
CREATE POLICY "pedidos_estoque_update_gerente" ON public.pedidos_estoque
  FOR UPDATE TO authenticated
                                USING (public.current_app_role() = 'GERENTE_ESTOQUE')
      WITH CHECK (public.current_app_role() = 'GERENTE_ESTOQUE');

-- Políticas: AUDITORIA DE ESTOQUE (Somente Gerente de Estoque)
DROP POLICY IF EXISTS "auditoria_estoque_gerente" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "auditoria_estoque_leitura" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "auditoria_estoque_insercao" ON public.estoque_movimentacoes;

CREATE POLICY "auditoria_estoque_leitura" ON public.estoque_movimentacoes
  FOR SELECT TO authenticated
                              USING (public.current_app_role() = 'GERENTE_ESTOQUE');

CREATE POLICY "auditoria_estoque_insercao" ON public.estoque_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() = 'GERENTE_ESTOQUE');

-- Políticas: AGENDAMENTOS
DROP POLICY IF EXISTS "agendamentos_acesso" ON public.agendamentos;
CREATE POLICY "agendamentos_acesso" ON public.agendamentos
  FOR ALL TO authenticated
  USING (
    public.current_app_role() IN ('RECEPCIONISTA', 'MEDICO')
    OR paciente_id = auth.uid()
  )
  WITH CHECK (
    public.current_app_role() IN ('RECEPCIONISTA', 'MEDICO')
    OR paciente_id = auth.uid()
  );

-- Políticas: CONSULTAS
DROP POLICY IF EXISTS "consultas_acesso" ON public.consultas;
CREATE POLICY "consultas_acesso" ON public.consultas
  FOR ALL TO authenticated
  USING (
    public.current_app_role() IN ('MEDICO', 'RECEPCIONISTA')
    OR paciente_id = auth.uid()
  )
  WITH CHECK (public.current_app_role() = 'MEDICO');

-- Políticas: RECEITUÁRIOS E ITENS
DROP POLICY IF EXISTS "receituarios_acesso" ON public.receituarios;
CREATE POLICY "receituarios_acesso" ON public.receituarios
  FOR ALL TO authenticated
  USING (
    public.current_app_role() = 'MEDICO'
    OR paciente_id = auth.uid()
  )
  WITH CHECK (
    public.current_app_role() = 'MEDICO'
    OR paciente_id = auth.uid()
  );

DROP POLICY IF EXISTS "receituario_itens_acesso" ON public.receituario_itens;
CREATE POLICY "receituario_itens_acesso" ON public.receituario_itens
  FOR ALL TO authenticated
  USING (
       public.current_app_role() = 'MEDICO'
       OR EXISTS (
       SELECT 1
       FROM public.receituarios r
       WHERE r.id = receituario_id
       AND r.paciente_id = auth.uid()
       )
  )
  WITH CHECK (public.current_app_role() = 'MEDICO');

-- ============================================================================
-- 6. SEED INICIAL: 4 USUÁRIOS (1 POR ROLE) + DADOS DEMONSTRATIVOS
-- Senha padrão para todos os usuários de teste: Clinica@2026
-- ============================================================================

DO $$
DECLARE
v_rec_id UUID := '11111111-1111-1111-1111-111111111111';
  v_med_id UUID := '22222222-2222-2222-2222-222222222222';
  v_est_id UUID := '33333333-3333-3333-3333-333333333333';
  v_pac_id UUID := '44444444-4444-4444-4444-444444444444';
  v_med2_id UUID := '55555555-5555-5555-5555-555555555555';
  v_pw_hash TEXT := crypt('Clinica@2026', gen_salt('bf'));
BEGIN
  -- Inserção segura em auth.users
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES
    (
      '00000000-0000-0000-0000-000000000000', v_rec_id, 'authenticated', 'authenticated',
      'recepcao@medicore.com', v_pw_hash, NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Camila Andrade","role":"RECEPCIONISTA","document":"MAT-1042"}',
      NOW(), NOW(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_med_id, 'authenticated', 'authenticated',
      'medico@medicore.com', v_pw_hash, NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Dr. Henrique Vasconcelos","role":"MEDICO","document":"CRM-SP 148.920"}',
      NOW(), NOW(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_est_id, 'authenticated', 'authenticated',
      'estoque@medicore.com', v_pw_hash, NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Roberto Nogueira","role":"GERENTE_ESTOQUE","document":"MAT-2088"}',
      NOW(), NOW(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_pac_id, 'authenticated', 'authenticated',
      'paciente@medicore.com', v_pw_hash, NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Lucas Mendes","role":"PACIENTE","document":"***.482.910-**"}',
      NOW(), NOW(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_med2_id, 'authenticated', 'authenticated',
      'dra.beatriz@medicore.com', v_pw_hash, NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Dra. Beatriz Alencar","role":"MEDICO","document":"CRM-SP 192.410"}',
      NOW(), NOW(), '', '', '', ''
    )
  ON CONFLICT (id) DO NOTHING;

-- Inserção em auth.identities (obrigatório para login por e-mail/senha no GoTrue)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
SELECT
  u.id,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  u.id::text,
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE u.id IN (v_rec_id, v_med_id, v_est_id, v_pac_id, v_med2_id)
  ON CONFLICT (provider, provider_id) DO NOTHING;

-- Espelhamento em public.perfis
INSERT INTO public.perfis (id, email, nome_completo, role, documento, especialidade, telefone)
VALUES
  (v_rec_id, 'recepcao@medicore.com', 'Camila Andrade', 'RECEPCIONISTA', 'MAT-1042', NULL, '(11) 98811-2233'),
  (v_med_id, 'medico@medicore.com', 'Dr. Henrique Vasconcelos', 'MEDICO', 'CRM-SP 148.920', 'Clínica Geral / Cardiologia', '(11) 97744-5566'),
  (v_est_id, 'estoque@medicore.com', 'Roberto Nogueira', 'GERENTE_ESTOQUE', 'MAT-2088', NULL, '(11) 96633-4455'),
  (v_pac_id, 'paciente@medicore.com', 'Lucas Mendes', 'PACIENTE', '***.482.910-**', NULL, '(11) 99123-4567'),
  (v_med2_id, 'dra.beatriz@medicore.com', 'Dra. Beatriz Alencar', 'MEDICO', 'CRM-SP 192.410', 'Dermatologia', '(11) 99555-1212')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Seed de Medicamentos (inclui itens < 50 para testar status REPOSICAO e 1 descontinuado)
INSERT INTO public.medicamentos (id, codigo_sku, nome, principio_ativo, unidade_medida, quantidade_atual, ativo)
VALUES
  ('aaaaaaaa-0001-0001-0001-000000000001', 'MED-001', 'Amoxicilina 500mg', 'Amoxicilina Tri-hidratada', 'Caixa c/ 21 caps', 32, TRUE),
  ('aaaaaaaa-0001-0001-0001-000000000002', 'MED-002', 'Dipirona Monoidratada 1g', 'Dipirona Sódica', 'Caixa c/ 10 comp', 140, TRUE),
  ('aaaaaaaa-0001-0001-0001-000000000003', 'MED-003', 'Losartana Potássica 50mg', 'Losartana Potássica', 'Caixa c/ 30 comp', 18, TRUE),
  ('aaaaaaaa-0001-0001-0001-000000000004', 'MED-004', 'Omeprazol 20mg', 'Omeprazol', 'Frasco c/ 28 caps', 85, TRUE),
  ('aaaaaaaa-0001-0001-0001-000000000005', 'MED-005', 'Nimesulida 100mg (Descontinuado)', 'Nimesulida', 'Caixa c/ 12 comp', 0, FALSE)
  ON CONFLICT (codigo_sku) DO NOTHING;

-- Seed de Auditoria de Estoque
INSERT INTO public.estoque_movimentacoes (
  id, medicamento_id, tipo, quantidade_anterior, quantidade_movimentada, quantidade_posterior,
  gerente_responsavel_id, medico_solicitante_id, observacao
) VALUES (
           'bbbbbbbb-0001-0001-0001-000000000001',
           'aaaaaaaa-0001-0001-0001-000000000001',
           'SAIDA',
           50,
           18,
           32,
           '33333333-3333-3333-3333-333333333333',
           '22222222-2222-2222-2222-222222222222',
           'Dispensação ambulatorial - estoque entrou em alerta de reposição (< 50)'
         ) ON CONFLICT (id) DO NOTHING;

-- Seed de Consultas Passadas e Receituários (1 Válido + 1 Vencido para teste de bloqueio)
INSERT INTO public.agendamentos (
  id, paciente_id, medico_id, data_hora_inicio, data_hora_fim, status, observacoes
) VALUES
    (
      'cccccccc-0001-0001-0001-000000000001',
      '44444444-4444-4444-4444-444444444444',
      '22222222-2222-2222-2222-222222222222',
      NOW() - INTERVAL '45 days',
      NOW() - INTERVAL '45 days' + INTERVAL '30 minutes',
      'CONCLUIDO',
      'Consulta de rotina cardiológica'
    ),
    (
      'cccccccc-0001-0001-0001-000000000002',
      '44444444-4444-4444-4444-444444444444',
      '22222222-2222-2222-2222-222222222222',
      NOW() - INTERVAL '3 days',
      NOW() - INTERVAL '3 days' + INTERVAL '30 minutes',
      'CONCLUIDO',
      'Retorno e avaliação de exames'
    )
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.consultas (
  id, agendamento_id, paciente_id, medico_id, queixa_principal, diagnostico, cid_10, conduta_clinica, realizada_em
) VALUES
    (
      'dddddddd-0001-0001-0001-000000000001',
      'cccccccc-0001-0001-0001-000000000001',
      '44444444-4444-4444-4444-444444444444',
      '22222222-2222-2222-2222-222222222222',
      'Cefaleia e pressão arterial limítrofe',
      'Hipertensão arterial essencial leve',
      'I10',
      'Iniciar terapia medicamentosa e monitoramento residencial da PA.',
      NOW() - INTERVAL '45 days'
    ),
    (
      'dddddddd-0001-0001-0001-000000000002',
      'cccccccc-0001-0001-0001-000000000002',
      '44444444-4444-4444-4444-444444444444',
      '22222222-2222-2222-2222-222222222222',
      'Dor de garganta e febre baixa há 2 dias',
      'Faringoamigdalite bacteriana aguda',
      'J03.9',
      'Antibioticoterapia por 7 dias e sintomáticos.',
      NOW() - INTERVAL '3 days'
    )
  ON CONFLICT (id) DO NOTHING;

-- Receituário 1: VENCIDO (para testar trava de impressão e solicitação retroativa)
-- Receituário 2: ATIVO (válido por mais 27 dias)
INSERT INTO public.receituarios (
  id, consulta_id, paciente_id, medico_id, emitido_em, validade_ate, status
) VALUES
    (
      'eeeeeeee-0001-0001-0001-000000000001',
      'dddddddd-0001-0001-0001-000000000001',
      '44444444-4444-4444-4444-444444444444',
      '22222222-2222-2222-2222-222222222222',
      NOW() - INTERVAL '45 days',
      NOW() - INTERVAL '15 days',
      'VENCIDO'
    ),
    (
      'eeeeeeee-0001-0001-0001-000000000002',
      'dddddddd-0001-0001-0001-000000000002',
      '44444444-4444-4444-4444-444444444444',
      '22222222-2222-2222-2222-222222222222',
      NOW() - INTERVAL '3 days',
      NOW() + INTERVAL '27 days',
      'ATIVO'
    )
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.receituario_itens (
  id, receituario_id, medicamento_id, dosagem, frequencia, duracao_dias, instrucoes
) VALUES
    (
      'ffffffff-0001-0001-0001-000000000001',
      'eeeeeeee-0001-0001-0001-000000000001',
      'aaaaaaaa-0001-0001-0001-000000000003',
      '1 comprimido (50mg)',
      'A cada 24 horas',
      30,
      'Tomar pela manhã em jejum.'
    ),
    (
      'ffffffff-0001-0001-0001-000000000002',
      'eeeeeeee-0001-0001-0001-000000000002',
      'aaaaaaaa-0001-0001-0001-000000000001',
      '1 cápsula (500mg)',
      'A cada 8 horas',
      7,
      'Completar os 7 dias mesmo após melhora dos sintomas.'
    ),
    (
      'ffffffff-0001-0001-0001-000000000003',
      'eeeeeeee-0001-0001-0001-000000000002',
      'aaaaaaaa-0001-0001-0001-000000000002',
      '1 comprimido (1g)',
      'A cada 6 horas se febre ou dor',
      3,
      'Uso apenas sintomático.'
    )
  ON CONFLICT (id) DO NOTHING;
