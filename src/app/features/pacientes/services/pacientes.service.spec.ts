import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { Paciente } from '../models/paciente.model';
import { PacientesService } from './pacientes.service';

describe('PacientesService', () => {
  let service: PacientesService;
  let httpMock: HttpTestingController;

  const mockLucas: Paciente = {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'paciente@medicore.com',
    nome_completo: 'Lucas Mendes',
    role: 'PACIENTE',
    documento: '***.482.910-**',
    data_nascimento: '1994-05-18',
    telefone: '(11) 99123-4567',
    ativo: true,
    criado_em: '2026-11-20T10:00:00Z',
    atualizado_em: '2026-11-20T10:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(PacientesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('carrega pacientes apenas ao assinar o Observable e atualiza isLoading', () => {
    const request$ = service.loadPacientes();
    expect(service.isLoading()).toBe(false);

    request$.subscribe();
    expect(service.isLoading()).toBe(true);

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.supabaseUrl}/rest/v1/perfis` &&
        r.method === 'GET' &&
        r.params.get('role') === 'eq.PACIENTE',
    );
    req.flush([mockLucas]);

    expect(service.isLoading()).toBe(false);
    expect(service.pacientes().length).toBe(1);
    expect(service.pacientesAtivos().length).toBe(1);
  });

  it('rejeita CPF inválido e data de nascimento futura antes de chamar a RPC', () => {
    let cpfError = '';
    service
      .criar({
        nome_completo: 'Ana Paula Silva',
        email: 'ana@medicore.com',
        documento: '111.111.111-11',
        data_nascimento: '1990-04-10',
        telefone: '11988887777',
        senha_inicial: 'Clinica@2026',
      })
      .subscribe({ error: (err: Error) => (cpfError = err.message) });

    expect(cpfError).toContain('CPF válido');

    let dateError = '';
    service
      .criar({
        nome_completo: 'Ana Paula Silva',
        email: 'ana@medicore.com',
        documento: '52998224725',
        data_nascimento: '2099-01-01',
        telefone: '11988887777',
        senha_inicial: 'Clinica@2026',
      })
      .subscribe({ error: (err: Error) => (dateError = err.message) });

    expect(dateError).toContain('data de nascimento');
    httpMock.expectNone(`${environment.supabaseUrl}/rest/v1/rpc/cadastrar_paciente`);
  });

  it('chama RPC cadastrar_paciente com campos formatados e ordena o signal', () => {
    service.loadPacientes().subscribe();
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/perfis`)
      .flush([mockLucas]);

    service
      .criar({
        nome_completo: 'Ana Paula Silva',
        email: 'ANA@MEDICORE.COM',
        documento: '52998224725',
        data_nascimento: '1992-08-15',
        telefone: '11987654321',
        senha_inicial: 'Clinica@2026',
      })
      .subscribe();

    const rpcReq = httpMock.expectOne(`${environment.supabaseUrl}/rest/v1/rpc/cadastrar_paciente`);
    expect(rpcReq.request.method).toBe('POST');
    expect(rpcReq.request.body).toEqual({
      p_nome_completo: 'Ana Paula Silva',
      p_email: 'ana@medicore.com',
      p_documento: '529.982.247-25',
      p_data_nascimento: '1992-08-15',
      p_telefone: '(11) 98765-4321',
      p_senha_inicial: 'Clinica@2026',
    });

    rpcReq.flush({
      id: '66666666-6666-6666-6666-666666666666',
      email: 'ana@medicore.com',
      nome_completo: 'Ana Paula Silva',
      role: 'PACIENTE',
      documento: '529.982.247-25',
      data_nascimento: '1992-08-15',
      telefone: '(11) 98765-4321',
      ativo: true,
      criado_em: '2026-11-26T15:00:00Z',
      atualizado_em: '2026-11-26T15:00:00Z',
    });

    expect(service.pacientes().map((p) => p.nome_completo)).toEqual([
      'Ana Paula Silva',
      'Lucas Mendes',
    ]);
  });

  it('alterna status ativo do paciente via PATCH e atualiza signal', () => {
    service.loadPacientes().subscribe();
    httpMock
      .expectOne((r) => r.url === `${environment.supabaseUrl}/rest/v1/perfis`)
      .flush([mockLucas]);

    service.alternarAtivo(mockLucas).subscribe();

    const patchReq = httpMock.expectOne(
      (r) => r.url === `${environment.supabaseUrl}/rest/v1/perfis` && r.method === 'PATCH',
    );
    expect(patchReq.request.body).toEqual({ ativo: false });
    patchReq.flush([{ ...mockLucas, ativo: false }]);

    expect(service.pacientes()[0]?.ativo).toBe(false);
    expect(service.pacientesInativos().length).toBe(1);
  });
});
