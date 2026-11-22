import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { Medicamento } from '../models/estoque.model';
import { AuditoriaEstoqueService } from './auditoria-estoque.service';
import { MedicamentosService } from './medicamentos.service';

describe('MedicamentosService', () => {
  let service: MedicamentosService;
  let httpMock: HttpTestingController;

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
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AuditoriaEstoqueService],
    });

    service = TestBed.inject(MedicamentosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('rejects non-integer and excessive outbound stock quantities before calling RPC', () => {
    let fractionalError = '';
    service
      .movimentarSaldo({
        medicamento: mockAmoxicilina,
        tipo: 'ENTRADA',
        quantidade: 1.5,
        observacao: 'Fracionado inválido',
      })
      .subscribe({ error: (err: Error) => (fractionalError = err.message) });

    expect(fractionalError).toContain('número inteiro');

    let insufficientError = '';
    service
      .movimentarSaldo({
        medicamento: mockAmoxicilina,
        tipo: 'SAIDA',
        quantidade: 75,
        observacao: 'Saída acima do saldo',
      })
      .subscribe({ error: (err: Error) => (insufficientError = err.message) });

    expect(insufficientError).toContain('Saldo insuficiente');
    httpMock.expectNone(`${environment.supabaseUrl}/rest/v1/rpc/registrar_movimentacao_estoque`);
  });

  it('calls atomic registrar_movimentacao_estoque RPC and updates signal state', () => {
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

    const rpcReq = httpMock.expectOne(
      `${environment.supabaseUrl}/rest/v1/rpc/registrar_movimentacao_estoque`,
    );
    expect(rpcReq.request.method).toBe('POST');
    expect(rpcReq.request.body).toEqual({
      p_medicamento_id: mockAmoxicilina.id,
      p_tipo: 'SAIDA',
      p_quantidade: 20,
      p_observacao: 'Dispensação ambulatorial',
      p_medico_solicitante_id: null,
    });

    rpcReq.flush({
      ...mockAmoxicilina,
      quantidade_atual: 40,
      status: 'REPOSICAO',
    });

    expect(service.medicamentos()[0]?.quantidade_atual).toBe(40);
    expect(service.medicamentos()[0]?.status).toBe('REPOSICAO');
  });
});
