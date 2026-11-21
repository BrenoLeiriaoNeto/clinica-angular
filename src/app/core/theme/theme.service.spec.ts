import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('app-dark');
    TestBed.configureTestingModule({});
  });

  it('toggles .app-dark class on documentElement and persists choice in localStorage', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();

    expect(service.isDark()).toBe(false);
    expect(document.documentElement.classList.contains('app-dark')).toBe(false);

    service.toggleTheme();
    TestBed.flushEffects();

    expect(service.isDark()).toBe(true);
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
    expect(localStorage.getItem('medicore_theme')).toBe('dark');
  });

  it('restores dark mode from localStorage on initialization', () => {
    localStorage.setItem('medicore_theme', 'dark');

    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();

    expect(service.isDark()).toBe(true);
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
  });
});
