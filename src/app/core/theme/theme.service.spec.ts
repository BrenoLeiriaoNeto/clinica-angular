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

  it('restores light mode from localStorage and ignores redundant setDarkMode calls', () => {
    localStorage.setItem('medicore_theme', 'light');
    const service = TestBed.inject(ThemeService);

    expect(service.isDark()).toBe(false);
    service.setDarkMode(false);
    expect(service.isDark()).toBe(false);
  });

  it('applies and cleans CSS fallback transition class when View Transitions API is unavailable', () => {
    vi.useFakeTimers();
    const service = TestBed.inject(ThemeService);

    service.toggleTheme();
    expect(document.documentElement.classList.contains('theme-transition-fallback')).toBe(true);

    service.toggleTheme();
    vi.advanceTimersByTime(320);
    expect(document.documentElement.classList.contains('theme-transition-fallback')).toBe(false);
    vi.useRealTimers();
  });

  it('uses View Transitions API with radial CSS variables when origin is provided', async () => {
    const startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: startViewTransition,
    });

    try {
      const service = TestBed.inject(ThemeService);
      service.toggleFromEvent({ clientX: 120, clientY: 40 } as MouseEvent);

      expect(startViewTransition).toHaveBeenCalledTimes(1);
      expect(document.documentElement.style.getPropertyValue('--theme-x')).toBe('120px');
      expect(document.documentElement.style.getPropertyValue('--theme-y')).toBe('40px');
      expect(document.documentElement.classList.contains('theme-transition-radial')).toBe(true);

      await Promise.resolve();
      await Promise.resolve();
      expect(document.documentElement.classList.contains('theme-transition-radial')).toBe(false);

      // Sem coordenadas explícitas, resolve pelo centro de currentTarget
      const targetEl = document.createElement('button');
      vi.spyOn(targetEl, 'getBoundingClientRect').mockReturnValue({
        left: 10,
        top: 20,
        width: 40,
        height: 20,
      } as DOMRect);

      service.toggleFromEvent({
        clientX: 0,
        clientY: 0,
        currentTarget: targetEl,
      } as unknown as MouseEvent);

      expect(document.documentElement.style.getPropertyValue('--theme-x')).toBe('30px');
      expect(document.documentElement.style.getPropertyValue('--theme-y')).toBe('30px');

      // Sem evento, remove classe radial
      service.toggleFromEvent(undefined);
      expect(document.documentElement.classList.contains('theme-transition-radial')).toBe(false);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(document, 'startViewTransition', originalDescriptor);
      } else {
        Reflect.deleteProperty(document, 'startViewTransition');
      }
      document.documentElement.classList.remove('theme-transition-radial');
    }
  });

  it('commits immediately without transition when prefers-reduced-motion is active', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
    })) as unknown as typeof window.matchMedia;

    try {
      const service = TestBed.inject(ThemeService);
      service.toggleTheme();

      expect(service.isDark()).toBe(true);
      expect(document.documentElement.classList.contains('theme-transition-fallback')).toBe(false);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('handles storage errors gracefully when reading and writing theme', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked');
    });

    try {
      const service = TestBed.inject(ThemeService);
      expect(service.isDark()).toBe(false);
      expect(() => service.toggleTheme()).not.toThrow();
      expect(service.isDark()).toBe(true);
    } finally {
      getSpy.mockRestore();
      setSpy.mockRestore();
    }
  });
});
