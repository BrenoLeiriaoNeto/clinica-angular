import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserProfile, UserRole } from '../../../../core/models/auth.model';
import { MedicamentoDetailPage } from './medicamento-detail';

describe('MedicamentoDetailPage (Integração)', () => {
  let fixture: ComponentFixture<MedicamentoDetailPage>;
  let httpMock: HttpTestingController;
  let userSignal: ReturnType<typeof signal<UserProfile | null>>;

  const mockGerente: UserProfile = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'estoque@medicore.com',
    fullName: 'Roberto Nogueira',
    role: 'GERENTE_ESTOQUE',
  };

  const mockMedico: UserProfile = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'medico@medicore.com',
    fullName: 'Dr. Henrique Vasconcelos',
    role: 'MEDICO',
  };

  const mockMedicamento = {
    id: 'med-1',
    codigo_sku: 'MED-001',
    nome: 'Amoxicilina 500mg',
    principio_ativo: 'Amoxicilina Tri-hidratada',
    unidade_medida: 'Caixa c/ 21 caps',
    quantidade_atual: 30,
    estoque_minimo: 50,
    status: 'REPOSICAO' as const,
    ativo: true,
    criado_em: '2026-11-20T10:00:00Z',
    atualizado_em: '2026-11-22T12:00:00Z',
  };

  beforeEach(async () => {
    userSignal = signal<UserProfile | null>(mockGerente);

    await TestBed.configureTestingModule({
      imports: [MedicamentoDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        {
          provide: AuthService,
          useValue: {
            currentUser: userSignal.asReadonly(),
            hasAnyRole: (roles: UserRole[]) => {
              const role = userSignal()?.role;
              return role ? roles.includes(role) : false;
            },
          },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MedicamentoDetailPage);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('exibe ficha do medicamento, movimentações e pedidos filtrados pelo input id para GERENTE_ESTOQUE', () => {
    fixture.componentRef.setInput('id', 'med-1');
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([mockMedicamento]);

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/estoque_movimentacoes`)
      .flush([
        {
          id: 'mov-1',
          medicamento_id: 'med-1',
          tipo: 'SAIDA',
          quantidade_anterior: 50,
          quantidade_movimentada: 20,
          quantidade_posterior: 30,
          gerente_responsavel_id: mockGerente.id,
          medico_solicitante_id: null,
          observacao: 'Dispensação ambulatorial',
          criado_em: '2026-11-22T12:00:00Z',
          gerente: { id: mockGerente.id, nome_completo: mockGerente.fullName },
        },
        {
          id: 'mov-other',
          medicamento_id: 'med-999',
          tipo: 'ENTRADA',
          quantidade_anterior: 10,
          quantidade_movimentada: 10,
          quantidade_posterior: 20,
          gerente_responsavel_id: mockGerente.id,
          medico_solicitante_id: null,
          observacao: 'Outro item',
          criado_em: '2026-11-22T12:00:00Z',
        },
      ]);

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque`)
      .flush([
        {
          id: 'ped-1',
          medicamento_id: 'med-1',
          quantidade_solicitada: 40,
          status: 'PENDENTE',
          medico_solicitante_id: null,
          gerente_responsavel_id: mockGerente.id,
          justificativa: 'Abaixo do mínimo',
          criado_em: '2026-11-22T13:00:00Z',
          atualizado_em: '2026-11-22T13:00:00Z',
        },
      ]);

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Amoxicilina 500mg');
    expect(text).toContain('Faltam 20 unidade(s)');
    expect(text).toContain('Dispensação ambulatorial');
    expect(text).not.toContain('Outro item');
    expect(text).toContain('Abaixo do mínimo');
  });

  it('não consulta nem exibe auditoria quando o usuário logado é MEDICO', () => {
    userSignal.set(mockMedico);
    fixture.componentRef.setInput('id', 'med-1');
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([mockMedicamento]);

    httpMock.expectNone(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/estoque_movimentacoes`,
    );

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque`)
      .flush([]);

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Amoxicilina 500mg');
    expect(text).not.toContain('Histórico de Movimentações');
    expect(text).toContain('Pedidos de Re-estoque Relacionados');
  });

  it('exibe alerta quando o medicamento não existe no catálogo', () => {
    fixture.componentRef.setInput('id', 'id-inexistente');
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([mockMedicamento]);
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/estoque_movimentacoes`)
      .flush([]);
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque`)
      .flush([]);

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Medicamento não encontrado');
  });

  it('exibe status acima do mínimo, formata ENTRADA/AJUSTE e trata estados vazios', () => {
    fixture.componentRef.setInput('id', 'med-1');
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([{ ...mockMedicamento, quantidade_atual: 80, status: 'NORMAL' }]);

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/estoque_movimentacoes`)
      .flush([
        {
          id: 'mov-entrada',
          medicamento_id: 'med-1',
          tipo: 'ENTRADA',
          quantidade_anterior: 50,
          quantidade_movimentada: 30,
          quantidade_posterior: 80,
          gerente_responsavel_id: mockGerente.id,
          medico_solicitante_id: null,
          observacao: 'NF-100',
          criado_em: '2026-11-22T12:00:00Z',
        },
        {
          id: 'mov-ajuste',
          medicamento_id: 'med-1',
          tipo: 'AJUSTE',
          quantidade_anterior: 80,
          quantidade_movimentada: 80,
          quantidade_posterior: 80,
          gerente_responsavel_id: mockGerente.id,
          medico_solicitante_id: null,
          observacao: 'Conferência',
          criado_em: '2026-11-22T13:00:00Z',
        },
      ]);

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque`)
      .flush([]);

    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Acima ou igual ao nível mínimo');
    expect(text).toContain('+30');
    expect(text).toContain('= 80');
    expect(text).toContain('Nenhum pedido de re-estoque registrado para este medicamento.');
  });
});
