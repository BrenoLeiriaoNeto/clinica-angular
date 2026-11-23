import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { MedicamentosService } from '../../services/medicamentos.service';
import { MessageService } from '@openng/optimus-ui/api';
import { EstoqueStatus, Medicamento } from '../../models/estoque.model';
import { MovimentacaoDto } from '../../models/dtos/estoque.dto';
import { form, FormField, required, validate } from '@angular/forms/signals';
import { Dialog } from '@openng/optimus-ui/dialog';
import { Message } from '@openng/optimus-ui/message';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { InputText } from '@openng/optimus-ui/inputtext';
import { Textarea } from '@openng/optimus-ui/textarea';
import { Button } from '@openng/optimus-ui/button';

@Component({
  selector: 'app-movimentacao-dialog',
  imports: [Dialog, Message, StatusBadge, FormField, InputText, Textarea, Button],
  templateUrl: './movimentacao-dialog.html',
  styleUrl: '../estoque-dialog.scss',
})
export class MovimentacaoDialog {
  private readonly medicamentoService = inject(MedicamentosService);
  private readonly messageService = inject(MessageService);

  readonly visible = model<boolean>(false);
  readonly medicamento = input<Medicamento | null>(null);
  readonly moved = output<Medicamento>();

  protected readonly isSubmitting = this.medicamentoService.isSubmitting;
  protected readonly submitError = signal<string | null>(null);

  protected readonly formModel = signal<MovimentacaoDto>({
    tipo: 'ENTRADA',
    quantidade: 1,
    observacao: '',
  });

  protected readonly movForm = form(this.formModel, (path) => {
    required(path.tipo, { message: 'Selecione o tipo de movimentação' });

    validate(path.quantidade, ({ value }) => {
      const qtd = value();
      const tipo = this.formModel().tipo;
      const saldoAtual = this.medicamento()?.quantidade_atual ?? 0;

      if (!Number.isInteger(qtd)) {
        return { kind: 'integer', message: 'Informe um número inteiro' };
      }
      if (tipo !== 'AJUSTE' && qtd <= 0) {
        return { kind: 'min', message: 'Informe um número maior que zero' };
      }
      if (tipo === 'AJUSTE' && qtd < 0) {
        return { kind: 'min', message: 'O novo saldo não pode ser negativo.' };
      }
      if (tipo === 'SAIDA' && qtd > saldoAtual) {
        return {
          kind: 'insufficient',
          message: `Saldo insuficiente (disponível: ${saldoAtual})`,
        };
      }
      return undefined;
    });
  });

  protected readonly quantidadeLabel = computed(() =>
    this.formModel().tipo === 'AJUSTE' ? 'Novo Saldo Final' : 'Quantidade',
  );

  protected readonly saldoPrevisto = computed<number | null>(() => {
    const med = this.medicamento();
    const { tipo, quantidade } = this.formModel();

    if (!med || !Number.isInteger(quantidade)) return null;

    if (tipo === 'ENTRADA') return med.quantidade_atual + quantidade;
    if (tipo === 'SAIDA') return Math.max(0, med.quantidade_atual - quantidade);

    return Math.max(0, quantidade);
  });

  protected readonly statusPrevisto = computed<EstoqueStatus>(() => {
    const med = this.medicamento();
    const previsto = this.saldoPrevisto();

    if (!med || previsto === null) return 'NORMAL';

    return previsto < med.estoque_minimo ? 'REPOSICAO' : 'NORMAL';
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      this.submitError.set(null);
      this.movForm().reset({
        tipo: 'ENTRADA',
        quantidade: 1,
        observacao: '',
      });
    });
  }

  protected onClose(): void {
    this.visible.set(false);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submitError.set(null);

    const med = this.medicamento();
    if (!med) return;

    if (this.movForm().invalid()) {
      this.movForm.tipo().markAsTouched();
      this.movForm.quantidade().markAsTouched();
      return;
    }

    const { tipo, quantidade, observacao } = this.formModel();

    this.medicamentoService
      .movimentarSaldo({
        medicamento: med,
        tipo,
        quantidade,
        observacao,
      })
      .subscribe({
        next: (updated) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Movimentação realizada',
            detail: `${updated.nome}: saldo atualizado para ${updated.quantidade_atual}`,
          });
          this.moved.emit(updated);
          this.visible.set(false);
        },
        error: (err: unknown) => {
          this.submitError.set(
            err instanceof Error ? err.message : 'Erro ao registrar movimentação de estoque.',
          );
        },
      });
  }
}
