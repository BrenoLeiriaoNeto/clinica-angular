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

  const userSignal = signal<UserProfile | null>(mockGerente);
  const auditoriaMovsSignal = signal<{ id: string }[]>([]);

  const auditoriaMock = {
    movimentacoes: auditoriaMovsSignal.asReadonly(),
    loadMovimentacoes: vi.fn(() => of([])),
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
    userSignal.set(mockGerente);
    auditoriaMovsSignal.set([]);
    medicamentosMock.loadMedicamentos.mockClear();
    auditoriaMock.loadMovimentacoes.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { currentUser: userSignal.asReadonly() },
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

  it('loads pedidos, computes pedidosPendentes, and handles HTTP failure', () => {
    const pendente: PedidoEstoque = { ...basePedido, id: 'ped-pendente', status: 'PENDENTE' };
    service.loadPedidos().subscribe();

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque`)
      .flush([pendente, basePedido]);

    expect(service.pedidos().length).toBe(2);
    expect(service.pedidosPendentes()).toEqual([pendente]);

    service.loadPedidos().subscribe({ error: () => undefined });
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque`)
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(service.error()).toBe('Não foi possível carregar os pedidos de reestoque.');
    expect(service.isLoading()).toBe(false);
  });

  it('rejects solicitar and atualizarStatus when user is not authenticated', () => {
    userSignal.set(null);

    let solicitarErr = '';
    service
      .solicitar({
        medicamento_id: 'med-1',
        quantidade_solicitada: 10,
        justificativa: 'Reposição',
      })
      .subscribe({ error: (err: Error) => (solicitarErr = err.message) });
    expect(solicitarErr).toBe('Usuário não autenticado.');

    let updateErr = '';
    service
      .atualizarStatus(basePedido, 'CANCELADO')
      .subscribe({ error: (err: Error) => (updateErr = err.message) });
    expect(updateErr).toBe('Usuário não autenticado.');
  });

  it('creates pedidos assigning medico_solicitante_id for MEDICO and gerente_responsavel_id for GERENTE_ESTOQUE', () => {
    userSignal.set(mockMedico);
    service
      .solicitar({
        medicamento_id: ' med-1 ',
        quantidade_solicitada: 25,
        justificativa: '  Necessário para plantão  ',
      })
      .subscribe();

    const medicoReq = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque` && r.method === 'POST',
    );
    expect(medicoReq.request.body).toEqual({
      medicamento_id: 'med-1',
      quantidade_solicitada: 25,
      status: 'PENDENTE',
      medico_solicitante_id: mockMedico.id,
      gerente_responsavel_id: null,
      justificativa: 'Necessário para plantão',
    });
    medicoReq.flush([{ ...basePedido, id: 'ped-med', status: 'PENDENTE' }]);
    expect(service.pedidos()[0]?.id).toBe('ped-med');

    userSignal.set(mockGerente);
    service
      .solicitar({
        medicamento_id: 'med-2',
        quantidade_solicitada: 50,
        justificativa: '   ',
      })
      .subscribe();

    const gerenteReq = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque` && r.method === 'POST',
    );
    expect(gerenteReq.request.body).toEqual({
      medicamento_id: 'med-2',
      quantidade_solicitada: 50,
      status: 'PENDENTE',
      medico_solicitante_id: null,
      gerente_responsavel_id: mockGerente.id,
      justificativa: null,
    });
    gerenteReq.flush([{ ...basePedido, id: 'ped-ger', status: 'PENDENTE' }]);
    expect(service.pedidos()[0]?.id).toBe('ped-ger');
  });

  it('calls atomic receber_pedido_estoque RPC, reloads auditoria when populated, and prevents duplicate receipt', () => {
    auditoriaMovsSignal.set([{ id: 'mov-1' }]);
    service.atualizarStatus(basePedido, 'RECEBIDO').subscribe();

    const rpcReq = httpMock.expectOne(
      `${environment.supabaseUrl}/rest/v1/rpc/receber_pedido_estoque`,
    );
    expect(rpcReq.request.method).toBe('POST');
    expect(rpcReq.request.body).toEqual({ p_pedido_id: basePedido.id });
    rpcReq.flush({ ...basePedido, status: 'RECEBIDO' });

    expect(medicamentosMock.loadMedicamentos).toHaveBeenCalledTimes(1);
    expect(auditoriaMock.loadMovimentacoes).toHaveBeenCalledTimes(1);

    let duplicateError = '';
    service
      .atualizarStatus({ ...basePedido, status: 'RECEBIDO' }, 'RECEBIDO')
      .subscribe({ error: (err: Error) => (duplicateError = err.message) });

    expect(duplicateError).toContain('não pode mais ser recebido');
  });

  it('updates pedido status to APROVADO and CANCELADO via PATCH', () => {
    const pendente: PedidoEstoque = { ...basePedido, status: 'PENDENTE' };
    service.loadPedidos().subscribe();
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque`)
      .flush([pendente]);

    service.atualizarStatus(pendente, 'APROVADO').subscribe();
    const approveReq = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque` && r.method === 'PATCH',
    );
    expect(approveReq.request.body.status).toBe('APROVADO');
    expect(approveReq.request.body.gerente_responsavel_id).toBe(mockGerente.id);
    approveReq.flush([{ ...pendente, status: 'APROVADO' }]);
    expect(service.pedidos()[0]?.status).toBe('APROVADO');

    service.atualizarStatus({ ...pendente, status: 'APROVADO' }, 'CANCELADO').subscribe();
    const cancelReq = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque` && r.method === 'PATCH',
    );
    expect(cancelReq.request.body.status).toBe('CANCELADO');
    cancelReq.flush([{ ...pendente, status: 'CANCELADO' }]);
    expect(service.pedidos()[0]?.status).toBe('CANCELADO');
  });
});
