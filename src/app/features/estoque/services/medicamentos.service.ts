import { computed, inject, Service, signal } from '@angular/core';
import { catchError, EMPTY, finalize, Observable, tap, throwError } from 'rxjs';
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
    if (
      !dto.codigo_sku.trim() ||
      !dto.nome.trim() ||
      !dto.principio_ativo.trim() ||
      !dto.unidade_medida.trim() ||
      !Number.isInteger(dto.quantidade_atual) ||
      dto.quantidade_atual < 0 ||
      !Number.isInteger(dto.estoque_minimo) ||
      dto.estoque_minimo < 0
    ) {
      return throwError(
        () => new Error('Preencha todos os campos obrigatórios com valores válidos.'),
      );
    }

    this._isSubmitting.set(true);
    this._error.set(null);

    return this.api
      .postOne<Medicamento>(
        'medicamentos',
        {
          codigo_sku: dto.codigo_sku.trim().toUpperCase(),
          nome: dto.nome.trim(),
          principio_ativo: dto.principio_ativo.trim(),
          unidade_medida: dto.unidade_medida.trim(),
          quantidade_atual: Math.trunc(dto.quantidade_atual),
          estoque_minimo: Math.trunc(dto.estoque_minimo),
        },
        'Falha ao cadastrar medicamento.',
      )
      .pipe(
        tap((created) => {
          this._medicamentos.update((prev) =>
            [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)),
          );
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
  }

  atualizar(id: string, dto: UpdateMedicamentoDto): Observable<Medicamento> {
    if (
      !dto.nome.trim() ||
      !dto.principio_ativo.trim() ||
      !dto.unidade_medida.trim() ||
      !Number.isInteger(dto.estoque_minimo) ||
      dto.estoque_minimo < 0
    ) {
      return throwError(() => new Error('Dados inválidos para atualização do medicamento.'));
    }

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
    if (!Number.isInteger(dto.quantidade)) {
      return throwError(() => new Error('A quantidade deve ser um número inteiro.'));
    }

    if (dto.tipo !== 'AJUSTE' && dto.quantidade <= 0) {
      return throwError(() => new Error('A quantidade deve ser maior que zero.'));
    }
    if (dto.tipo === 'SAIDA' && dto.quantidade > dto.medicamento.quantidade_atual) {
      return throwError(() => new Error('Saldo insuficiente em estoque para esta saída.'));
    }
    if (dto.tipo === 'AJUSTE' && dto.quantidade < 0) {
      return throwError(() => new Error('O saldo ajustado não pode ser negativo.'));
    }

    this._isSubmitting.set(true);
    this._error.set(null);

    return this.api
      .rpc<Medicamento>('registrar_movimentacao_estoque', {
        p_medicamento_id: dto.medicamento.id,
        p_tipo: dto.tipo,
        p_quantidade: dto.quantidade,
        p_observacao: dto.observacao.trim() || null,
        p_medico_solicitante_id: dto.medico_solicitante_id?.trim() || null,
      })
      .pipe(
        tap((updatedMed) => {
          this._medicamentos.update((prev) =>
            prev.map((item) => (item.id === updatedMed.id ? updatedMed : item)),
          );
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
}
