import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { UserRole } from '../models/auth.model';
import { authGuard, guestGuard, roleGuard } from './auth.guards';
import { AuthService } from './auth.service';

describe('Auth Guards', () => {
  let router: Router;
  const isAuthenticatedSignal = signal(false);
  const currentRoleSignal = signal<UserRole | null>(null);
  const homeRouteSignal = signal('/dashboard');

  const authServiceMock = {
    isAuthenticated: isAuthenticatedSignal.asReadonly(),
    homeRouteByRole: homeRouteSignal.asReadonly(),
    hasAnyRole: (allowedRoles: UserRole[]) => {
      const role = currentRoleSignal();
      return role !== null && allowedRoles.includes(role);
    },
  };

  const dummyState = {} as RouterStateSnapshot;

  function createRouteSnapshot(data: Record<string, unknown> = {}): ActivatedRouteSnapshot {
    return { data } as ActivatedRouteSnapshot;
  }

  beforeEach(() => {
    isAuthenticatedSignal.set(false);
    currentRoleSignal.set(null);
    homeRouteSignal.set('/dashboard');

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceMock }],
    });

    router = TestBed.inject(Router);
  });

  describe('authGuard', () => {
    it('redirects unauthenticated users to /login', () => {
      const result = TestBed.runInInjectionContext(() =>
        authGuard(createRouteSnapshot(), dummyState),
      );

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/login');
    });

    it('allows authenticated users', () => {
      isAuthenticatedSignal.set(true);

      const result = TestBed.runInInjectionContext(() =>
        authGuard(createRouteSnapshot(), dummyState),
      );

      expect(result).toBe(true);
    });
  });

  describe('guestGuard', () => {
    it('allows unauthenticated visitors', () => {
      const result = TestBed.runInInjectionContext(() =>
        guestGuard(createRouteSnapshot(), dummyState),
      );

      expect(result).toBe(true);
    });

    it('redirects authenticated users to their role home route', () => {
      isAuthenticatedSignal.set(true);
      homeRouteSignal.set('/estoque');

      const result = TestBed.runInInjectionContext(() =>
        guestGuard(createRouteSnapshot(), dummyState),
      );

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/estoque');
    });
  });

  describe('roleGuard', () => {
    it('allows navigation when route defines no roles restriction', () => {
      const result = TestBed.runInInjectionContext(() =>
        roleGuard(createRouteSnapshot(), dummyState),
      );

      expect(result).toBe(true);
    });

    it('allows navigation when current user has an allowed role', () => {
      currentRoleSignal.set('GERENTE_ESTOQUE');

      const result = TestBed.runInInjectionContext(() =>
        roleGuard(createRouteSnapshot({ roles: ['GERENTE_ESTOQUE', 'MEDICO'] }), dummyState),
      );

      expect(result).toBe(true);
    });

    it('redirects to role home route when user lacks required role', () => {
      currentRoleSignal.set('PACIENTE');
      homeRouteSignal.set('/portal');

      const result = TestBed.runInInjectionContext(() =>
        roleGuard(createRouteSnapshot({ roles: ['GERENTE_ESTOQUE'] }), dummyState),
      );

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/portal');
    });
  });
});
