import { computed, inject, Service, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { BaseApiService } from '../../../core/http/base-api.service';
import {
  Medicamento,
  PedidoEstoque,
  PedidoStatus,
} from '../models/estoque.model';
import { MedicamentosService } from './medicamentos.service';
import { CreatePedidoEstoqueDto } from '../models/dtos/estoque.dto';

const PEDIDOS_SELECT =
  '*,medicamento:medicamentos(id,codigo_sku,nome,unidade_medida,quantidade_atual,estoque_minimo),solicitante:perfis!medico_solicitante_id(id,nome_completo,role),gerente:perfis!gerente_responsavel_id(id,nome_completo)';

@Service()
export class PedidosEstoqueService {
  private readonly api = inject(BaseApiService);
  private readonly authService = inject(AuthService);
  private readonly medicamentosService = inject(MedicamentosService);

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

    this._isSubmitting.set(true);
    this._error.set(null);

    const payload = {
      medicamento_id: dto.medicamento_id,
      quantidade_solicitada: dto.quantidade_solicitada,
      status: 'PENDENTE' as const,
      medico_solicitante_id: user.role === 'MEDICO' ? user.id : null,
      gerente_responsavel_id: user.role === 'GERENTE_ESTOQUE' ? user.id : null,
      justificativa: dto.justificativa.trim() || null,
    };

    return this.api
      .postOne<PedidoEstoque>(
        'pedidos_estoque',
        payload,
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
        switchMap((updatedPedido) => {
          if (novoStatus !== 'RECEBIDO') {
            return of(updatedPedido);
          }

          const medicamento = this.resolverMedicamentoDoPedido(pedido);
          if (!medicamento) {
            return this.medicamentosService.loadMedicamentos().pipe(map(() => updatedPedido));
          }

          return this.medicamentosService
            .movimentarSaldo({
              medicamento,
              tipo: 'ENTRADA',
              quantidade: pedido.quantidade_solicitada,
              medico_solicitante_id: pedido.medico_solicitante_id,
              observacao: `Recebimento do pedido #${pedido.id.slice(0, 8)}`,
            })
            .pipe(map(() => updatedPedido));
        }),
        tap((updatedPedido) => {
          this._pedidos.update((prev) =>
            prev.map((item) => (item.id === pedido.id ? updatedPedido : item)),
          );
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
  }

  private resolverMedicamentoDoPedido(pedido: PedidoEstoque): Medicamento | null {
    const emMemoria = this.medicamentosService
      .medicamentos()
      .find((m) => m.id === pedido.medicamento_id);

    if (emMemoria) return emMemoria;
    if (!pedido.medicamento) return null;

    return {
      ...pedido.medicamento,
      principio_ativo: '',
      status:
        pedido.medicamento.quantidade_atual < pedido.medicamento.estoque_minimo
          ? 'REPOSICAO'
          : 'NORMAL',
      ativo: true,
      criado_em: '',
      atualizado_em: '',
    };
  }
}
