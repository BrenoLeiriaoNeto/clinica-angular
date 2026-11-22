import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { UserProfile } from '../../../core/models/auth.model';
import { Medicamento, PedidoEstoque } from '../models/estoque.model';
import { MedicamentosService } from './medicamentos.service';
import { PedidosEstoqueService } from './pedidos-estoque.service';

describe('PedidosEstoqueService', () => {
  let service: PedidosEstoqueService;
  let httpMock: HttpTestingController;

  const medicamentosMock = {
    medicamentos: signal<Medicamento[]>([]).asReadonly(),
    movimentarSaldo: vi.fn(() => of({} as Medicamento)),
    loadMedicamentos: vi.fn(() => of([])),
  };

  const mockGerente: UserProfile = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'estoque@medicore.com',
    fullName: 'Roberto Nogueira',
    role: 'GERENTE_ESTOQUE',
  };

  beforeEach(() => {
    medicamentosMock.movimentarSaldo.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { currentUser: signal<UserProfile | null>(mockGerente).asReadonly() },
        },
        { provide: MedicamentosService, useValue: medicamentosMock },
      ],
    });

    service = TestBed.inject(PedidosEstoqueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('triggers stock entry via MedicamentosService when order status becomes RECEBIDO', () => {
    const pedido: PedidoEstoque = {
      id: 'dddddddd-0001-0001-0001-000000000001',
      medicamento_id: 'aaaaaaaa-0001-0001-0001-000000000001',
      quantidade_solicitada: 40,
      status: 'APROVADO',
      medico_solicitante_id: '22222222-2222-2222-2222-222222222222',
      gerente_responsavel_id: mockGerente.id,
      justificativa: 'Reposição urgente',
      criado_em: '2026-11-22T10:00:00Z',
      atualizado_em: '2026-11-22T10:00:00Z',
      medicamento: {
        id: 'aaaaaaaa-0001-0001-0001-000000000001',
        codigo_sku: 'MED-001',
        nome: 'Amoxicilina 500mg',
        unidade_medida: 'Caixa c/ 21 caps',
        quantidade_atual: 32,
        estoque_minimo: 50,
      },
    };

    service.atualizarStatus(pedido, 'RECEBIDO').subscribe();

    const patchReq = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque` && r.method === 'PATCH',
    );
    patchReq.flush([{ ...pedido, status: 'RECEBIDO' }]);

    expect(medicamentosMock.movimentarSaldo).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'ENTRADA',
        quantidade: 40,
        medico_solicitante_id: '22222222-2222-2222-2222-222222222222',
      }),
    );
  });
});
