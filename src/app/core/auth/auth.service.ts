import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StoredSession, SupabaseAuthResponse, UserProfile, UserRole } from '../models/auth.model';

const STORAGE_KEY = 'medicore_sessions';
const VALID_ROLES: ReadonlySet<UserRole> = new Set([
  'PACIENTE',
  'MEDICO',
  'GERENTE_ESTOQUE',
  'RECEPCIONISTA',
]);

interface PerfilRow {
  nome_completo: string;
  role: UserRole;
  documento: string | null;
}

@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private expirationTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _session = signal<StoredSession | null>(this.loadSession());

  readonly currentUser = computed(() => this._session()?.user ?? null);
  readonly accessToken = computed(() => this._session()?.accessToken ?? null);
  readonly currentRole = computed(() => this._session()?.user?.role ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);

  readonly homeRouteByRole = computed<string>(() => {
    switch (this.currentRole()) {
      case 'PACIENTE':
        return '/portal';
      case 'GERENTE_ESTOQUE':
        return '/estoque';
      case 'RECEPCIONISTA':
      case 'MEDICO':
        return '/dashboard';
      default:
        return '/login';
    }
  });

  constructor() {
    const initial = this._session();
    if (initial) {
      this.scheduleExpiration(initial.expiresAt);
    }

    this.destroyRef.onDestroy(() => this.clearExpirationTimer());
  }

  login(email: string, password: string): Observable<UserProfile> {
    const authUrl = `${environment.supabaseUrl}/auth/v1/token?grant_type=password`;
    const perfilUrl = `${environment.supabaseUrl}/rest/v1/perfis`;

    return this.http.post<SupabaseAuthResponse>(authUrl, { email, password }).pipe(
      switchMap((res) =>
        this.http
          .get<PerfilRow[]>(perfilUrl, {
            params: {
              id: `eq.${res.user.id}`,
              select: 'nome_completo,role,documento',
            },
            headers: {
              apiKey: environment.supabasePublishableKey,
              Authorization: `Bearer ${res.access_token}`,
            },
          })
          .pipe(
            map((rows) => {
              const row = rows[0];
              if (!row || !VALID_ROLES.has(row.role)) {
                throw new Error('Perfil de usuário não encontrado ou papel inválido.');
              }

              const profile: UserProfile = {
                id: res.user.id,
                email: res.user.email,
                fullName: row.nome_completo || res.user.email,
                role: row.role,
                ...(row.documento ? { document: row.documento } : {}),
              };

              const session: StoredSession = {
                accessToken: res.access_token,
                expiresAt: Date.now() + res.expires_in * 1000,
                user: profile,
              };

              sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
              this._session.set(session);
              this.scheduleExpiration(session.expiresAt);

              return profile;
            }),
          ),
      ),
    );
  }

  logout(): void {
    this.clearExpirationTimer();
    sessionStorage.removeItem(STORAGE_KEY);
    this._session.set(null);
  }

  hasAnyRole(allowedRoles: UserRole[]): boolean {
    const role = this.currentRole();
    return role !== null && allowedRoles.includes(role);
  }

  private scheduleExpiration(expiresAt: number): void {
    this.clearExpirationTimer();
    const delayMs = expiresAt - Date.now();
    if (delayMs <= 0) {
      this.logout();
      return;
    }

    this.expirationTimer = setTimeout(() => {
      this.logout();
    }, delayMs);
  }

  private clearExpirationTimer(): void {
    if (this.expirationTimer !== null) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  private loadSession(): StoredSession | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      const user = parsed.user;

      if (
        typeof parsed.accessToken !== 'string' ||
        !parsed.accessToken ||
        typeof parsed.expiresAt !== 'number' ||
        !Number.isFinite(parsed.expiresAt) ||
        parsed.expiresAt <= Date.now() ||
        !user ||
        typeof user.id !== 'string' ||
        typeof user.email !== 'string' ||
        typeof user.fullName !== 'string' ||
        !VALID_ROLES.has(user.role)
      ) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return {
        accessToken: parsed.accessToken,
        expiresAt: parsed.expiresAt,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          ...(typeof user.document === 'string' && user.document
            ? { document: user.document }
            : {}),
        },
      };
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }
}
