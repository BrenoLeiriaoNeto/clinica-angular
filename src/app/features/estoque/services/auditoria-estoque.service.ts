import { inject, Service, signal } from '@angular/core';
import { catchError, finalize, Observable, tap, throwError } from 'rxjs';
import { BaseApiService } from '../../../core/http/base-api.service';
import { EstoqueMovimentacao, TipoMovimentacao } from '../models/estoque.model';

export interface CreateMovimentacaoLogDto {
  medicamento_id: string;
  tipo: TipoMovimentacao;
  quantidade_anterior: number;
  quantidade_movimentada: number;
  quantidade_posterior: number;
  gerente_responsavel_id: string;
  medico_solicitante_id?: string | null;
  observacao?: string | null;
}

const MOVIMENTACOES_SELECT =
  '*,medicamento:medicamentos(id,codigo_sku,nome,unidade_medida),gerente:perfis!gerente_responsavel_id(id,nome_completo),medico:perfis!medico_solicitante_id(id,nome_completo)';

@Service()
export class AuditoriaEstoqueService {
  private readonly api = inject(BaseApiService);

  private readonly _movimentacoes = signal<EstoqueMovimentacao[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly movimentacoes = this._movimentacoes.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  loadMovimentacoes(): Observable<EstoqueMovimentacao[]> {
    this._isLoading.set(true);
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
        finalize(() => this._isLoading.set(false)),
      );
  }

  registrarLog(payload: CreateMovimentacaoLogDto): Observable<EstoqueMovimentacao> {
    return this.api
      .postOne<EstoqueMovimentacao>(
        'estoque_movimentacoes',
        {
          ...payload,
          medico_solicitante_id: payload.medico_solicitante_id ?? null,
          observacao: payload.observacao?.trim() || null,
        },
        'Falha ao registrar log de auditoria de estoque.',
        { select: MOVIMENTACOES_SELECT },
      )
      .pipe(
        tap((created) => {
          this._movimentacoes.update((prev) => [created, ...prev]);
        }),
      );
  }
}
