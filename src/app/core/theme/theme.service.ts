import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'medicore_theme';

export interface ThemeTransitionOrigin {
  x: number;
  y: number;
}

@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly _isDark = signal<boolean>(this.resolveInitialTheme());
  readonly isDark = this._isDark.asReadonly();

  private transitionId = 0;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.applyTheme(this._isDark());
  }

  toggleTheme(origin?: ThemeTransitionOrigin): void {
    this.setDarkMode(!this._isDark(), origin);
  }

  setDarkMode(dark: boolean, origin?: ThemeTransitionOrigin): void {
    if (dark === this.isDark()) return;

    const commit = () => {
      this._isDark.set(dark);
      this.applyTheme(dark);
    };

    if (this.prefersReducedMotion()) {
      commit();
      return;
    }

    const doc = this.document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> };
    };

    if (typeof doc.startViewTransition === 'function') {
      const root = this.document.documentElement;
      const currentId = ++this.transitionId;

      if (origin && typeof window !== 'undefined') {
        const endRadius = Math.hypot(
          Math.max(origin.x, window.innerWidth - origin.x),
          Math.max(origin.y, window.innerHeight - origin.y),
        );
        root.style.setProperty('--theme-x', `${origin.x}px`);
        root.style.setProperty('--theme-y', `${origin.y}px`);
        root.style.setProperty('--theme-r', `${endRadius}px`);
        root.classList.add('theme-transition-radial');
      } else {
        root.classList.remove('theme-transition-radial');
      }

      const transition = doc.startViewTransition(commit);
      transition.finished
        .catch(() => undefined)
        .finally(() => {
          if (currentId === this.transitionId) {
            root.classList.remove('theme-transition-radial');
          }
        });
      return;
    }

    // Fallback para browsers sem View Transitions (e execução síncrona no jsdom/Vitest)
    this.runCssFallback(commit);
  }

  private runCssFallback(commit: () => void): void {
    const root = this.document.documentElement;
    root.classList.add('theme-transition-fallback');
    commit();

    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
    }
    this.fallbackTimer = setTimeout(() => {
      root.classList.remove('theme-transition-fallback');
      this.fallbackTimer = null;
    }, 320);
  }

  private applyTheme(dark: boolean): void {
    this.document.documentElement.classList.toggle('app-dark', dark);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
    } catch {
      // Ignora erro de storage bloqueado
    }
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private resolveInitialTheme(): boolean {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch {
      // Ignora erro de storage bloqueado
    }

    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }
}
