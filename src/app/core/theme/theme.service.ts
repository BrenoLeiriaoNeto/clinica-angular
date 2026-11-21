import { effect, inject, Service, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const THEME_STORAGE_KEY = 'medicore_theme';

@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly _isDark = signal<boolean>(this.resolveInitialTheme());
  readonly isDark = this._isDark.asReadonly();

  constructor() {
    effect(() => {
      const dark = this._isDark();
      this.document.documentElement.classList.toggle('app-dark', dark);

      try {
        localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
      } catch {}
    });
  }

  toggleTheme(): void {
    this._isDark.update((dark) => !dark);
  }

  setDarkMode(dark: boolean): void {
    this._isDark.set(dark);
  }

  private resolveInitialTheme(): boolean {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch {}

    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }

}
