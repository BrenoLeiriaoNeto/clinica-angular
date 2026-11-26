import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { StoredSession, SupabaseAuthResponse, UserProfile, UserRole } from '../models/auth.model';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'medicore_sessions';

describe('AuthService', () => {
  let httpMock: HttpTestingController;

  const baseAuthResponse: SupabaseAuthResponse = {
    access_token: 'jwt-token-123',
    refresh_token: 'refresh-token-123',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'medico@medicore.com',
      user_metadata: {},
    },
  };

  function createService(): AuthService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock?.verify();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('starts unauthenticated when sessionStorage is empty', () => {
    const service = createService();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.currentRole()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.homeRouteByRole()).toBe('/login');
    expect(service.hasAnyRole(['MEDICO'])).toBe(false);
  });

  it('authenticates via GoTrue, fetches authoritative role from perfis, and persists session', () => {
    const service = createService();
    let loggedProfile: UserProfile | undefined;

    service.login('medico@medicore.com', 'Clinica@2026').subscribe((profile) => {
      loggedProfile = profile;
    });

    const tokenReq = httpMock.expectOne(
      `${environment.supabaseUrl}/auth/v1/token?grant_type=password`,
    );
    expect(tokenReq.request.method).toBe('POST');
    expect(tokenReq.request.body).toEqual({
      email: 'medico@medicore.com',
      password: 'Clinica@2026',
    });
    tokenReq.flush(baseAuthResponse);

    const perfilReq = httpMock.expectOne(
      (req) =>
        req.url === `${environment.supabaseUrl}/rest/v1/perfis` &&
        req.params.get('id') === `eq.${baseAuthResponse.user.id}` &&
        req.params.get('select') === 'nome_completo,role,documento',
    );
    expect(perfilReq.request.headers.get('Authorization')).toBe('Bearer jwt-token-123');
    expect(perfilReq.request.headers.get('apiKey')).toBe(environment.supabasePublishableKey);
    perfilReq.flush([
      {
        nome_completo: 'Dr. Henrique Vasconcelos',
        role: 'MEDICO',
        documento: 'CRM-SP 148.920',
      },
    ]);

    expect(loggedProfile).toEqual({
      id: baseAuthResponse.user.id,
      email: 'medico@medicore.com',
      fullName: 'Dr. Henrique Vasconcelos',
      role: 'MEDICO',
      document: 'CRM-SP 148.920',
    });
    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe('jwt-token-123');
    expect(service.currentRole()).toBe('MEDICO');
    expect(service.homeRouteByRole()).toBe('/dashboard');
    expect(service.hasAnyRole(['MEDICO', 'RECEPCIONISTA'])).toBe(true);
    expect(service.hasAnyRole(['PACIENTE'])).toBe(false);

    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as StoredSession;
    expect(stored.accessToken).toBe('jwt-token-123');
    expect(stored.user.role).toBe('MEDICO');
  });

  it('falls back to email when nome_completo is empty and omits document when null', () => {
    const service = createService();
    let loggedProfile: UserProfile | undefined;

    service.login('paciente@medicore.com', 'Clinica@2026').subscribe((profile) => {
      loggedProfile = profile;
    });

    httpMock
      .expectOne(`${environment.supabaseUrl}/auth/v1/token?grant_type=password`)
      .flush({
        ...baseAuthResponse,
        user: { ...baseAuthResponse.user, email: 'paciente@medicore.com' },
      });

    httpMock
      .expectOne((req) => req.url === `${environment.supabaseUrl}/rest/v1/perfis`)
      .flush([{ nome_completo: '', role: 'PACIENTE', documento: null }]);

    expect(loggedProfile).toEqual({
      id: baseAuthResponse.user.id,
      email: 'paciente@medicore.com',
      fullName: 'paciente@medicore.com',
      role: 'PACIENTE',
    });
    expect('document' in (loggedProfile ?? {})).toBe(false);
    expect(service.homeRouteByRole()).toBe('/portal');
  });

  it('rejects login when perfil row is missing or role is invalid', () => {
    const service = createService();
    let errorMsg = '';

    service.login('unknown@medicore.com', 'Clinica@2026').subscribe({
      error: (err: Error) => {
        errorMsg = err.message;
      },
    });

    httpMock
      .expectOne(`${environment.supabaseUrl}/auth/v1/token?grant_type=password`)
      .flush(baseAuthResponse);

    httpMock
      .expectOne((req) => req.url === `${environment.supabaseUrl}/rest/v1/perfis`)
      .flush([]);

    expect(errorMsg).toContain('Perfil de usuário não encontrado');
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each<[UserRole, string]>([
    ['PACIENTE', '/portal'],
    ['GERENTE_ESTOQUE', '/estoque'],
    ['RECEPCIONISTA', '/dashboard'],
    ['MEDICO', '/dashboard'],
  ])('maps homeRouteByRole for %s to %s', (role, expectedRoute) => {
    const validSession: StoredSession = {
      accessToken: 'stored-token',
      expiresAt: Date.now() + 60_000,
      user: {
        id: 'user-1',
        email: 'user@medicore.com',
        fullName: 'Usuário Teste',
        role,
        document: 'DOC-1',
      },
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(validSession));

    const service = createService();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.homeRouteByRole()).toBe(expectedRoute);
    expect(service.currentUser()?.document).toBe('DOC-1');
  });

  it('auto-logs out when the scheduled session expiration timer fires', () => {
    vi.useFakeTimers();
    const now = new Date('2026-11-26T12:00:00Z');
    vi.setSystemTime(now);

    const session: StoredSession = {
      accessToken: 'expiring-token',
      expiresAt: now.getTime() + 5_000,
      user: {
        id: 'user-1',
        email: 'estoque@medicore.com',
        fullName: 'Roberto',
        role: 'GERENTE_ESTOQUE',
      },
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));

    const service = createService();
    expect(service.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(4_999);
    expect(service.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clears expired, malformed, or invalid-role sessions from sessionStorage on init', () => {
    sessionStorage.setItem(STORAGE_KEY, '{invalid-json');
    let service = createService();
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    TestBed.resetTestingModule();
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: 'expired',
        expiresAt: Date.now() - 1000,
        user: { id: '1', email: 'a@b.com', fullName: 'A', role: 'MEDICO' },
      }),
    );
    service = createService();
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    TestBed.resetTestingModule();
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: 'bad-role',
        expiresAt: Date.now() + 60_000,
        user: { id: '1', email: 'a@b.com', fullName: 'A', role: 'ADMIN_FAKE' },
      }),
    );
    service = createService();
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clears state and storage on logout', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: 'token-abc',
        expiresAt: Date.now() + 60_000,
        user: { id: '1', email: 'a@b.com', fullName: 'Camila', role: 'RECEPCIONISTA' },
      }),
    );

    const service = createService();
    expect(service.isAuthenticated()).toBe(true);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
