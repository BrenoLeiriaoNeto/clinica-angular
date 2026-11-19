import { ApplicationConfig, provideBrowserGlobalErrorListeners  } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideOptimus } from '@openng/optimus-ui/config';
import Aura from '@openng/optimus-ui-themes/aura';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { supabaseInterceptor } from './core/http/supabase.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([supabaseInterceptor])),
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
