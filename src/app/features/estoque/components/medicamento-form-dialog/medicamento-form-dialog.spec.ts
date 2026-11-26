import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from '@openng/optimus-ui/api';
import { of, throwError } from 'rxjs';
import { Medicamento } from '../../models/estoque.model';
import { MedicamentosService } from '../../services/medicamentos.service';
import { MedicamentoFormDialog } from './medicamento-form-dialog';

describe('MedicamentoFormDialog', () => {
  let fixture: ComponentFixture<MedicamentoFormDialog>;
  let component: MedicamentoFormDialog;
  let messageService: MessageService;

  const isSubmittingSignal = signal(false);

  const medicamentosServiceMock = {
    isSubmitting: isSubmittingSignal.asReadonly(),
    criar: vi.fn(),
    atualizar: vi.fn(),
  };

  const mockMed: Medicamento = {
    id: 'med-1',
    codigo_sku: 'MED-001',
    nome: 'Amoxicilina 500mg',
    principio_ativo: 'Amoxicilina Tri-hidratada',
    unidade_medida: 'Caixa c/ 21 caps',
    quantidade_atual: 32,
    estoque_minimo: 50,
    status: 'REPOSICAO',
    ativo: true,
    criado_em: '2026-11-20T10:00:00Z',
    atualizado_em: '2026-11-20T10:00:00Z',
  };

  beforeEach(async () => {
    isSubmittingSignal.set(false);
    medicamentosServiceMock.criar.mockReset();
    medicamentosServiceMock.atualizar.mockReset();

    await TestBed.configureTestingModule({
      imports: [MedicamentoFormDialog],
      providers: [
        MessageService,
        { provide: MedicamentosService, useValue: medicamentosServiceMock },
      ],
    }).compileComponents();

    messageService = TestBed.inject(MessageService);
    vi.spyOn(messageService, 'add');

    fixture = TestBed.createComponent(MedicamentoFormDialog);
    component = fixture.componentInstance;
  });

  function setInputValue(selector: string, value: string): HTMLInputElement {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    return input;
  }

  it('validates Signal Form fields and marks invalid controls on submit in create mode', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Novo Medicamento');

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(medicamentosServiceMock.criar).not.toHaveBeenCalled();
    expect(el.querySelector('#med-sku-err')?.textContent).toContain('Informe o código SKU.');
    expect(el.querySelector('#med-nome-err')?.textContent).toContain('Informe o nome comercial');
    expect(el.querySelector('#med-principio-err')?.textContent).toContain(
      'Informe o princípio ativo.',
    );

    setInputValue('#med-saldo', '1.5');
    setInputValue('#med-minimo', '2.5');
    expect(el.querySelector('#med-saldo-err')?.textContent).toContain('número inteiro');
    expect(el.querySelector('#med-minimo-err')?.textContent).toContain('número inteiro');
  });

  it('submits a new medicamento, emits saved, shows toast, and closes the dialog', () => {
    medicamentosServiceMock.criar.mockReturnValueOnce(of(mockMed));
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);

    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    setInputValue('#med-sku', 'MED-001');
    setInputValue('#med-unidade', 'Caixa c/ 21 caps');
    setInputValue('#med-nome', 'Amoxicilina 500mg');
    setInputValue('#med-principio', 'Amoxicilina Tri-hidratada');
    setInputValue('#med-saldo', '32');
    setInputValue('#med-minimo', '50');

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(medicamentosServiceMock.criar).toHaveBeenCalledWith({
      codigo_sku: 'MED-001',
      nome: 'Amoxicilina 500mg',
      principio_ativo: 'Amoxicilina Tri-hidratada',
      unidade_medida: 'Caixa c/ 21 caps',
      quantidade_atual: 32,
      estoque_minimo: 50,
    });
    expect(savedSpy).toHaveBeenCalledWith(mockMed);
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Medicamento criado' }),
    );
    expect(component.visible()).toBe(false);
  });

  it('populates fields in edit mode, disables sku and saldo, and calls atualizar', () => {
    const updatedMed: Medicamento = { ...mockMed, nome: 'Amoxicilina 500mg Genérico', estoque_minimo: 60 };
    medicamentosServiceMock.atualizar.mockReturnValueOnce(of(updatedMed));
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);

    fixture.componentRef.setInput('medicamento', mockMed);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Editar Medicamento');
    expect(el.textContent).toContain('Para alterar o saldo, utilize a movimentação auditada.');

    const skuInput = el.querySelector('#med-sku') as HTMLInputElement;
    const saldoInput = el.querySelector('#med-saldo') as HTMLInputElement;
    expect(skuInput.disabled).toBe(true);
    expect(saldoInput.disabled).toBe(true);

    setInputValue('#med-nome', 'Amoxicilina 500mg Genérico');
    setInputValue('#med-minimo', '60');

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(medicamentosServiceMock.atualizar).toHaveBeenCalledWith(mockMed.id, {
      nome: 'Amoxicilina 500mg Genérico',
      principio_ativo: mockMed.principio_ativo,
      unidade_medida: mockMed.unidade_medida,
      estoque_minimo: 60,
    });
    expect(savedSpy).toHaveBeenCalledWith(updatedMed);
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Medicamento atualizado' }),
    );
    expect(component.visible()).toBe(false);
  });

  it('displays error alert on failure and closes on Cancelar click', () => {
    medicamentosServiceMock.criar
      .mockReturnValueOnce(throwError(() => new Error('SKU duplicado')))
      .mockReturnValueOnce(throwError(() => 'unknown-error'));

    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    setInputValue('#med-sku', 'MED-999');
    setInputValue('#med-nome', 'Ibuprofeno 600mg');
    setInputValue('#med-principio', 'Ibuprofeno');

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('SKU duplicado');
    expect(component.visible()).toBe(true);

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível salvar o medicamento',
    );

    const cancelBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancelar'),
    );
    cancelBtn?.click();
    fixture.detectChanges();

    expect(component.visible()).toBe(false);
  });
});
