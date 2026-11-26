import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { PacientesService } from '../../services/pacientes.service';
import { MessageService } from '@openng/optimus-ui/api';
import { Paciente } from '../../models/paciente.model';
import {
  formatCpf,
  formatTelefone,
  getTodayIsoDate,
  isMaskedCpf,
  isValidCpf,
  isValidDataNascimento,
  isValidEmail,
  isValidTelefone,
} from '../../utils/paciente-validators';
import { CreatePacienteDto } from '../../models/dtos/paciente.dto';
import { disabled, form, minLength, required, validate, FormField } from '@angular/forms/signals';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from '@openng/optimus-ui/button';
import { Message } from '@openng/optimus-ui/message';
import { Dialog } from '@openng/optimus-ui/dialog';
import { InputText } from '@openng/optimus-ui/inputtext';

const INITIAL_MODEL: CreatePacienteDto = {
  nome_completo: '',
  email: '',
  documento: '',
  data_nascimento: '',
  telefone: '',
  senha_inicial: 'Clinica@2026',
};

@Component({
  selector: 'app-paciente-form-dialog',
  templateUrl: './paciente-form-dialog.html',
  styleUrl: './paciente-form-dialog.scss',
  imports: [InputText, Button, FormField, Message, Dialog],
})
export class PacienteFormDialog {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pacientesService = inject(PacientesService);
  private readonly messageService = inject(MessageService);

  readonly visible = model<boolean>(false);
  readonly paciente = input<Paciente | null>(null);
  readonly saved = output<Paciente>();

  protected readonly todayIso = getTodayIsoDate();
  protected readonly isSubmitting = this.pacientesService.isSubmitting;
  protected readonly submitError = signal<string | null>(null);
  protected readonly isEditMode = computed(() => this.paciente() !== null);
  protected readonly dialogHeader = computed(() =>
    this.isEditMode() ? 'Editar Paciente' : 'Novo Paciente',
  );

  protected readonly formModel = signal<CreatePacienteDto>({ ...INITIAL_MODEL });

  protected readonly pacienteForm = form(this.formModel, (path) => {
    required(path.nome_completo, { message: 'Informe o nome completo do paciente.' });
    minLength(path.nome_completo, 3, { message: 'O nome deve ter pelo menos 3 caracteres.' });

    required(path.email, { message: 'Informe o e-mail de acesso do paciente.' });
    validate(path.email, ({ value }) => {
      const val = value().trim();
      if (val && !isValidEmail(val)) {
        return { kind: 'email', message: 'Informe um endereço de e-mail válido.' };
      }
      return undefined;
    });
    disabled(path.email, { when: () => this.isEditMode() });

    required(path.documento, { message: 'Informe o CPF do paciente.' });
    validate(path.documento, ({ value }) => {
      const val = value().trim();
      if (!val) return undefined;
      if (this.isEditMode() && isMaskedCpf(val)) return undefined;
      if (!isValidCpf(val)) {
        return { kind: 'cpf', message: 'Informe um CPF válido.' };
      }
      return undefined;
    });

    required(path.data_nascimento, { message: 'Informe a data de nascimento do paciente.' });
    validate(path.data_nascimento, ({ value }) => {
      const val = value().trim();
      if (val && !isValidDataNascimento(val)) {
        return {
          kind: 'birthDate',
          message: 'Informe uma data de nascimento válida.',
        };
      }
      return undefined;
    });

    required(path.telefone, { message: 'Informe o telefone para contato.' });
    validate(path.telefone, ({ value }) => {
      const val = value().trim();
      if (val && !isValidTelefone(val)) {
        return {
          kind: 'phone',
          message: 'Informe um telefone com DDD (10 ou 11 dígitos)',
        };
      }
      return undefined;
    });

    required(path.senha_inicial, { message: 'Informe uma senha inicial para o portal.' });
    minLength(path.senha_inicial, 6, {
      message: 'A senha inicial deve ter no mínimo 6 caractéres.',
    });
    disabled(path.senha_inicial, { when: () => this.isEditMode() });
  });

  constructor() {
    effect(() => {
      const isOpen = this.visible();
      const current = this.paciente();

      if (!isOpen) return;

      this.submitError.set(null);
      if (current) {
        this.pacienteForm().reset({
          nome_completo: current.nome_completo,
          email: current.email,
          documento: current.documento ?? '',
          data_nascimento: current.data_nascimento,
          telefone: current.telefone,
          senha_inicial: 'Clinica@2026',
        });
      } else {
        this.pacienteForm().reset({ ...INITIAL_MODEL });
      }
    });
  }

  protected onFormatCpf(): void {
    const current = this.formModel().documento;
    const formatted = formatCpf(current);

    if (formatted !== current) {
      this.formModel.update((prev) => ({ ...prev, documento: formatted }));
    }
  }

  protected onFormatTelefone(): void {
    const current = this.formModel().telefone;
    const formatted = formatTelefone(current);

    if (formatted !== current) {
      this.formModel.update((prev) => ({ ...prev, telefone: formatted }));
    }
  }

  protected onClose(): void {
    this.visible.set(false);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submitError.set(null);

    if (this.pacienteForm().invalid()) {
      this.pacienteForm.nome_completo().markAsTouched();
      this.pacienteForm.email().markAsTouched();
      this.pacienteForm.documento().markAsTouched();
      this.pacienteForm.data_nascimento().markAsTouched();
      this.pacienteForm.telefone().markAsTouched();
      this.pacienteForm.senha_inicial().markAsTouched();
      return;
    }

    const data = this.formModel();
    const editing = this.paciente();

    const request$ = editing
      ? this.pacientesService.atualizar(editing.id, {
          nome_completo: data.nome_completo,
          documento: data.documento,
          data_nascimento: data.data_nascimento,
          telefone: data.telefone,
        })
      : this.pacientesService.criar(data);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.messageService.add({
          severity: 'success',
          summary: editing ? 'Paciente atualizado' : 'Paciente cadastrado',
          detail: `${result.nome_completo} (${result.email})`,
        });
        this.saved.emit(result);
        this.visible.set(false);
      },
      error: (err: unknown) => {
        this.submitError.set(
          err instanceof Error
            ? err.message
            : 'Não foi possível salvar o paciente. Verifique se o e-mail já está em uso.',
        );
      },
    });
  }
}
