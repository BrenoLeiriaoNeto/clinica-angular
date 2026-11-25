import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { MedicamentosService } from '../../services/medicamentos.service';
import { EstoqueStatus, Medicamento } from '../../models/estoque.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from '@openng/optimus-ui/button';
import { Dialog } from '@openng/optimus-ui/dialog';
import { PedidoFormDialog } from '../../components/pedido-form-dialog/pedido-form-dialog';
import { MovimentacaoDialog } from '../../components/movimentacao-dialog/movimentacao-dialog';
import { MedicamentoFormDialog } from '../../components/medicamento-form-dialog/medicamento-form-dialog';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { RouterLink } from '@angular/router';
import { Message } from '@openng/optimus-ui/message';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { InputText } from '@openng/optimus-ui/inputtext';

@Component({
  selector: 'app-estoque-list-page',
  templateUrl: './estoque-list.html',
  styleUrl: '../estoque-pages.scss',
  imports: [
    InputText,
    Button,
    Dialog,
    PedidoFormDialog,
    MovimentacaoDialog,
    MedicamentoFormDialog,
    StatusBadge,
    RouterLink,
    Message,
    PageHeader,
    HasRoleDirective,
  ],
})
export class EstoqueListPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly messageService = inject(MessageService);
  protected readonly medicamentosService = inject(MedicamentosService);

  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<'TODOS' | EstoqueStatus>('TODOS');
  protected readonly showInactive = signal(false);

  protected readonly formDialogVisible = signal(false);
  protected readonly movDialogVisible = signal(false);
  protected readonly pedidoDialogVisible = signal(false);
  protected readonly selectedMedicamento = signal<Medicamento | null>(null);
  protected readonly preselectedPedidoMedId = signal<string | null>(null);
  protected readonly pendingToggleMedicamento = signal<Medicamento | null>(null);

  protected readonly totalInativos = computed(
    () => this.medicamentosService.medicamentos().filter((med) => !med.ativo).length,
  );

  protected readonly filteredMedicamentos = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    const status = this.statusFilter();
    const includeInactive = this.showInactive();

    return this.medicamentosService.medicamentos().filter((med) => {
      if (!includeInactive && !med.ativo) return false;
      if (status !== 'TODOS' && med.status !== status) return false;

      if (!term) return true;

      return (
        med.codigo_sku.toLocaleLowerCase().includes(term) ||
        med.nome.toLocaleLowerCase().includes(term) ||
        med.principio_ativo.toLocaleLowerCase().includes(term)
      );
    });
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.medicamentosService
      .loadMedicamentos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  protected onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected onStatusFilterChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as 'TODOS' | EstoqueStatus);
  }

  protected onShowInactiveChange(event: Event): void {
    this.showInactive.set((event.target as HTMLInputElement).checked);
  }

  protected openCreateDialog(): void {
    this.selectedMedicamento.set(null);
    this.formDialogVisible.set(true);
  }

  protected openEditDialog(med: Medicamento): void {
    this.selectedMedicamento.set(med);
    this.formDialogVisible.set(true);
  }

  protected openMovimentacaoDialog(med: Medicamento): void {
    this.selectedMedicamento.set(med);
    this.movDialogVisible.set(true);
  }

  protected openPedidoDialog(med: Medicamento | null = null): void {
    this.preselectedPedidoMedId.set(med?.id ?? null);
    this.pedidoDialogVisible.set(true);
  }

  protected requestToggleAtivo(med: Medicamento): void {
    this.pendingToggleMedicamento.set(med);
  }

  protected cancelToggleAtivo(): void {
    this.pendingToggleMedicamento.set(null);
  }

  protected confirmToggleAtivo(): void {
    const med = this.pendingToggleMedicamento();
    if (!med) return;

    this.medicamentosService
      .alternarAtivo(med)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.messageService.add({
            severity: 'success',
            summary: updated.ativo ? 'Medicamento reativado' : 'Medicamento descontinuado',
            detail: `${updated.codigo_sku} - ${updated.nome}`,
          });
          this.pendingToggleMedicamento.set(null);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erro ao alterar status',
            detail: 'Não foi possível alterar o status do medicamento.',
          });
        },
      });
  }
}
