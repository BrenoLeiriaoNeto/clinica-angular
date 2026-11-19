import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const supabaseInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.supabaseUrl)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.accessToken();

  const headers: Record<string, string> = {
    apiKey: environment.supabasePublishableKey
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const clonedReq = req.clone({ setHeaders: headers });

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/v1/token')) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  )
}
