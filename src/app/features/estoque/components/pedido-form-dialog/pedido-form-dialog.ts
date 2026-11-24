import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { PedidosEstoqueService } from '../../services/pedidos-estoque.service';
import { MessageService } from '@openng/optimus-ui/api';
import { Medicamento, PedidoEstoque } from '../../models/estoque.model';
import { CreatePedidoEstoqueDto } from '../../models/dtos/estoque.dto';
import { form, minLength, required, validate, FormField } from '@angular/forms/signals';
import { Dialog } from '@openng/optimus-ui/dialog';
import { Message } from '@openng/optimus-ui/message';
import { InputText } from '@openng/optimus-ui/inputtext';
import { Textarea } from '@openng/optimus-ui/textarea';
import { Button } from '@openng/optimus-ui/button';

@Component({
  selector: 'app-pedido-form-dialog',
  imports: [Dialog, Message, FormField, InputText, Textarea, Button],
  templateUrl: './pedido-form-dialog.html',
  styleUrl: '../estoque-dialog.scss',
})
export class PedidoFormDialog {
  private readonly pedidosService = inject(PedidosEstoqueService);
  private readonly messageService = inject(MessageService);

  readonly visible = model<boolean>(false);
  readonly medicamentos = input.required<Medicamento[]>();
  readonly preselectedMedicamentoId = input<string | null>(null);
  readonly created = output<PedidoEstoque>();

  protected readonly isSubmitting = this.pedidosService.isSubmitting;
  protected readonly submitError = signal<string | null>(null);

  protected readonly medicamentosAtivos = computed(() =>
    this.medicamentos().filter((m) => m.ativo),
  );

  protected readonly formModel = signal<CreatePedidoEstoqueDto>({
    medicamento_id: '',
    quantidade_solicitada: 50,
    justificativa: '',
  });

  protected readonly pedidoForm = form(this.formModel, (path) => {
    required(path.medicamento_id, { message: 'Selecione um medicamento' });

    validate(path.quantidade_solicitada, ({ value }) => {
      const qtd = value();
      if (!Number.isInteger(qtd) || qtd <= 0) {
        return { kind: 'positiveInt', message: 'Informe uma quantidade positiva inteira.' };
      }
      return undefined;
    });

    required(path.justificativa, { message: 'Informe a justificativa do pedido.' });
    minLength(path.justificativa, 5, {
      message: 'Descreva brevemente o motivo (mínimo 5 caracteres)',
    });
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      this.submitError.set(null);
      const preselected = this.preselectedMedicamentoId() ?? '';

      this.pedidoForm().reset({
        medicamento_id: preselected,
        quantidade_solicitada: 50,
        justificativa: '',
      });
    });
  }

  protected onClose(): void {
    this.visible.set(false);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submitError.set(null);

    if (this.pedidoForm().invalid()) {
      this.pedidoForm.medicamento_id().markAsTouched();
      this.pedidoForm.justificativa().markAsTouched();
      this.pedidoForm.quantidade_solicitada().markAsDirty();
      return;
    }

    const { medicamento_id, quantidade_solicitada, justificativa } = this.formModel();

    this.pedidosService
      .solicitar({
        medicamento_id,
        quantidade_solicitada,
        justificativa,
      })
      .subscribe({
        next: (pedido) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Solicitação enviada',
            detail: 'Pedido de re-estoque encaminhado para a avaliação do setor de estoque.',
          });
          this.created.emit(pedido);
          this.visible.set(false);
        },
        error: (err: unknown) => {
          this.submitError.set(
            err instanceof Error
              ? err.message
              : 'Não foi possível registrar o pedido de re-estoque.',
          );
        },
      });
  }
}
