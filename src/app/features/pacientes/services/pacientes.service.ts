import { computed, inject, Service, signal } from '@angular/core';
import { BaseApiService } from '../../../core/http/base-api.service';
import { Paciente, PacienteAgendamentoResumo } from '../models/paciente.model';
import { catchError, defer, finalize, Observable, tap, throwError } from 'rxjs';
import { CreatePacienteDto, UpdatePacienteDto } from '../models/dtos/paciente.dto';
import {
  formatCpf,
  formatTelefone,
  isMaskedCpf,
  isValidCpf,
  isValidDataNascimento,
  isValidEmail,
  isValidTelefone,
} from '../utils/paciente-validators';
import { PACIENTE_AGENDAMENTOS_SELECT } from '../../../../database/queries';

@Service()
export class PacientesService {
  private readonly api = inject(BaseApiService);

  private readonly _pacientes = signal<Paciente[]>([]);
  private readonly _activeLoads = signal(0);
  private readonly _isSubmitting = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly pacientes = this._pacientes.asReadonly();
  readonly isLoading = computed(() => this._activeLoads() > 0);
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly error = this._error.asReadonly();

  readonly pacientesAtivos = computed(() => this._pacientes().filter((p) => p.ativo));
  readonly pacientesInativos = computed(() => this._pacientes().filter((p) => !p.ativo));

  readonly novosNoMes = computed(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return this._pacientes().filter((p) => {
      const created = new Date(p.criado_em);

      return created.getFullYear() === currentYear && created.getMonth() === currentMonth;
    }).length;
  });

  loadPacientes(): Observable<Paciente[]> {
    return defer(() => {
      this._activeLoads.update((count) => count + 1);
      this._error.set(null);

      return this.api
        .get<Paciente[]>('perfis', {
          select: '*',
          role: 'eq.PACIENTE',
          order: 'nome_completo.asc',
        })
        .pipe(
          tap((items) => this._pacientes.set(items)),
          catchError((err) => {
            return throwError(() => err);
          }),
          finalize(() => this._activeLoads.update((count) => Math.max(0, count - 1))),
        );
    });
  }

  criar(dto: CreatePacienteDto): Observable<Paciente> {
    const nome = dto.nome_completo.trim();
    const email = dto.email.trim().toLowerCase();
    const documento = dto.documento.trim();
    const dataNascimento = dto.data_nascimento.trim();
    const telefone = dto.telefone.trim();
    const senha = dto.senha_inicial.trim();

    if (nome.length < 3) {
      return throwError(() => new Error('Informe o nome completo (mínimo 3 caracteres).'));
    }
    if (!isValidEmail(email)) {
      return throwError(() => new Error('Informe um endereço de e-mail válido.'));
    }
    if (!isValidCpf(documento)) {
      return throwError(() => new Error('Informe um CPF válido com 11 dígitos.'));
    }
    if (!isValidDataNascimento(dataNascimento)) {
      return throwError(() => new Error('Informe uma data de nascimento válida.'));
    }
    if (!isValidTelefone(telefone)) {
      return throwError(() => new Error('Informe um telefone válido com DDD.'));
    }
    if (senha.length < 6) {
      return throwError(() => new Error('A senha inicial deve ter no mínimo 6 caracteres.'));
    }

    this._isSubmitting.set(true);
    this._error.set(null);

    return this.api
      .rpc<Paciente>('cadastrar_paciente', {
        p_nome_completo: nome,
        p_email: email,
        p_documento: formatCpf(documento),
        p_data_nascimento: dataNascimento,
        p_telefone: formatTelefone(telefone),
        p_senha_inicial: senha,
      })
      .pipe(
        tap((created) => {
          this._pacientes.update((prev) =>
            [...prev, created].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo)),
          );
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
  }

  atualizar(id: string, dto: UpdatePacienteDto): Observable<Paciente> {
    const nome = dto.nome_completo.trim();
    const documento = dto.documento.trim();
    const dataNascimento = dto.data_nascimento.trim();
    const telefone = dto.telefone.trim();

    if (nome.length < 3) {
      return throwError(() => new Error('Informe o nome completo (mínimo 3 caracteres).'));
    }
    if (documento && !isValidCpf(documento) && !isMaskedCpf(documento)) {
      return throwError(() => new Error('Informe um CPF válido com 11 dígitos.'));
    }
    if (dataNascimento && !isValidDataNascimento(dataNascimento)) {
      return throwError(() => new Error('Informe uma data de nascimento válida.'));
    }
    if (telefone && !isValidTelefone(telefone)) {
      return throwError(() => new Error('Informe um telefone válido com DDD.'));
    }

    this._isSubmitting.set(true);
    this._error.set(null);

    return this.api
      .patchOne<Paciente>(
        'perfis',
        {
          nome_completo: nome,
          documento: documento ? formatCpf(documento) : null,
          data_nascimento: dataNascimento || null,
          telefone: telefone ? formatTelefone(telefone) : null,
        },
        { id: `eq.${id}`, role: 'eq.PACIENTE' },
        'Paciente não encontrado para atualização.',
      )
      .pipe(
        tap((updated) => {
          this._pacientes.update((prev) =>
            prev
              .map((item) => (item.id === id ? updated : item))
              .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo)),
          );
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
  }

  alternarAtivo(paciente: Paciente): Observable<Paciente> {
    this._isSubmitting.set(true);

    return this.api
      .patchOne<Paciente>(
        'perfis',
        { ativo: !paciente.ativo },
        { id: `eq.${paciente.id}`, role: 'eq.PACIENTE' },
        'Paciente não encontrado para alterar status.',
      )
      .pipe(
        tap((updated) => {
          this._pacientes.update((prev) =>
            prev.map((item) => (item.id === paciente.id ? updated : item)),
          );
        }),
        finalize(() => this._isSubmitting.set(false)),
      );
  }

  loadAgendamentosDoPaciente(pacienteId: string): Observable<PacienteAgendamentoResumo[]> {
    return this.api.get<PacienteAgendamentoResumo[]>('agendamentos', {
      select: PACIENTE_AGENDAMENTOS_SELECT,
      paciente_id: `eq.${pacienteId}`,
      order: 'data_hora_inicio.desc',
    });
  }
}
