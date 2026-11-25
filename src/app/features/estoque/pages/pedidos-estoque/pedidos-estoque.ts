import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { PedidoEstoque, PedidoStatus } from '../../models/estoque.model';
import { MessageService } from '@openng/optimus-ui/api';
import { PedidosEstoqueService } from '../../services/pedidos-estoque.service';
import { MedicamentosService } from '../../services/medicamentos.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from '@openng/optimus-ui/button';
import { Dialog } from '@openng/optimus-ui/dialog';
import { PedidoFormDialog } from '../../components/pedido-form-dialog/pedido-form-dialog';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { RouterLink } from '@angular/router';
import { Message } from '@openng/optimus-ui/message';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { DatePipe } from '@angular/common';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { InputText } from '@openng/optimus-ui/inputtext';

interface PendingTransition {
  pedido: PedidoEstoque;
  novoStatus: 'RECEBIDO' | 'CANCELADO';
}

@Component({
  selector: 'app-pedidos-estoque-page',
  templateUrl: './pedidos-estoque.html',
  styleUrl: '../estoque-pages.scss',
  imports: [
    InputText,
    DatePipe,
    HasRoleDirective,
    Button,
    Dialog,
    PedidoFormDialog,
    StatusBadge,
    RouterLink,
    Message,
    PageHeader,
  ],
})
export class PedidosEstoquePage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly messageService = inject(MessageService);

  protected readonly pedidosService = inject(PedidosEstoqueService);
  protected readonly medicamentosService = inject(MedicamentosService);

  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<'TODOS' | PedidoStatus>('TODOS');
  protected readonly pedidoDialogVisible = signal(false);
  protected readonly pendingTransition = signal<PendingTransition | null>(null);

  protected readonly totalAprovados = computed(
    () => this.pedidosService.pedidos().filter((p) => p.status === 'APROVADO').length,
  );

  protected readonly totalRecebidos = computed(
    () => this.pedidosService.pedidos().filter((p) => p.status === 'RECEBIDO').length,
  );

  protected readonly filteredPedidos = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    const status = this.statusFilter();

    return this.pedidosService.pedidos().filter((pedido) => {
      if (status !== 'TODOS' && pedido.status !== status) return false;
      if (!term) return true;

      return (
        (pedido.medicamento?.nome.toLocaleLowerCase().includes(term) ?? false) ||
        (pedido.medicamento?.codigo_sku.toLocaleLowerCase().includes(term) ?? false) ||
        (pedido.solicitante?.nome_completo.toLocaleLowerCase().includes(term) ?? false) ||
        (pedido.gerente?.nome_completo.toLocaleLowerCase().includes(term) ?? false) ||
        (pedido.justificativa?.toLocaleLowerCase().includes(term) ?? false)
      );
    });
  });

  ngOnInit(): void {
    this.pedidosService
      .loadPedidos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });

    if (this.medicamentosService.medicamentos().length === 0) {
      this.medicamentosService
        .loadMedicamentos()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ error: () => undefined });
    }
  }

  protected onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected onStatusFilterChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as 'TODOS' | PedidoStatus);
  }

  protected aprovarPedido(pedido: PedidoEstoque): void {
    this.executeTransition(pedido, 'APROVADO');
  }

  protected requestTransition(pedido: PedidoEstoque, novoStatus: 'RECEBIDO' | 'CANCELADO'): void {
    this.pendingTransition.set({ pedido, novoStatus });
  }

  protected cancelPendingTransition(): void {
    this.pendingTransition.set(null);
  }

  protected confirmPendingTransition(): void {
    const pending = this.pendingTransition();
    if (!pending) return;

    this.executeTransition(pending.pedido, pending.novoStatus, () =>
      this.pendingTransition.set(null),
    );
  }

  private executeTransition(
    pedido: PedidoEstoque,
    novoStatus: Exclude<PedidoStatus, 'PENDENTE'>,
    onComplete?: () => void,
  ): void {
    this.pedidosService
      .atualizarStatus(pedido, novoStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const summaries: Record<Exclude<PedidoStatus, 'PENDENTE'>, string> = {
            APROVADO: 'Pedido aprovado',
            RECEBIDO: 'Recebimento confirmado',
            CANCELADO: 'Pedido cancelado',
          };
          const detail =
            novoStatus === 'RECEBIDO'
              ? `Entrada de +${pedido.quantidade_solicitada} unidade(s) registrada no estoque`
              : `${pedido.medicamento?.nome ?? 'Medicamento'} atualizado com sucesso.`;

          this.messageService.add({
            severity: 'success',
            summary: summaries[novoStatus],
            detail,
          });
          onComplete?.();
        },
        error: (err: unknown) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Falha ao atualizar pedido',
            detail: err instanceof Error ? err.message : 'Tente novamente em instantes',
          });
        },
      });
  }
}
