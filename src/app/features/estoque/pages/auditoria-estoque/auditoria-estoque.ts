import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { AuditoriaEstoqueService } from '../../services/auditoria-estoque.service';
import { TipoMovimentacao } from '../../models/estoque.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { RouterLink } from '@angular/router';
import { Message } from '@openng/optimus-ui/message';
import { Button } from '@openng/optimus-ui/button';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-auditoria-estoque-page',
  templateUrl: './auditoria-estoque.html',
  styleUrl: '../estoque-pages.scss',
  imports: [DatePipe, StatusBadge, RouterLink, Message, Button, PageHeader],
})
export class AuditoriaEstoquePage implements OnInit {
  private readonly destroRef = inject(DestroyRef);
  protected readonly auditoriaService = inject(AuditoriaEstoqueService);

  protected readonly searchTerm = signal('');
  protected readonly tipoFilter = signal<'TODOS' | TipoMovimentacao>('TODOS');

  protected readonly totalEntradas = computed(
    () => this.auditoriaService.movimentacoes().filter((m) => m.tipo === 'ENTRADA').length,
  );

  protected readonly totalSaidas = computed(
    () => this.auditoriaService.movimentacoes().filter((m) => m.tipo === 'SAIDA').length,
  );

  protected readonly totalAjustes = computed(
    () => this.auditoriaService.movimentacoes().filter((m) => m.tipo === 'AJUSTE').length,
  );

  protected readonly filteredMovimentacoes = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    const tipo = this.tipoFilter();

    return this.auditoriaService.movimentacoes().filter((mov) => {
      if (tipo !== 'TODOS' && mov.tipo !== tipo) return false;
      if (!term) return true;

      return (
        (mov.medicamento?.nome.toLowerCase().includes(term) ?? false) ||
        (mov.medicamento?.codigo_sku.toLowerCase().includes(term) ?? false) ||
        (mov.gerente?.nome_completo.toLowerCase().includes(term) ?? false) ||
        (mov.medico?.nome_completo.toLowerCase().includes(term) ?? false) ||
        (mov.observacao?.toLowerCase().includes(term) ?? false)
      );
    });
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.auditoriaService
      .loadMovimentacoes()
      .pipe(takeUntilDestroyed(this.destroRef))
      .subscribe({ error: () => undefined });
  }

  protected onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected onTipoFilterChange(event: Event): void {
    this.tipoFilter.set((event.target as HTMLSelectElement).value as 'TODOS' | TipoMovimentacao);
  }

  protected formatDelta(tipo: TipoMovimentacao, quantidade: number): string {
    if (tipo === 'ENTRADA') return `+${quantidade}`;
    if (tipo === 'SAIDA') return `-${quantidade}`;
    return `= ${quantidade}`;
  }
}
