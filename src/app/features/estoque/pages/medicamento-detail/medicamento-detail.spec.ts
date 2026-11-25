import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { of } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserProfile, UserRole } from '../../../../core/models/auth.model';
import { MedicamentoDetailPage } from './medicamento-detail';

describe('MedicamentoDetailPage (Integração)', () => {
  let fixture: ComponentFixture<MedicamentoDetailPage>;
  let httpMock: HttpTestingController;

  const mockGerente: UserProfile = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'estoque@medicore.com',
    fullName: 'Roberto Nogueira',
    role: 'GERENTE_ESTOQUE',
  };

  beforeEach(async () => {
    const userSignal = signal<UserProfile | null>(mockGerente);

    await TestBed.configureTestingModule({
      imports: [MedicamentoDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'med-1' })) },
        },
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

  it('exibe ficha do medicamento, movimentações e pedidos filtrados pelo ID da rota', () => {
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([
        {
          id: 'med-1',
          codigo_sku: 'MED-001',
          nome: 'Amoxicilina 500mg',
          principio_ativo: 'Amoxicilina Tri-hidratada',
          unidade_medida: 'Caixa c/ 21 caps',
          quantidade_atual: 30,
          estoque_minimo: 50,
          status: 'REPOSICAO',
          ativo: true,
          criado_em: '2026-11-20T10:00:00Z',
          atualizado_em: '2026-11-22T12:00:00Z',
        },
      ]);

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
});
