import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'medicore_theme';

@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly _isDark = signal<boolean>(this.resolveInitialTheme());
  readonly isDark = this._isDark.asReadonly();

  constructor() {
    this.applyTheme(this._isDark());
  }

  toggleTheme(): void {
    this.setDarkMode(!this._isDark());
  }

  setDarkMode(dark: boolean): void {
    this._isDark.set(dark);
    this.applyTheme(dark);
  }

  private applyTheme(dark: boolean): void {
    this.document.documentElement.classList.toggle('app-dark', dark);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
    } catch {
    }
  }

  private resolveInitialTheme(): boolean {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch {
    }

    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }
}
