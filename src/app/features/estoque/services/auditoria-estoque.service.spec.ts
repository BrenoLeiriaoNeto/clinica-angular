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

  it('appends new audit log to signal state on registrarLog', () => {
    service
      .registrarLog({
        medicamento_id: 'aaaaaaaa-0001-0001-0001-000000000001',
        tipo: 'ENTRADA',
        quantidade_anterior: 10,
        quantidade_movimentada: 25,
        quantidade_posterior: 35,
        gerente_responsavel_id: '33333333-3333-3333-3333-333333333333',
        observacao: 'Nota fiscal 992',
      })
      .subscribe();

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.supabaseUrl}/rest/v1/estoque_movimentacoes` && r.method === 'POST',
    );
    req.flush([
      {
        id: 'bbbbbbbb-0001-0001-0001-000000000009',
        ...req.request.body,
        criado_em: '2026-11-22T14:00:00Z',
      },
    ]);

    expect(service.movimentacoes().length).toBe(1);
    expect(service.movimentacoes()[0]?.quantidade_posterior).toBe(35);
  });
});
