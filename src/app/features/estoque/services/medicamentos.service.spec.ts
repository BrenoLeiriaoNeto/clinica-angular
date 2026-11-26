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

  it('computes active items, low-stock alerts, and total units and handles load error', () => {
    const lowStock: Medicamento = {
      ...mockAmoxicilina,
      id: 'med-2',
      codigo_sku: 'MED-002',
      nome: 'Dipirona 1g',
      quantidade_atual: 10,
      status: 'REPOSICAO',
      ativo: true,
    };
    const inactive: Medicamento = {
      ...mockAmoxicilina,
      id: 'med-3',
      codigo_sku: 'MED-003',
      nome: 'Nimesulida',
      quantidade_atual: 20,
      status: 'REPOSICAO',
      ativo: false,
    };

    service.loadMedicamentos().subscribe();
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([mockAmoxicilina, lowStock, inactive]);

    expect(service.medicamentosAtivos().length).toBe(2);
    expect(service.itensEmReposicao()).toEqual([lowStock]);
    expect(service.totalUnidadesEmEstoque()).toBe(70);

    service.loadMedicamentos().subscribe({ error: () => undefined });
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(service.error()).toBe('Não foi possível carregar o catálogo de medicamentos.');
    expect(service.isLoading()).toBe(false);
  });

  it('validates and creates a new medicamento sorted alphabetically with normalized SKU', () => {
    let invalidError = '';
    service
      .criar({
        codigo_sku: '   ',
        nome: 'Teste',
        principio_ativo: 'Ativo',
        unidade_medida: 'Caixa',
        quantidade_atual: 10,
        estoque_minimo: 5,
      })
      .subscribe({ error: (err: Error) => (invalidError = err.message) });
    expect(invalidError).toContain('campos obrigatórios');

    service.loadMedicamentos().subscribe();
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([{ ...mockAmoxicilina, nome: 'Zolpidem 10mg' }]);

    service
      .criar({
        codigo_sku: ' med-010 ',
        nome: ' Analgésico A ',
        principio_ativo: ' Dipirona ',
        unidade_medida: ' Caixa ',
        quantidade_atual: 25,
        estoque_minimo: 10,
      })
      .subscribe();

    const postReq = httpMock.expectOne(`${environment.supabaseUrl}/rest/v1/medicamentos`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({
      codigo_sku: 'MED-010',
      nome: 'Analgésico A',
      principio_ativo: 'Dipirona',
      unidade_medida: 'Caixa',
      quantidade_atual: 25,
      estoque_minimo: 10,
    });
    postReq.flush([
      {
        ...mockAmoxicilina,
        id: 'med-new',
        codigo_sku: 'MED-010',
        nome: 'Analgésico A',
      },
    ]);

    expect(service.medicamentos().map((m) => m.nome)).toEqual(['Analgésico A', 'Zolpidem 10mg']);
    expect(service.isSubmitting()).toBe(false);
  });

  it('validates, updates, and toggles ativo flag on existing medicamento', () => {
    let invalidError = '';
    service
      .atualizar(mockAmoxicilina.id, {
        nome: '',
        principio_ativo: 'A',
        unidade_medida: 'Caixa',
        estoque_minimo: 10,
      })
      .subscribe({ error: (err: Error) => (invalidError = err.message) });
    expect(invalidError).toContain('Dados inválidos');

    service.loadMedicamentos().subscribe();
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([mockAmoxicilina]);

    service
      .atualizar(mockAmoxicilina.id, {
        nome: ' Amoxicilina Atualizada ',
        principio_ativo: ' Amoxicilina ',
        unidade_medida: ' Caixa ',
        estoque_minimo: 80,
      })
      .subscribe();

    const patchReq = httpMock.expectOne(
      (r) =>
        r.url === `${environment.supabaseUrl}/rest/v1/medicamentos` &&
        r.method === 'PATCH' &&
        r.params.get('id') === `eq.${mockAmoxicilina.id}`,
    );
    patchReq.flush([{ ...mockAmoxicilina, nome: 'Amoxicilina Atualizada', estoque_minimo: 80 }]);
    expect(service.medicamentos()[0]?.nome).toBe('Amoxicilina Atualizada');

    service.alternarAtivo(mockAmoxicilina).subscribe();
    const toggleReq = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos` && r.method === 'PATCH',
    );
    expect(toggleReq.request.body).toEqual({ ativo: false });
    toggleReq.flush([{ ...mockAmoxicilina, ativo: false }]);
    expect(service.medicamentos()[0]?.ativo).toBe(false);
  });

  it('validates non-positive ENTRADA and negative AJUSTE and reloads auditoria when populated', () => {
    let entryError = '';
    service
      .movimentarSaldo({
        medicamento: mockAmoxicilina,
        tipo: 'ENTRADA',
        quantidade: 0,
        observacao: '',
      })
      .subscribe({ error: (err: Error) => (entryError = err.message) });
    expect(entryError).toContain('maior que zero');

    let ajusteError = '';
    service
      .movimentarSaldo({
        medicamento: mockAmoxicilina,
        tipo: 'AJUSTE',
        quantidade: -5,
        observacao: '',
      })
      .subscribe({ error: (err: Error) => (ajusteError = err.message) });
    expect(ajusteError).toContain('não pode ser negativo');

    const auditoriaService = TestBed.inject(AuditoriaEstoqueService);
    auditoriaService.loadMovimentacoes().subscribe();
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/estoque_movimentacoes`)
      .flush([
        {
          id: 'mov-1',
          medicamento_id: mockAmoxicilina.id,
          tipo: 'ENTRADA',
          quantidade_anterior: 0,
          quantidade_movimentada: 60,
          quantidade_posterior: 60,
          gerente_responsavel_id: 'ger-1',
          medico_solicitante_id: null,
          observacao: null,
          criado_em: '2026-11-20T10:00:00Z',
        },
      ]);

    service
      .movimentarSaldo({
        medicamento: mockAmoxicilina,
        tipo: 'AJUSTE',
        quantidade: 0,
        observacao: '   ',
        medico_solicitante_id: ' med-user ',
      })
      .subscribe();

    const rpcReq = httpMock.expectOne(
      `${environment.supabaseUrl}/rest/v1/rpc/registrar_movimentacao_estoque`,
    );
    expect(rpcReq.request.body).toEqual({
      p_medicamento_id: mockAmoxicilina.id,
      p_tipo: 'AJUSTE',
      p_quantidade: 0,
      p_observacao: null,
      p_medico_solicitante_id: 'med-user',
    });
    rpcReq.flush({ ...mockAmoxicilina, quantidade_atual: 0, status: 'REPOSICAO' });

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/estoque_movimentacoes`)
      .flush([]);
  });
});
