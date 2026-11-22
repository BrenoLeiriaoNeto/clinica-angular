import { computed, inject, Service, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { BaseApiService } from '../../../core/http/base-api.service';
import {
  Medicamento,
} from '../models/estoque.model';
import { AuditoriaEstoqueService } from './auditoria-estoque.service';
import {
  CreateMedicamentoDto,
  RegistrarMovimentacaoDto,
  UpdateMedicamentoDto,
} from '../models/dtos/estoque.dto';

@Service()
export class MedicamentosService {
  private readonly api = inject(BaseApiService);
  private readonly authService = inject(AuthService);
  private readonly auditoriaService = inject(AuditoriaEstoqueService);

  private readonly _medicamentos = signal<Medicamento[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isSubmitting = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly medicamentos = this._medicamentos.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly error = this._error.asReadonly();

  readonly medicamentosAtivos = computed(() => this._medicamentos().filter((med) => med.ativo));

  readonly itensEmReposicao = computed(() =>
    this.medicamentosAtivos().filter((med) => med.status === 'REPOSICAO'),
  );

  readonly totalUnidadesEmEstoque = computed(() =>
    this.medicamentosAtivos().reduce((acc, med) => acc + med.quantidade_atual, 0),
  );

  loadMedicamentos(): Observable<Medicamento[]> {
    this._isLoading.set(true);
    this._error.set(null);

    return this.api
      .get<Medicamento[]>('medicamentos', {
        select: '*',
        order: 'nome.asc',
      })
      .pipe(
        tap((items) => this._medicamentos.set(items)),
        catchError((err) => {
          this._error.set('Não foi possível carregar o catálogo de medicamentos.');
          return throwError(() => err);
        }),
        finalize(() => this._isLoading.set(false)),
      );
  }

  criar(dto: CreateMedicamentoDto): Observable<Medicamento> {
    const userId = this.authService.currentUser()?.id;
    if (!userId) {
      return throwError(() => new Error('Usuário não autenticado.'));
    }

    this._isSubmitting.set(true);
    this._error.set(null);

    const payload = {
      ...dto,
      codigo_sku: dto.codigo_sku.trim().toUpperCase(),
      nome: dto.nome.trim(),
      principio_ativo: dto.principio_ativo.trim(),
      unidade_medida: dto.unidade_medida.trim(),
    };

    return this.api
      .postOne<Medicamento>('medicamentos', payload, 'Falha ao cadastrar medicamento.')
      .pipe(
        switchMap((created) => {
          if (created.quantidade_atual <= 0) {
            return of(created);
          }

          return this.auditoriaService
            .registrarLog({
              medicamento_id: created.id,
              tipo: 'ENTRADA',
              quantidade_anterior: 0,
              quantidade_movimentada: created.quantidade_atual,
              quantidade_posterior: created.quantidade_atual,
              gerente_responsavel_id: userId,
              observacao: 'Saldo inicial cadastrado no catálogo',
            })
            .pipe(map(() => created));
        }),
        tap((created) => {
          this._medicamentos.update((prev) =>
            [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)),
          );
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
  }

  atualizar(id: string, dto: UpdateMedicamentoDto): Observable<Medicamento> {
    this._isSubmitting.set(true);
    this._error.set(null);

    return this.api
      .patchOne<Medicamento>(
        'medicamentos',
        {
          nome: dto.nome.trim(),
          principio_ativo: dto.principio_ativo.trim(),
          unidade_medida: dto.unidade_medida.trim(),
          estoque_minimo: dto.estoque_minimo,
        },
        { id: `eq.${id}` },
        'Medicamento não encontrado para atualização.',
      )
      .pipe(
        tap((updated) => {
          this._medicamentos.update((prev) =>
            prev
              .map((item) => (item.id === id ? updated : item))
              .sort((a, b) => a.nome.localeCompare(b.nome)),
          );
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
  }

  alternarAtivo(medicamento: Medicamento): Observable<Medicamento> {
    this._isSubmitting.set(true);

    return this.api
      .patchOne<Medicamento>(
        'medicamentos',
        { ativo: !medicamento.ativo },
        { id: `eq.${medicamento.id}` },
        'Medicamento não encontrado para alterar status.',
      )
      .pipe(
        tap((updated) => {
          this._medicamentos.update((prev) =>
            prev.map((item) => (item.id === medicamento.id ? updated : item)),
          );
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
  }

  movimentarSaldo(dto: RegistrarMovimentacaoDto): Observable<Medicamento> {
    const userId = this.authService.currentUser()?.id;
    if (!userId) {
      return throwError(() => new Error('Usuário não autenticado.'));
    }

    const calculo = this.calcularNovoSaldo(dto);
    if ('error' in calculo) {
      return throwError(() => new Error(calculo.error));
    }

    this._isSubmitting.set(true);
    this._error.set(null);

    return this.api
      .patchOne<Medicamento>(
        'medicamentos',
        { quantidade_atual: calculo.posterior },
        { id: `eq.${dto.medicamento.id}` },
        'Falha ao atualizar o saldo do medicamento.',
      )
      .pipe(
        switchMap((updatedMed) =>
          this.auditoriaService
            .registrarLog({
              medicamento_id: dto.medicamento.id,
              tipo: dto.tipo,
              quantidade_anterior: calculo.anterior,
              quantidade_movimentada: calculo.movimentada,
              quantidade_posterior: calculo.posterior,
              gerente_responsavel_id: userId,
              medico_solicitante_id: dto.medico_solicitante_id ?? null,
              observacao: dto.observacao,
            })
            .pipe(map(() => updatedMed)),
        ),
        tap((updatedMed) => {
          this._medicamentos.update((prev) =>
            prev.map((item) => (item.id === updatedMed.id ? updatedMed : item)),
          );
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
  }

  private calcularNovoSaldo(
    dto: RegistrarMovimentacaoDto,
  ): { anterior: number; posterior: number; movimentada: number } | { error: string } {
    const anterior = dto.medicamento.quantidade_atual;

    if (dto.tipo === 'ENTRADA') {
      if (dto.quantidade <= 0) {
        return { error: 'A quantidade de entrada deve ser maior que zero.' };
      }
      return { anterior, posterior: anterior + dto.quantidade, movimentada: dto.quantidade };
    }

    if (dto.tipo === 'SAIDA') {
      if (dto.quantidade <= 0) {
        return { error: 'A quantidade de saída deve ser maior que zero.' };
      }
      if (dto.quantidade > anterior) {
        return { error: 'Saldo insuficiente em estoque para esta saída.' };
      }
      return { anterior, posterior: anterior - dto.quantidade, movimentada: dto.quantidade };
    }

    if (dto.quantidade < 0) {
      return { error: 'O saldo ajustado não pode ser negativo.' };
    }
    return {
      anterior,
      posterior: dto.quantidade,
      movimentada: Math.abs(dto.quantidade - anterior),
    };
  }
}
