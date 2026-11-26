import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { supabaseInterceptor } from './supabase.interceptor';

describe('supabaseInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;

  const accessTokenSignal = signal<string | null>(null);
  const isAuthenticatedSignal = signal(false);

  const authServiceMock = {
    accessToken: accessTokenSignal.asReadonly(),
    isAuthenticated: isAuthenticatedSignal.asReadonly(),
    logout: vi.fn(() => {
      accessTokenSignal.set(null);
      isAuthenticatedSignal.set(false);
    }),
  };

  beforeEach(() => {
    accessTokenSignal.set(null);
    isAuthenticatedSignal.set(false);
    authServiceMock.logout.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([supabaseInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('does not attach Supabase headers to third-party or relative URLs', () => {
    accessTokenSignal.set('secret-jwt');
    isAuthenticatedSignal.set(true);

    http.get('https://api.external.example/data').subscribe();
    const externalReq = httpMock.expectOne('https://api.external.example/data');
    expect(externalReq.request.headers.has('apiKey')).toBe(false);
    expect(externalReq.request.headers.has('Authorization')).toBe(false);
    externalReq.flush({});

    http.get('/assets/local.json').subscribe();
    const localReq = httpMock.expectOne('/assets/local.json');
    expect(localReq.request.headers.has('apiKey')).toBe(false);
    expect(localReq.request.headers.has('Authorization')).toBe(false);
    localReq.flush({});
  });

  it('attaches apiKey without Authorization when unauthenticated', () => {
    const url = `${environment.supabaseUrl}/rest/v1/medicamentos`;
    http.get(url).subscribe();

    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('apiKey')).toBe(environment.supabasePublishableKey);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('attaches both apiKey and Bearer token for authenticated Supabase requests', () => {
    accessTokenSignal.set('jwt-xyz');
    isAuthenticatedSignal.set(true);

    const url = `${environment.supabaseUrl}/rest/v1/medicamentos`;
    http.get(url).subscribe();

    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('apiKey')).toBe(environment.supabasePublishableKey);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-xyz');
    req.flush([]);
  });

  it('logs out and redirects to /login on 401 from protected endpoints', () => {
    accessTokenSignal.set('expired-jwt');
    isAuthenticatedSignal.set(true);

    const url = `${environment.supabaseUrl}/rest/v1/medicamentos`;
    let caughtStatus = 0;

    http.get(url).subscribe({
      error: (err) => {
        caughtStatus = err.status;
      },
    });

    httpMock.expectOne(url).flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(caughtStatus).toBe(401);
    expect(authServiceMock.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not logout on 401 from /auth/v1/token or on non-401 errors', () => {
    accessTokenSignal.set('jwt-active');
    isAuthenticatedSignal.set(true);

    const loginUrl = `${environment.supabaseUrl}/auth/v1/token?grant_type=password`;
    http.post(loginUrl, {}).subscribe({ error: () => undefined });
    httpMock.expectOne(loginUrl).flush({}, { status: 401, statusText: 'Unauthorized' });

    const dataUrl = `${environment.supabaseUrl}/rest/v1/medicamentos`;
    http.get(dataUrl).subscribe({ error: () => undefined });
    httpMock.expectOne(dataUrl).flush({}, { status: 500, statusText: 'Server Error' });

    expect(authServiceMock.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('handles 401 idempotently when session is already cleared', () => {
    const url = `${environment.supabaseUrl}/rest/v1/medicamentos`;
    http.get(url).subscribe({ error: () => undefined });
    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceMock.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
