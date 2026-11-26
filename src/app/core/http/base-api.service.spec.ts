import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { BaseApiService } from './base-api.service';

describe('BaseApiService', () => {
  let service: BaseApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(BaseApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('calls PostgREST RPC endpoint with payload', () => {
    service.rpc('registrar_movimentacao_estoque', { p_quantidade: 10 }).subscribe();

    const req = httpMock.expectOne(
      `${environment.supabaseUrl}/rest/v1/rpc/registrar_movimentacao_estoque`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ p_quantidade: 10 });
    req.flush({});
  });

  it('sends GET requests with and without queryParams', () => {
    service.get('medicamentos').subscribe();
    const plainReq = httpMock.expectOne(`${environment.supabaseUrl}/rest/v1/medicamentos`);
    expect(plainReq.request.method).toBe('GET');
    expect(plainReq.request.params.keys().length).toBe(0);
    plainReq.flush([]);

    service.get('medicamentos', { select: '*', order: 'nome.asc' }).subscribe();
    const filteredReq = httpMock.expectOne(
      (r) =>
        r.url === `${environment.supabaseUrl}/rest/v1/medicamentos` &&
        r.params.get('select') === '*' &&
        r.params.get('order') === 'nome.asc',
    );
    expect(filteredReq.request.method).toBe('GET');
    filteredReq.flush([]);
  });

  it('extracts first element in postOne and throws when response array is empty', () => {
    let created: { id: string } | undefined;
    service
      .postOne<{ id: string }>('medicamentos', { nome: 'Dipirona' }, 'Falha customizada', {
        select: 'id',
      })
      .subscribe((res) => (created = res));

    const postReq = httpMock.expectOne(
      (r) =>
        r.url === `${environment.supabaseUrl}/rest/v1/medicamentos` &&
        r.params.get('select') === 'id',
    );
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.headers.get('Prefer')).toBe('return=representation');
    postReq.flush([{ id: '1' }]);
    expect(created).toEqual({ id: '1' });

    let errorMsg = '';
    service.postOne<{ id: string }>('medicamentos', { nome: 'Vazio' }).subscribe({
      error: (err: Error) => (errorMsg = err.message),
    });

    httpMock.expectOne(`${environment.supabaseUrl}/rest/v1/medicamentos`).flush([]);
    expect(errorMsg).toBe('Nenhum registro retornado ao criar recurso.');
  });

  it('extracts first element in patchOne and throws when response array is empty', () => {
    let updated: { id: string } | undefined;
    service
      .patchOne<{ id: string }>('medicamentos', { ativo: false }, { id: 'eq.1' })
      .subscribe((res) => (updated = res));

    const patchReq = httpMock.expectOne(
      (r) =>
        r.url === `${environment.supabaseUrl}/rest/v1/medicamentos` &&
        r.params.get('id') === 'eq.1',
    );
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.headers.get('Prefer')).toBe('return=representation');
    patchReq.flush([{ id: '1' }]);
    expect(updated).toEqual({ id: '1' });

    let errorMsg = '';
    service
      .patchOne<{ id: string }>('medicamentos', { ativo: false }, { id: 'eq.404' }, 'Não achou')
      .subscribe({
        error: (err: Error) => (errorMsg = err.message),
      });

    httpMock
      .expectOne(
        (r) =>
          r.url === `${environment.supabaseUrl}/rest/v1/medicamentos` &&
          r.params.get('id') === 'eq.404',
      )
      .flush([]);
    expect(errorMsg).toBe('Não achou');
  });
});
