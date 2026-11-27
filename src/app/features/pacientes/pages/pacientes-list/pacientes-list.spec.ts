import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { environment } from '../../../../../environments/environment';
import { Paciente } from '../../models/paciente.model';
import { PacientesListPage } from './pacientes-list';

describe('PacientesListPage (Integração)', () => {
  let fixture: ComponentFixture<PacientesListPage>;
  let httpMock: HttpTestingController;

  const mockPacientes: Paciente[] = [
    {
      id: 'pac-1',
      email: 'paciente@medicore.com',
      nome_completo: 'Lucas Mendes',
      role: 'PACIENTE',
      documento: '***.482.910-**',
      data_nascimento: '1994-05-18',
      telefone: '(11) 99123-4567',
      ativo: true,
      criado_em: '2026-11-20T10:00:00Z',
      atualizado_em: '2026-11-20T10:00:00Z',
    },
    {
      id: 'pac-2',
      email: 'carlos.inativo@medicore.com',
      nome_completo: 'Carlos Eduardo Lima',
      role: 'PACIENTE',
      documento: '529.982.247-25',
      data_nascimento: '1988-03-10',
      telefone: '(11) 98877-6655',
      ativo: false,
      criado_em: '2026-10-15T09:00:00Z',
      atualizado_em: '2026-10-15T09:00:00Z',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PacientesListPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PacientesListPage);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('carrega pacientes, oculta inativos por padrão e filtra por busca e checkbox', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.supabaseUrl}/rest/v1/perfis` &&
        r.method === 'GET' &&
        r.params.get('role') === 'eq.PACIENTE',
    );
    req.flush(mockPacientes);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.querySelector('tbody')?.textContent).toContain('Lucas Mendes');
    expect(el.querySelector('tbody')?.textContent).not.toContain('Carlos Eduardo Lima');

    const checkbox = el.querySelector('.filter-bar__checkbox input') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(el.querySelectorAll('tbody tr').length).toBe(2);

    const searchInput = el.querySelector('#pacientes-search') as HTMLInputElement;
    searchInput.value = '52998224725';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.querySelector('tbody')?.textContent).toContain('Carlos Eduardo Lima');
  });

  it('inativa paciente após confirmação via diálogo e dispara PATCH', () => {
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/perfis`)
      .flush([mockPacientes[0]!]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const inativarBtn = el.querySelector(
      'button[aria-label="Inativar Lucas Mendes"]',
    ) as HTMLButtonElement | null;
    expect(inativarBtn).toBeTruthy();

    inativarBtn!.click();
    fixture.detectChanges();

    const confirmBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Inativar',
    );
    expect(confirmBtn).toBeTruthy();
    confirmBtn!.click();

    const patchReq = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/perfis` && r.method === 'PATCH',
    );
    expect(patchReq.request.body).toEqual({ ativo: false });
    patchReq.flush([{ ...mockPacientes[0]!, ativo: false }]);
    fixture.detectChanges();

    expect(el.querySelectorAll('tbody tr').length).toBe(0);
  });
});
