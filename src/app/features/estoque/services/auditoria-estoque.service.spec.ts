import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { AuditoriaEstoqueService } from './auditoria-estoque.service';

describe('AuditoriaEstoqueService', () => {
  let service: AuditoriaEstoqueService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuditoriaEstoqueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads immutable audit logs only upon subscription and updates loading state', () => {
    const request$ = service.loadMovimentacoes();
    expect(service.isLoading()).toBe(false);

    request$.subscribe();
    expect(service.isLoading()).toBe(true);

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.supabaseUrl}/rest/v1/estoque_movimentacoes` && r.method === 'GET',
    );
    req.flush([
      {
        id: 'bbbbbbbb-0001-0001-0001-000000000001',
        medicamento_id: 'aaaaaaaa-0001-0001-0001-000000000001',
        tipo: 'SAIDA',
        quantidade_anterior: 50,
        quantidade_movimentada: 18,
        quantidade_posterior: 32,
        gerente_responsavel_id: '33333333-3333-3333-3333-333333333333',
        medico_solicitante_id: null,
        observacao: 'Dispensação',
        criado_em: '2026-11-22T14:00:00Z',
      },
    ]);

    expect(service.isLoading()).toBe(false);
    expect(service.movimentacoes().length).toBe(1);
    expect(service.movimentacoes()[0]?.quantidade_posterior).toBe(32);
  });
});
