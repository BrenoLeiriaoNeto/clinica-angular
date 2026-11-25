import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MedicamentosService } from '../../services/medicamentos.service';
import { AuditoriaEstoqueService } from '../../services/auditoria-estoque.service';
import { PedidosEstoqueService } from '../../services/pedidos-estoque.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TipoMovimentacao } from '../../models/estoque.model';
import { Message } from '@openng/optimus-ui/message';
import { PedidoFormDialog } from '../../components/pedido-form-dialog/pedido-form-dialog';
import { MovimentacaoDialog } from '../../components/movimentacao-dialog/movimentacao-dialog';
import { MedicamentoFormDialog } from '../../components/medicamento-form-dialog/medicamento-form-dialog';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { Button } from '@openng/optimus-ui/button';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { DatePipe } from '@angular/common';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';

@Component({
  selector: 'app-medicamento-detail-page',
  templateUrl: './medicamento-detail.html',
  styleUrl: '../estoque-pages.scss',
  imports: [
    DatePipe,
    RouterLink,
    HasRoleDirective,
    Message,
    PedidoFormDialog,
    MovimentacaoDialog,
    MedicamentoFormDialog,
    StatusBadge,
    Button,
    PageHeader,
  ],
})
export class MedicamentoDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly medicamentosService = inject(MedicamentosService);
  protected readonly auditoriaService = inject(AuditoriaEstoqueService);
  protected readonly pedidosService = inject(PedidosEstoqueService);

  protected readonly formDialogVisible = signal(false);
  protected readonly movDialogVisible = signal(false);
  protected readonly pedidoDialogVisible = signal(false);

  protected readonly medicamentoId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null },
  );

  protected readonly medicamento = computed(() => {
    const id = this.medicamentoId();
    if (!id) return null;

    return this.medicamentosService.medicamentos().find((item) => item.id === id) ?? null;
  });

  protected readonly movimentacoesDoItem = computed(() => {
    const id = this.medicamentoId();
    if (!id) return [];

    return this.auditoriaService.movimentacoes().filter((mov) => mov.medicamento_id === id);
  });

  protected readonly pedidosDoItem = computed(() => {
    const id = this.medicamentoId();
    if (!id) return [];

    return this.pedidosService.pedidos().filter((pedido) => pedido.medicamento_id === id);
  });

  protected readonly deficitParaMinimo = computed(() => {
    const med = this.medicamento();
    if (!med) return 0;

    return Math.max(0, med.estoque_minimo - med.quantidade_atual);
  });

  ngOnInit(): void {
    this.medicamentosService
      .loadMedicamentos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });

    this.auditoriaService
      .loadMovimentacoes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });

    this.pedidosService
      .loadPedidos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  protected formatDelta(tipo: TipoMovimentacao, quantidade: number): string {
    if (tipo === 'ENTRADA') return `+${quantidade}`;
    if (tipo === 'SAIDA') return `-${quantidade}`;
    return `= ${quantidade}`;
  }

  protected onMovimentacaoConcluida(): void {
    this.auditoriaService
      .loadMovimentacoes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }
}
