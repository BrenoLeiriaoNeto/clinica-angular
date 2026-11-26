import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from '@openng/optimus-ui/api';
import { of, throwError } from 'rxjs';
import { Medicamento, PedidoEstoque } from '../../models/estoque.model';
import { PedidosEstoqueService } from '../../services/pedidos-estoque.service';
import { PedidoFormDialog } from './pedido-form-dialog';

describe('PedidoFormDialog', () => {
  let fixture: ComponentFixture<PedidoFormDialog>;
  let component: PedidoFormDialog;
  let messageService: MessageService;

  const isSubmittingSignal = signal(false);

  const pedidosServiceMock = {
    isSubmitting: isSubmittingSignal.asReadonly(),
    solicitar: vi.fn(),
  };

  const mockMedicamentos: Medicamento[] = [
    {
      id: 'med-1',
      codigo_sku: 'MED-001',
      nome: 'Amoxicilina 500mg',
      principio_ativo: 'Amoxicilina',
      unidade_medida: 'Caixa',
      quantidade_atual: 15,
      estoque_minimo: 50,
      status: 'REPOSICAO',
      ativo: true,
      criado_em: '2026-11-20T10:00:00Z',
      atualizado_em: '2026-11-20T10:00:00Z',
    },
    {
      id: 'med-inativo',
      codigo_sku: 'MED-005',
      nome: 'Nimesulida Descontinuada',
      principio_ativo: 'Nimesulida',
      unidade_medida: 'Caixa',
      quantidade_atual: 0,
      estoque_minimo: 50,
      status: 'REPOSICAO',
      ativo: false,
      criado_em: '2026-11-20T10:00:00Z',
      atualizado_em: '2026-11-20T10:00:00Z',
    },
  ];

  const createdPedido: PedidoEstoque = {
    id: 'ped-1',
    medicamento_id: 'med-1',
    quantidade_solicitada: 80,
    status: 'PENDENTE',
    medico_solicitante_id: 'med-user-1',
    gerente_responsavel_id: null,
    justificativa: 'Demanda alta no pronto atendimento',
    criado_em: '2026-11-22T10:00:00Z',
    atualizado_em: '2026-11-22T10:00:00Z',
  };

  beforeEach(async () => {
    isSubmittingSignal.set(false);
    pedidosServiceMock.solicitar.mockReset();

    await TestBed.configureTestingModule({
      imports: [PedidoFormDialog],
      providers: [
        MessageService,
        { provide: PedidosEstoqueService, useValue: pedidosServiceMock },
      ],
    }).compileComponents();

    messageService = TestBed.inject(MessageService);
    vi.spyOn(messageService, 'add');

    fixture = TestBed.createComponent(PedidoFormDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('medicamentos', mockMedicamentos);
  });

  it('lists only active medicamentos and validates required fields and positive integer quantity', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const options = Array.from(el.querySelectorAll('#ped-med option')).map((o) =>
      o.textContent?.trim(),
    );

    expect(options.some((text) => text?.includes('Amoxicilina 500mg'))).toBe(true);
    expect(options.some((text) => text?.includes('Nimesulida'))).toBe(false);

    const qtdInput = el.querySelector('#ped-qtd') as HTMLInputElement;
    qtdInput.value = '0';
    qtdInput.dispatchEvent(new Event('input', { bubbles: true }));

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(pedidosServiceMock.solicitar).not.toHaveBeenCalled();
    expect(el.querySelector('#ped-med-err')?.textContent).toContain('Selecione um medicamento');
    expect(el.querySelector('#ped-qtd-err')?.textContent).toContain('quantidade positiva inteira');
    expect(el.querySelector('#ped-just-err')?.textContent).toContain('Informe a justificativa');
  });

  it('preselects medicamento, submits valid order, emits created, and closes dialog', () => {
    pedidosServiceMock.solicitar.mockReturnValueOnce(of(createdPedido));
    const createdSpy = vi.fn();
    component.created.subscribe(createdSpy);

    fixture.componentRef.setInput('preselectedMedicamentoId', 'med-1');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const qtdInput = el.querySelector('#ped-qtd') as HTMLInputElement;
    qtdInput.value = '80';
    qtdInput.dispatchEvent(new Event('input', { bubbles: true }));

    const justInput = el.querySelector('#ped-just') as HTMLTextAreaElement;
    justInput.value = 'Demanda alta no pronto atendimento';
    justInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(pedidosServiceMock.solicitar).toHaveBeenCalledWith({
      medicamento_id: 'med-1',
      quantidade_solicitada: 80,
      justificativa: 'Demanda alta no pronto atendimento',
    });
    expect(createdSpy).toHaveBeenCalledWith(createdPedido);
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Solicitação enviada' }),
    );
    expect(component.visible()).toBe(false);
  });

  it('shows error message when solicitar fails and closes when Cancelar is clicked', () => {
    pedidosServiceMock.solicitar
      .mockReturnValueOnce(throwError(() => new Error('Permissão negada')))
      .mockReturnValueOnce(throwError(() => 'unexpected'));

    fixture.componentRef.setInput('preselectedMedicamentoId', 'med-1');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const justInput = el.querySelector('#ped-just') as HTMLTextAreaElement;
    justInput.value = 'Reposição semanal necessária';
    justInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Permissão negada');

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível registrar o pedido de re-estoque.',
    );

    const cancelBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancelar'),
    );
    cancelBtn?.click();
    fixture.detectChanges();

    expect(component.visible()).toBe(false);
  });
});
