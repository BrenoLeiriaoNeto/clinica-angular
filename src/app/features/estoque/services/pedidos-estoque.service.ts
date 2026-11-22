import { computed, inject, Service, signal } from '@angular/core';
import { catchError, EMPTY, finalize, map, Observable, tap, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { BaseApiService } from '../../../core/http/base-api.service';
import { PedidoEstoque, PedidoStatus } from '../models/estoque.model';
import { AuditoriaEstoqueService } from './auditoria-estoque.service';
import { MedicamentosService } from './medicamentos.service';
import { CreatePedidoEstoqueDto } from '../models/dtos/estoque.dto';

const PEDIDOS_SELECT =
  '*,medicamento:medicamentos(id,codigo_sku,nome,unidade_medida,quantidade_atual,estoque_minimo),solicitante:perfis!medico_solicitante_id(id,nome_completo,role),gerente:perfis!gerente_responsavel_id(id,nome_completo)';

@Service()
export class PedidosEstoqueService {
  private readonly api = inject(BaseApiService);
  private readonly authService = inject(AuthService);
  private readonly medicamentosService = inject(MedicamentosService);
  private readonly auditoriaService = inject(AuditoriaEstoqueService);

  private readonly _pedidos = signal<PedidoEstoque[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isSubmitting = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly pedidos = this._pedidos.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly error = this._error.asReadonly();

  readonly pedidosPendentes = computed(() =>
    this._pedidos().filter((pedido) => pedido.status === 'PENDENTE'),
  );

  loadPedidos(): Observable<PedidoEstoque[]> {
    this._isLoading.set(true);
    this._error.set(null);

    return this.api
      .get<PedidoEstoque[]>('pedidos_estoque', {
        select: PEDIDOS_SELECT,
        order: 'criado_em.desc',
      })
      .pipe(
        tap((items) => this._pedidos.set(items)),
        catchError((err) => {
          this._error.set('Não foi possível carregar os pedidos de reestoque.');
          return throwError(() => err);
        }),
        finalize(() => this._isLoading.set(false)),
      );
  }

  solicitar(dto: CreatePedidoEstoqueDto): Observable<PedidoEstoque> {
    const user = this.authService.currentUser();
    if (!user) {
      return throwError(() => new Error('Usuário não autenticado.'));
    }
    if (
      !dto.medicamento_id.trim() ||
      !Number.isInteger(dto.quantidade_solicitada) ||
      dto.quantidade_solicitada <= 0
    ) {
      return throwError(
        () =>
          new Error('Selecione um medicamento e informe uma quantidade inteira maior que zero.'),
      );
    }

    this._isSubmitting.set(true);
    this._error.set(null);

    return this.api
      .postOne<PedidoEstoque>(
        'pedidos_estoque',
        {
          medicamento_id: dto.medicamento_id.trim(),
          quantidade_solicitada: dto.quantidade_solicitada,
          status: 'PENDENTE' as const,
          medico_solicitante_id: user.role === 'MEDICO' ? user.id : null,
          gerente_responsavel_id: user.role === 'GERENTE_ESTOQUE' ? user.id : null,
          justificativa: dto.justificativa.trim() || null,
        },
        'Falha ao registrar pedido de reestoque.',
        { select: PEDIDOS_SELECT },
      )
      .pipe(
        tap((created) => {
          this._pedidos.update((prev) => [created, ...prev]);
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
  }

  atualizarStatus(
    pedido: PedidoEstoque,
    novoStatus: Exclude<PedidoStatus, 'PENDENTE'>,
  ): Observable<PedidoEstoque> {
    const userId = this.authService.currentUser()?.id;
    if (!userId) {
      return throwError(() => new Error('Usuário não autenticado.'));
    }

    if (novoStatus === 'RECEBIDO') {
      if (pedido.status !== 'PENDENTE' && pedido.status !== 'APROVADO') {
        return throwError(() => new Error('Este pedido não pode mais ser recebido.'));
      }

      this._isSubmitting.set(true);
      this._error.set(null);

      return this.api.rpc<PedidoEstoque>('receber_pedido_estoque', { p_pedido_id: pedido.id }).pipe(
        map(
          (updatedRow) =>
            ({
              ...pedido,
              ...updatedRow,
            }) satisfies PedidoEstoque,
        ),
        tap((mergedPedido) => {
          this._pedidos.update((prev) =>
            prev.map((item) => (item.id === pedido.id ? mergedPedido : item)),
          );
          this.medicamentosService
            .loadMedicamentos()
            .pipe(catchError(() => EMPTY))
            .subscribe();
          if (this.auditoriaService.movimentacoes().length > 0) {
            this.auditoriaService
              .loadMovimentacoes()
              .pipe(catchError(() => EMPTY))
              .subscribe();
          }
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
    }

    this._isSubmitting.set(true);
    this._error.set(null);

    return this.api
      .patchOne<PedidoEstoque>(
        'pedidos_estoque',
        {
          status: novoStatus,
          gerente_responsavel_id: userId,
          atualizado_em: new Date().toISOString(),
        },
        {
          id: `eq.${pedido.id}`,
          select: PEDIDOS_SELECT,
        },
        'Pedido de estoque não encontrado.',
      )
      .pipe(
        tap((updatedPedido) => {
          this._pedidos.update((prev) =>
            prev.map((item) => (item.id === pedido.id ? updatedPedido : item)),
          );
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
  }
}
