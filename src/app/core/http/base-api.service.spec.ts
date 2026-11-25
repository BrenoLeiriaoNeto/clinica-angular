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
});
