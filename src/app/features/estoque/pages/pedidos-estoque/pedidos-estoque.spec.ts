import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserProfile, UserRole } from '../../../../core/models/auth.model';
import { PedidoEstoque } from '../../models/estoque.model';
import { PedidosEstoquePage } from './pedidos-estoque';

describe('PedidosEstoquePage (Integração)', () => {
  let fixture: ComponentFixture<PedidosEstoquePage>;
  let httpMock: HttpTestingController;
  let userSignal: ReturnType<typeof signal<UserProfile | null>>;

  const mockGerente: UserProfile = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'estoque@medicore.com',
    fullName: 'Roberto Nogueira',
    role: 'GERENTE_ESTOQUE',
  };

  const mockPedidoPendente: PedidoEstoque = {
    id: 'ped-1',
    medicamento_id: 'med-1',
    quantidade_solicitada: 50,
    status: 'PENDENTE',
    medico_solicitante_id: '22222222-2222-2222-2222-222222222222',
    gerente_responsavel_id: null,
    justificativa: 'Alta demanda no pronto atendimento',
    criado_em: '2026-11-22T09:00:00Z',
    atualizado_em: '2026-11-22T09:00:00Z',
    medicamento: {
      id: 'med-1',
      codigo_sku: 'MED-001',
      nome: 'Amoxicilina 500mg',
      unidade_medida: 'Caixa c/ 21 caps',
      quantidade_atual: 20,
      estoque_minimo: 50,
    },
  };

  beforeEach(async () => {
    userSignal = signal<UserProfile | null>(mockGerente);

    await TestBed.configureTestingModule({
      imports: [PedidosEstoquePage],
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
    fixture = TestBed.createComponent(PedidosEstoquePage);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('aprova pedido PENDENTE via PATCH e atualiza o status na tabela', () => {
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque`)
      .flush([mockPedidoPendente]);
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const aprovarBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Aprovar'),
    );
    expect(aprovarBtn).toBeTruthy();

    aprovarBtn!.click();

    const patchReq = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque` && r.method === 'PATCH',
    );
    expect(patchReq.request.body.status).toBe('APROVADO');
    patchReq.flush([{ ...mockPedidoPendente, status: 'APROVADO' }]);
    fixture.detectChanges();

    expect(el.textContent).toContain('Aprovado');
  });

  it('confirma recebimento via RPC atômica e recarrega medicamentos', () => {
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/pedidos_estoque`)
      .flush([{ ...mockPedidoPendente, status: 'APROVADO' }]);
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const receberBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Receber'),
    );
    receberBtn!.click();
    fixture.detectChanges();

    const confirmBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirmar Recebimento'),
    );
    expect(confirmBtn).toBeTruthy();
    confirmBtn!.click();

    const rpcReq = httpMock.expectOne(
      `${environment.supabaseUrl}/rest/v1/rpc/receber_pedido_estoque`,
    );
    expect(rpcReq.request.body).toEqual({ p_pedido_id: 'ped-1' });
    rpcReq.flush({ ...mockPedidoPendente, status: 'RECEBIDO' });

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([]);
    fixture.detectChanges();

    expect(el.textContent).toContain('Recebido');
  });
});
