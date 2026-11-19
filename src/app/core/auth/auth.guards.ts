import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { UserRole } from '../models/auth.model';

export const authGuards: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = (route.data?.['roles'] as UserRole[]) ?? [];

  if (allowedRoles.length === 0 || authService.hasAnyRole(allowedRoles)) return true;

  return router.createUrlTree([authService.homeRouteByRole()]);
}
