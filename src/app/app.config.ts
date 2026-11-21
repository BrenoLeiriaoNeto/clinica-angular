import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners  } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideOptimus } from '@openng/optimus-ui/config';
import Aura from '@openng/optimus-ui-themes/aura';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { supabaseInterceptor } from './core/http/supabase.interceptor';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([supabaseInterceptor])),
    provideAppInitializer(() => {
      inject(ThemeService)
    }),
    provideOptimus({ theme: {
      preset: Aura,
      options: {
        darkModeSelector: '.app-dark'
      }
    },
      ripple: true
    }),
  ],
};
