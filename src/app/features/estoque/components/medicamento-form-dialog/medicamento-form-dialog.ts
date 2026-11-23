import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { CreateMedicamentoDto } from '../../models/dtos/estoque.dto';
import { MedicamentosService } from '../../services/medicamentos.service';
import { MessageService } from '@openng/optimus-ui/api';
import { Medicamento } from '../../models/estoque.model';
import { disabled, form, FormField, min, minLength, required, validate } from '@angular/forms/signals';
import { Dialog } from '@openng/optimus-ui/dialog';
import { Message } from '@openng/optimus-ui/message';
import { InputText } from '@openng/optimus-ui/inputtext';
import { Button } from '@openng/optimus-ui/button';

const INITIAL_MODEL: CreateMedicamentoDto = {
  codigo_sku: '',
  nome: '',
  principio_ativo: '',
  unidade_medida: 'Caixa',
  quantidade_atual: 0,
  estoque_minimo: 50,
};

@Component({
  selector: 'app-medicamento-form-dialog',
  imports: [Dialog, Message, InputText, FormField, Button],
  templateUrl: './medicamento-form-dialog.html',
  styleUrl: '../estoque-dialog.scss',
})
export class MedicamentoFormDialog {
  private readonly medicamentoService = inject(MedicamentosService);
  private readonly messageService = inject(MessageService);

  readonly visible = model<boolean>(false);
  readonly medicamento = input<Medicamento | null>(null);
  readonly saved = output<Medicamento>();

  protected readonly isSubmitting = this.medicamentoService.isSubmitting;
  protected readonly submitError = signal<string | null>(null);
  protected readonly isEditMode = computed(() => this.medicamento() !== null);
  protected readonly dialogHeader = computed(() =>
    this.isEditMode() ? 'Editar Medicamento' : 'Novo Medicamento',
  );

  protected readonly formModel = signal<CreateMedicamentoDto>({ ...INITIAL_MODEL });

  protected readonly medForm = form(this.formModel, (path) => {
    required(path.codigo_sku, { message: 'Informe o código SKU.' });
    minLength(path.codigo_sku, 3, { message: 'O SKU deve ter pelo menos 3 caracteres.' });
    disabled(path.codigo_sku, { when: () => this.isEditMode() });

    required(path.nome, { message: 'Informe o nome comercial do medicamento.' });
    minLength(path.nome, 3, { message: 'O nome comercial deve ter pelo menos 3 caracteres.' });

    required(path.principio_ativo, { message: 'Informe o princípio ativo.' });
    required(path.unidade_medida, { message: 'Informe a unidade de medida.' });

    min(path.quantidade_atual, 0, { message: 'O saldo inicial não pode ser negativo.' });
    validate(path.quantidade_atual, ({ value }) =>
      !Number.isInteger(value())
        ? { kind: 'integer', message: 'Informe um número inteiro.' }
        : undefined,
    );
    disabled(path.quantidade_atual, { when: () => this.isEditMode() });

    min(path.estoque_minimo, 0, { message: 'O estoque mínimo não pode ser negativo.' });
    validate(path.estoque_minimo, ({ value }) =>
      !Number.isInteger(value())
        ? { kind: 'integer', message: 'Informe um número inteiro.' }
        : undefined,
    );
  });

  constructor() {
    effect(() => {
      const isOpen = this.visible();
      const current = this.medicamento();
      if (!isOpen) return;

      this.submitError.set(null);
      if (current) {
        this.medForm().reset({
          codigo_sku: current.codigo_sku,
          nome: current.nome,
          principio_ativo: current.principio_ativo,
          unidade_medida: current.unidade_medida,
          quantidade_atual: current.quantidade_atual,
          estoque_minimo: current.estoque_minimo,
        });
      } else {
        this.medForm().reset({ ...INITIAL_MODEL });
      }
    });
  }

  protected onClose(): void {
    this.visible.set(false);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submitError.set(null);

    if (this.medForm().invalid()) {
      this.medForm.codigo_sku().markAsTouched();
      this.medForm.nome().markAsTouched();
      this.medForm.principio_ativo().markAsTouched();
      this.medForm.unidade_medida().markAsTouched();
      this.medForm.quantidade_atual().markAsTouched();
      this.medForm.estoque_minimo().markAsTouched();
      return;
    }

    const data = this.formModel();
    const editing = this.medicamento();

    const request$ = editing
      ? this.medicamentoService.atualizar(editing.id, {
          nome: data.nome,
          principio_ativo: data.principio_ativo,
          unidade_medida: data.unidade_medida,
          estoque_minimo: data.estoque_minimo,
        })
      : this.medicamentoService.criar({
          codigo_sku: data.codigo_sku,
          nome: data.nome,
          principio_ativo: data.principio_ativo,
          unidade_medida: data.unidade_medida,
          quantidade_atual: data.quantidade_atual,
          estoque_minimo: data.estoque_minimo,
        });

    request$.subscribe({
      next: (result) => {
        this.messageService.add({
          severity: 'success',
          summary: editing ? 'Medicamento atualizado' : 'Medicamento criado',
          detail: `${result.codigo_sku} - ${result.nome}`,
        });
        this.saved.emit(result);
        this.visible.set(false);
      },
      error: (err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : 'Não foi possível salvar o medicamento. Verifique se a SKU já existe.';
        this.submitError.set(message);
      },
    });
  }
}
