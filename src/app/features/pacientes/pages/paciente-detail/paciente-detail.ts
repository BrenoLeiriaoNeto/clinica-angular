import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { PacientesService } from '../../services/pacientes.service';
import { PacienteAgendamentoResumo } from '../../models/paciente.model';
import { calculateAge, formatDateOnlyBr } from '../../utils/paciente-validators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Message } from '@openng/optimus-ui/message';
import { PacienteFormDialog } from '../../components/paciente-form-dialog/paciente-form-dialog';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { Button } from '@openng/optimus-ui/button';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-paciente-detail-page',
  templateUrl: './paciente-detail.html',
  styleUrl: '../pacientes-pages.scss',
  imports: [Message, RouterLink, PacienteFormDialog, DatePipe, StatusBadge, Button, PageHeader],
})
export class PacienteDetailPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly pacientesService = inject(PacientesService);

  readonly id = input<string>();

  protected readonly formDialogVisible = signal(false);
  protected readonly agendamentos = signal<PacienteAgendamentoResumo[]>([]);
  protected readonly isLoadingAgendamentos = signal(false);
  protected readonly agendamentosError = signal<string | null>(null);

  protected readonly paciente = computed(() => {
    const pacId = this.id();
    if (!pacId) return null;

    return this.pacientesService.pacientes().find((item) => item.id === pacId) ?? null;
  });

  protected readonly idade = computed(() => calculateAge(this.paciente()?.data_nascimento));

  protected readonly dataNascimentoFormatada = computed(() =>
    formatDateOnlyBr(this.paciente()?.data_nascimento),
  );

  protected readonly totalConcluidas = computed(
    () => this.agendamentos().filter((ag) => ag.status === 'CONCLUIDO').length,
  );

  constructor() {
    effect(() => {
      const pacId = this.id();
      if (!pacId) {
        this.agendamentos.set([]);
        return;
      }

      untracked(() => this.fetchAgendamentos(pacId));
    });
  }

  ngOnInit(): void {
    this.pacientesService
      .loadPacientes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  private fetchAgendamentos(pacienteId: string): void {
    this.isLoadingAgendamentos.set(true);
    this.agendamentosError.set(null);

    this.pacientesService
      .loadAgendamentosDoPaciente(pacienteId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingAgendamentos.set(false)),
      )
      .subscribe({
        next: (items) => this.agendamentos.set(items),
        error: () => {
          this.agendamentos.set([]);
          this.agendamentosError.set('Não foi possível carregar o histórico de agendamentos.');
        },
      });
  }
}
