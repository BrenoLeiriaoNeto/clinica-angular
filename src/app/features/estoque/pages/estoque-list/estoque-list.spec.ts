import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserProfile, UserRole } from '../../../../core/models/auth.model';
import { Medicamento } from '../../models/estoque.model';
import { EstoqueListPage } from './estoque-list';

describe('EstoqueListPage (Integração)', () => {
  let fixture: ComponentFixture<EstoqueListPage>;
  let httpMock: HttpTestingController;
  let currentUserSignal: ReturnType<typeof signal<UserProfile | null>>;

  const mockGerente: UserProfile = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'estoque@medicore.com',
    fullName: 'Roberto Nogueira',
    role: 'GERENTE_ESTOQUE',
  };

  const mockMedico: UserProfile = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'medico@medicore.com',
    fullName: 'Dra. Helena Costa',
    role: 'MEDICO',
  };

  const mockCatalogo: Medicamento[] = [
    {
      id: 'med-1',
      codigo_sku: 'MED-001',
      nome: 'Amoxicilina 500mg',
      principio_ativo: 'Amoxicilina Tri-hidratada',
      unidade_medida: 'Caixa c/ 21 caps',
      quantidade_atual: 25,
      estoque_minimo: 50,
      status: 'REPOSICAO',
      ativo: true,
      criado_em: '2026-11-20T10:00:00Z',
      atualizado_em: '2026-11-20T10:00:00Z',
    },
    {
      id: 'med-2',
      codigo_sku: 'MED-002',
      nome: 'Dipirona 1g',
      principio_ativo: 'Dipirona Sódica',
      unidade_medida: 'Caixa c/ 10 comp',
      quantidade_atual: 120,
      estoque_minimo: 40,
      status: 'NORMAL',
      ativo: true,
      criado_em: '2026-11-20T10:00:00Z',
      atualizado_em: '2026-11-20T10:00:00Z',
    },
  ];

  beforeEach(async () => {
    currentUserSignal = signal<UserProfile | null>(mockGerente);

    await TestBed.configureTestingModule({
      imports: [EstoqueListPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        {
          provide: AuthService,
          useValue: {
            currentUser: currentUserSignal.asReadonly(),
            hasAnyRole: (roles: UserRole[]) => {
              const role = currentUserSignal()?.role;
              return role ? roles.includes(role) : false;
            },
          },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EstoqueListPage);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('carrega o catálogo via HTTP, calcula KPIs e filtra por busca e status', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos` && r.method === 'GET',
    );
    req.flush(mockCatalogo);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(el.textContent).toContain('Amoxicilina 500mg');
    expect(el.textContent).toContain('145'); // 25 + 120 unidades em estoque

    const statusSelect = el.querySelector('#estoque-status-filter') as HTMLSelectElement;
    statusSelect.value = 'REPOSICAO';
    statusSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.querySelector('tbody')?.textContent).toContain('MED-001');

    const searchInput = el.querySelector('#estoque-search') as HTMLInputElement;
    searchInput.value = 'inexistente';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(el.querySelectorAll('tbody tr').length).toBe(0);
  });

  it('restringe ações administrativas no DOM conforme o perfil do usuário (RBAC)', () => {
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush(mockCatalogo);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Novo Medicamento');

    currentUserSignal.set(mockMedico);
    fixture.detectChanges();

    expect(el.textContent).not.toContain('Novo Medicamento');
    expect(el.textContent).toContain('Solicitar Re-estoque');
  });

  it('filtra itens descontinuados pelo checkbox e permite descontinuar via confirmação', () => {
    const inativo: Medicamento = {
      ...mockCatalogo[0]!,
      id: 'med-3',
      codigo_sku: 'MED-003',
      nome: 'Nimesulida 100mg',
      ativo: false,
    };

    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush([...mockCatalogo, inativo]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // Inativo oculto por padrão
    expect(el.querySelectorAll('tbody tr').length).toBe(2);

    const showInactiveCheckbox = el.querySelector(
      '.filter-bar__checkbox input[type="checkbox"]',
    ) as HTMLInputElement;
    showInactiveCheckbox.checked = true;
    showInactiveCheckbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(3);

    // Abre confirmação de descontinuar e cancela
    const descontinuarBtn = el.querySelector(
      'button[aria-label="Descontinuar Amoxicilina 500mg"]',
    ) as HTMLButtonElement;
    descontinuarBtn.click();
    fixture.detectChanges();

    const cancelBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancelar'),
    );
    cancelBtn?.click();
    fixture.detectChanges();

    // Abre novamente e confirma via PATCH
    descontinuarBtn.click();
    fixture.detectChanges();

    const confirmBtn = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.confirm-dialog__actions button'),
    ).find((b) => b.textContent?.trim() === 'Descontinuar');
    expect(confirmBtn).toBeTruthy();
    confirmBtn!.click();

    const patchReq = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos` && r.method === 'PATCH',
    );
    expect(patchReq.request.body).toEqual({ ativo: false });
    patchReq.flush([{ ...mockCatalogo[0]!, ativo: false }]);
    fixture.detectChanges();

    expect(el.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('exibe alerta de erro quando falha o carregamento e permite abrir dialogs de cadastro e movimentação', () => {
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/medicamentos`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar o catálogo de medicamentos.',
    );

    const novoBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Novo Medicamento'),
    );
    novoBtn?.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Código SKU');
  });
});
