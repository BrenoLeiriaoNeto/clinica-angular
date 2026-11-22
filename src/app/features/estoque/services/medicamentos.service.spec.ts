import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { UserProfile } from '../../../core/models/auth.model';
import { Medicamento } from '../models/estoque.model';
import { AuditoriaEstoqueService } from './auditoria-estoque.service';
import { MedicamentosService } from './medicamentos.service';

describe('MedicamentosService', () => {
  let service: MedicamentosService;
  let httpMock: HttpTestingController;

  const auditoriaMock = {
    registrarLog: vi.fn(() => of({} as never)),
  };

  const mockGerente: UserProfile = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'estoque@medicore.com',
    fullName: 'Roberto Nogueira',
    role: 'GERENTE_ESTOQUE',
  };

  const mockAmoxicilina: Medicamento = {
    id: 'aaaaaaaa-0001-0001-0001-000000000001',
    codigo_sku: 'MED-001',
    nome: 'Amoxicilina 500mg',
    principio_ativo: 'Amoxicilina Tri-hidratada',
    unidade_medida: 'Caixa c/ 21 caps',
    quantidade_atual: 60,
    estoque_minimo: 50,
    status: 'NORMAL',
    ativo: true,
    criado_em: '2026-11-20T10:00:00Z',
    atualizado_em: '2026-11-20T10:00:00Z',
  };

  beforeEach(() => {
    auditoriaMock.registrarLog.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { currentUser: signal<UserProfile | null>(mockGerente).asReadonly() },
        },
        { provide: AuditoriaEstoqueService, useValue: auditoriaMock },
      ],
    });

    service = TestBed.inject(MedicamentosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('prevents outbound stock movement exceeding current balance', () => {
    let errorMsg = '';

    service
      .movimentarSaldo({
        medicamento: mockAmoxicilina,
        tipo: 'SAIDA',
        quantidade: 75,
        observacao: 'Saída inválida',
      })
      .subscribe({
        error: (err: Error) => {
          errorMsg = err.message;
        },
      });

    expect(errorMsg).toContain('Saldo insuficiente');
    httpMock.expectNone(`${environment.supabaseUrl}/rest/v1/medicamentos`);
  });

  it('updates medication balance and delegates audit log to AuditoriaEstoqueService', () => {
    service.loadMedicamentos().subscribe();
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([mockAmoxicilina]);

    service
      .movimentarSaldo({
        medicamento: mockAmoxicilina,
        tipo: 'SAIDA',
        quantidade: 20,
        observacao: 'Dispensação ambulatorial',
      })
      .subscribe();

    const patchReq = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos` && r.method === 'PATCH',
    );
    expect(patchReq.request.body).toEqual({ quantidade_atual: 40 });
    patchReq.flush([{ ...mockAmoxicilina, quantidade_atual: 40, status: 'REPOSICAO' }]);

    expect(auditoriaMock.registrarLog).toHaveBeenCalledWith({
      medicamento_id: mockAmoxicilina.id,
      tipo: 'SAIDA',
      quantidade_anterior: 60,
      quantidade_movimentada: 20,
      quantidade_posterior: 40,
      gerente_responsavel_id: mockGerente.id,
      medico_solicitante_id: undefined,
      observacao: 'Dispensação ambulatorial',
    });
    expect(service.medicamentos()[0]?.status).toBe('REPOSICAO');
  });
});
