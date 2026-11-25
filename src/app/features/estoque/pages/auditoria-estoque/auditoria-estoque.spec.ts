import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { AuditoriaEstoquePage } from './auditoria-estoque';

describe('AuditoriaEstoquePage (Integração)', () => {
  let fixture: ComponentFixture<AuditoriaEstoquePage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditoriaEstoquePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuditoriaEstoquePage);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('carrega a trilha imutável de auditoria e filtra por tipo de movimentação', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.supabaseUrl}/rest/v1/estoque_movimentacoes` && r.method === 'GET',
    );
    req.flush([
      {
        id: 'mov-1',
        medicamento_id: 'med-1',
        tipo: 'ENTRADA',
        quantidade_anterior: 20,
        quantidade_movimentada: 50,
        quantidade_posterior: 70,
        gerente_responsavel_id: 'ger-1',
        medico_solicitante_id: null,
        observacao: 'Recebimento NF-900',
        criado_em: '2026-11-22T10:00:00Z',
        medicamento: {
          id: 'med-1',
          codigo_sku: 'MED-001',
          nome: 'Amoxicilina 500mg',
          unidade_medida: 'Caixa c/ 21 caps',
        },
        gerente: { id: 'ger-1', nome_completo: 'Roberto Nogueira' },
      },
      {
        id: 'mov-2',
        medicamento_id: 'med-1',
        tipo: 'SAIDA',
        quantidade_anterior: 70,
        quantidade_movimentada: 10,
        quantidade_posterior: 60,
        gerente_responsavel_id: 'ger-1',
        medico_solicitante_id: null,
        observacao: 'Dispensação clínica',
        criado_em: '2026-11-22T14:00:00Z',
        medicamento: {
          id: 'med-1',
          codigo_sku: 'MED-001',
          nome: 'Amoxicilina 500mg',
          unidade_medida: 'Caixa c/ 21 caps',
        },
        gerente: { id: 'ger-1', nome_completo: 'Roberto Nogueira' },
      },
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('+50');
    expect(el.textContent).toContain('-10');

    const tipoSelect = el.querySelector('#auditoria-tipo-filter') as HTMLSelectElement;
    tipoSelect.value = 'SAIDA';
    tipoSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.querySelector('tbody')?.textContent).toContain('Dispensação clínica');
  });
});
