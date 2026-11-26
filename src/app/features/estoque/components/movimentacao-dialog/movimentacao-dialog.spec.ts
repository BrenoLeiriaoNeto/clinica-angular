import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from '@openng/optimus-ui/api';
import { of, throwError } from 'rxjs';
import { Medicamento } from '../../models/estoque.model';
import { MedicamentosService } from '../../services/medicamentos.service';
import { MovimentacaoDialog } from './movimentacao-dialog';

describe('MovimentacaoDialog', () => {
  let fixture: ComponentFixture<MovimentacaoDialog>;
  let component: MovimentacaoDialog;
  let messageService: MessageService;

  const isSubmittingSignal = signal(false);

  const medicamentosServiceMock = {
    isSubmitting: isSubmittingSignal.asReadonly(),
    movimentarSaldo: vi.fn(),
  };

  const mockMed: Medicamento = {
    id: 'med-1',
    codigo_sku: 'MED-001',
    nome: 'Amoxicilina 500mg',
    principio_ativo: 'Amoxicilina Tri-hidratada',
    unidade_medida: 'Caixa c/ 21 caps',
    quantidade_atual: 40,
    estoque_minimo: 50,
    status: 'REPOSICAO',
    ativo: true,
    criado_em: '2026-11-20T10:00:00Z',
    atualizado_em: '2026-11-20T10:00:00Z',
  };

  beforeEach(async () => {
    isSubmittingSignal.set(false);
    medicamentosServiceMock.movimentarSaldo.mockReset();

    await TestBed.configureTestingModule({
      imports: [MovimentacaoDialog],
      providers: [
        MessageService,
        { provide: MedicamentosService, useValue: medicamentosServiceMock },
      ],
    }).compileComponents();

    messageService = TestBed.inject(MessageService);
    vi.spyOn(messageService, 'add');

    fixture = TestBed.createComponent(MovimentacaoDialog);
    component = fixture.componentInstance;
  });

  function changeSelect(value: string): void {
    const select = fixture.nativeElement.querySelector('#mov-tipo') as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
  }

  function changeQty(value: string): void {
    const input = fixture.nativeElement.querySelector('#mov-qtd') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  it('computes preview balance and status across ENTRADA, SAIDA, and AJUSTE', () => {
    fixture.componentRef.setInput('medicamento', mockMed);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // ENTRADA: 40 + 15 = 55 (>= 50 -> Estoque Normal)
    changeQty('15');
    expect(el.textContent).toContain('Saldo após operação:');
    expect(el.textContent).toContain('55');
    expect(el.textContent).toContain('Estoque Normal');

    // SAIDA: 40 - 10 = 30 (< 50 -> Reposição Necessária)
    changeSelect('SAIDA');
    changeQty('10');
    expect(el.textContent).toContain('30');
    expect(el.textContent).toContain('Reposição Necessária');

    // AJUSTE: muda label e define novo saldo final diretamente
    changeSelect('AJUSTE');
    changeQty('75');
    expect(el.textContent).toContain('Novo Saldo Final');
    expect(el.textContent).toContain('75');
  });

  it('validates integer, non-positive, negative ajuste, and insufficient stock rules', () => {
    fixture.componentRef.setInput('medicamento', mockMed);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;

    changeQty('1.5');
    expect(el.querySelector('#mov-qtd-err')?.textContent).toContain('número inteiro');

    changeQty('0');
    expect(el.querySelector('#mov-qtd-err')?.textContent).toContain('maior que zero');

    changeSelect('SAIDA');
    changeQty('45');
    expect(el.querySelector('#mov-qtd-err')?.textContent).toContain('Saldo insuficiente (disponível: 40)');

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(medicamentosServiceMock.movimentarSaldo).not.toHaveBeenCalled();

    changeSelect('AJUSTE');
    changeQty('-1');
    expect(el.querySelector('#mov-qtd-err')?.textContent).toContain('não pode ser negativo');
  });

  it('submits valid movement, emits moved, shows toast, and closes dialog', () => {
    const updatedMed: Medicamento = { ...mockMed, quantidade_atual: 60, status: 'NORMAL' };
    medicamentosServiceMock.movimentarSaldo.mockReturnValueOnce(of(updatedMed));
    const movedSpy = vi.fn();
    component.moved.subscribe(movedSpy);

    fixture.componentRef.setInput('medicamento', mockMed);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    changeQty('20');
    const obs = fixture.nativeElement.querySelector('#mov-obs') as HTMLTextAreaElement;
    obs.value = 'NF-1020';
    obs.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(medicamentosServiceMock.movimentarSaldo).toHaveBeenCalledWith({
      medicamento: mockMed,
      tipo: 'ENTRADA',
      quantidade: 20,
      observacao: 'NF-1020',
    });
    expect(movedSpy).toHaveBeenCalledWith(updatedMed);
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Movimentação realizada' }),
    );
    expect(component.visible()).toBe(false);
  });

  it('displays submit errors and allows closing via Cancelar', () => {
    medicamentosServiceMock.movimentarSaldo
      .mockReturnValueOnce(throwError(() => new Error('RPC recusada')))
      .mockReturnValueOnce(throwError(() => 'unexpected'));

    fixture.componentRef.setInput('medicamento', mockMed);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const form = el.querySelector('form') as HTMLFormElement;

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('RPC recusada');

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Erro ao registrar movimentação de estoque.',
    );

    const cancelBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancelar'),
    );
    cancelBtn?.click();
    fixture.detectChanges();

    expect(component.visible()).toBe(false);
  });
});
