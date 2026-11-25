import { computed, inject, Service, signal } from '@angular/core';
import { catchError, defer, finalize, Observable, tap, throwError } from 'rxjs';
import { BaseApiService } from '../../../core/http/base-api.service';
import { EstoqueMovimentacao } from '../models/estoque.model';
import { MOVIMENTACOES_SELECT } from '../../../../database/queries';

@Service()
export class AuditoriaEstoqueService {
  private readonly api = inject(BaseApiService);

  private readonly _movimentacoes = signal<EstoqueMovimentacao[]>([]);
  private readonly _activeLoads = signal(0);
  private readonly _error = signal<string | null>(null);

  readonly movimentacoes = this._movimentacoes.asReadonly();
  readonly isLoading = computed(() => this._activeLoads() > 0);
  readonly error = this._error.asReadonly();

  loadMovimentacoes(): Observable<EstoqueMovimentacao[]> {
    return defer(() => {
      this._activeLoads.update((count) => count + 1);
      this._error.set(null);

      return this.api
        .get<EstoqueMovimentacao[]>('estoque_movimentacoes', {
          select: MOVIMENTACOES_SELECT,
          order: 'criado_em.desc',
        })
        .pipe(
          tap((items) => this._movimentacoes.set(items)),
          catchError((err) => {
            this._error.set('Não foi possível carregar o histórico de auditoria.');
            return throwError(() => err);
          }),
          finalize(() => this._activeLoads.update((count) => Math.max(0, count - 1))),
        );
    });
  }
}
