import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { UserProfile } from '../../../core/models/auth.model';
import { PedidoEstoque } from '../models/estoque.model';
import { AuditoriaEstoqueService } from './auditoria-estoque.service';
import { MedicamentosService } from './medicamentos.service';
import { PedidosEstoqueService } from './pedidos-estoque.service';

describe('PedidosEstoqueService', () => {
  let service: PedidosEstoqueService;
  let httpMock: HttpTestingController;

  const medicamentosMock = {
    loadMedicamentos: vi.fn(() => of([])),
  };

  const auditoriaMock = {
    movimentacoes: signal([]).asReadonly(),
    loadMovimentacoes: vi.fn(() => of([])),
  };

  const mockGerente: UserProfile = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'estoque@medicore.com',
    fullName: 'Roberto Nogueira',
    role: 'GERENTE_ESTOQUE',
  };

  const basePedido: PedidoEstoque = {
    id: 'dddddddd-0001-0001-0001-000000000001',
    medicamento_id: 'aaaaaaaa-0001-0001-0001-000000000001',
    quantidade_solicitada: 40,
    status: 'APROVADO',
    medico_solicitante_id: '22222222-2222-2222-2222-222222222222',
    gerente_responsavel_id: mockGerente.id,
    justificativa: 'Reposição urgente',
    criado_em: '2026-11-22T10:00:00Z',
    atualizado_em: '2026-11-22T10:00:00Z',
  };

  beforeEach(() => {
    medicamentosMock.loadMedicamentos.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { currentUser: signal<UserProfile | null>(mockGerente).asReadonly() },
        },
        { provide: MedicamentosService, useValue: medicamentosMock },
        { provide: AuditoriaEstoqueService, useValue: auditoriaMock },
      ],
    });

    service = TestBed.inject(PedidosEstoqueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('rejects fractional order quantities before making HTTP calls', () => {
    let errorMsg = '';

    service
      .solicitar({
        medicamento_id: 'aaaaaaaa-0001-0001-0001-000000000001',
        quantidade_solicitada: 0.5,
        justificativa: 'Teste decimal',
      })
      .subscribe({ error: (err: Error) => (errorMsg = err.message) });

    expect(errorMsg).toContain('quantidade inteira');
    httpMock.expectNone(`${environment.supabaseUrl}/rest/v1/pedidos_estoque`);
  });

  it('calls atomic receber_pedido_estoque RPC and prevents duplicate receipt', () => {
    service.atualizarStatus(basePedido, 'RECEBIDO').subscribe();

    const rpcReq = httpMock.expectOne(
      `${environment.supabaseUrl}/rest/v1/rpc/receber_pedido_estoque`,
    );
    expect(rpcReq.request.method).toBe('POST');
    expect(rpcReq.request.body).toEqual({ p_pedido_id: basePedido.id });
    rpcReq.flush({ ...basePedido, status: 'RECEBIDO' });

    expect(medicamentosMock.loadMedicamentos).toHaveBeenCalledTimes(1);

    let duplicateError = '';
    service
      .atualizarStatus({ ...basePedido, status: 'RECEBIDO' }, 'RECEBIDO')
      .subscribe({ error: (err: Error) => (duplicateError = err.message) });

    expect(duplicateError).toContain('não pode mais ser recebido');
  });
});
