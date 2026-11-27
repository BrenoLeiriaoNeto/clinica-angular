import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { PacientesService } from '../../services/pacientes.service';
import { Paciente } from '../../models/paciente.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { calculateAge, formatDateOnlyBr } from '../../utils/paciente-validators';
import { Button } from '@openng/optimus-ui/button';
import { Dialog } from '@openng/optimus-ui/dialog';
import { PacienteFormDialog } from '../../components/paciente-form-dialog/paciente-form-dialog';
import { RouterLink } from '@angular/router';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { InputText } from '@openng/optimus-ui/inputtext';
import { Message } from '@openng/optimus-ui/message';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  selector: 'app-pacientes-list-page',
  templateUrl: './pacientes-list.html',
  styleUrl: '../pacientes-pages.scss',
  imports: [
    Button,
    Dialog,
    PacienteFormDialog,
    RouterLink,
    StatusBadge,
    InputText,
    Message,
    PageHeader,
  ],
})
export class PacientesListPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly messageService = inject(MessageService);
  private readonly pacientesService = inject(PacientesService);

  protected readonly searchTerm = signal('');
  protected readonly showInactive = signal(false);

  protected readonly formDialogVisible = signal(false);
  protected readonly selectedPaciente = signal<Paciente | null>(null);
  protected readonly pendingTogglePaciente = signal<Paciente | null>(null);

  protected readonly filteredPacientes = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const termDigits = term.replace(/\D/g, '');
    const includeInactive = this.showInactive();

    return this.pacientesService.pacientes().filter((pac) => {
      if (!includeInactive && !pac.ativo) return false;
      if (!term) return true;

      const doc = pac.documento ?? '';
      const phone = pac.telefone ?? '';

      return (
        pac.nome_completo.toLowerCase().includes(term) ||
        pac.email.toLowerCase().includes(term) ||
        doc.toLowerCase().includes(term) ||
        (termDigits.length > 0 &&
          (doc.replace(/\D/g, '').includes(termDigits) ||
            phone.replace(/\D/g, '').includes(termDigits)))
      );
    });
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.pacientesService
      .loadPacientes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  protected onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected onShowInactiveChange(event: Event): void {
    this.showInactive.set((event.target as HTMLInputElement).checked);
  }

  protected openCreateDialog(): void {
    this.selectedPaciente.set(null);
    this.formDialogVisible.set(true);
  }

  protected openEditDialog(pac: Paciente): void {
    this.selectedPaciente.set(pac);
    this.formDialogVisible.set(true);
  }

  protected requestToggleAtivo(pac: Paciente): void {
    this.pendingTogglePaciente.set(pac);
  }

  protected cancelToggleAtivo(): void {
    this.pendingTogglePaciente.set(null);
  }

  protected confirmToggleAtivo(): void {
    const pac = this.pendingTogglePaciente();
    if (!pac) return;

    this.pacientesService
      .alternarAtivo(pac)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.messageService.add({
            severity: 'success',
            summary: updated.ativo ? 'Paciente reativado' : 'Paciente inativado',
            detail: updated.nome_completo,
          });
          this.pendingTogglePaciente.set(null);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erro na operação',
            detail: 'Não foi possível alterar o status cadastral do paciente.',
          });
        },
      });
  }

  protected formatBirthDate(date: string | null): string {
    return formatDateOnlyBr(date);
  }

  protected formatAge(date: string | null): string | null {
    const age = calculateAge(date);
    return age !== null ? `${age} anos` : null;
  }
}
