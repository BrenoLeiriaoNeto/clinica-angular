import { SupabaseAuthResponse, UserProfile, UserRole } from '../models/auth.model';
import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'medicore_sessions';

interface StoredSession {
  accessToken: string;
  user: UserProfile;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _session =
    signal<StoredSession | null>(this.loadSession());

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

  login(email: string, password: string): Observable<UserProfile> {
    const url = `${environment.supabaseUrl}/auth/v1/token?grant_type=password`;

    return this.http.post<SupabaseAuthResponse>(url, {email, password}).pipe(
      map((res) => {
        const profile: UserProfile = {
          id: res.user.id,
          email: res.user.email,
          fullName: res.user.user_metadata.fullName ?? res.user.email,
          role: res.user.user_metadata.role ?? 'PACIENTE',
          document: res.user.user_metadata.document
        };

        const session: StoredSession = {
          accessToken: res.access_token,
          user: profile
        };

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        this._session.set(session);

        return profile;
      })
    );
  }

  logout(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    this._session.set(null);
  }

  hasAnyRole(allowedRoles: UserRole[]): boolean {
    const role = this.currentRole();
    return role !== null && allowedRoles.includes(role);
  }

  private loadSession(): StoredSession | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }
}
