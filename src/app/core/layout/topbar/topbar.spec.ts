import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { appConfig } from '../../../app.config';
import { AuthService } from '../../auth/auth.service';
import { UserProfile } from '../../models/auth.model';
import { ThemeService } from '../../theme/theme.service';
import { BreadcrumbItem, BreadcrumbService } from '../breadcrumb/breadcrumb.service';
import { Topbar } from './topbar';

describe('Topbar', () => {
  let fixture: ComponentFixture<Topbar>;

  const currentUserSignal = signal<UserProfile | null>({
    id: '22222222-2222-2222-2222-222222222222',
    email: 'medico@medicore.com',
    fullName: 'Dr. Henrique Vasconcelos',
    role: 'MEDICO',
  });

  const authServiceMock = {
    currentUser: currentUserSignal.asReadonly(),
  };

  const themeServiceMock = {
    isDark: signal(false).asReadonly(),
    toggleTheme: vi.fn(),
  };

  const breadcrumbServiceMock = {
    items: signal<BreadcrumbItem[]>([
      { label: 'Início', route: '/dashboard', isLast: false },
      { label: 'Dashboard Clínico', route: '/dashboard', isLast: true },
    ]).asReadonly(),
  };

  beforeEach(async () => {
    currentUserSignal.set({
      id: '22222222-2222-2222-2222-222222222222',
      email: 'medico@medicore.com',
      fullName: 'Dr. Henrique Vasconcelos',
      role: 'MEDICO',
    });
    themeServiceMock.toggleTheme.mockClear();

    await TestBed.configureTestingModule({
      imports: [Topbar],
      providers: [
        ...appConfig.providers,
        { provide: AuthService, useValue: authServiceMock },
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: BreadcrumbService, useValue: breadcrumbServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Topbar);
    fixture.detectChanges();
  });

  it('renders the three floating pills with breadcrumbs, brand/unit, and user info', () => {
    const pills = fixture.nativeElement.querySelectorAll('.topbar__pill');
    expect(pills.length).toBe(3);

    const currentCrumb = fixture.nativeElement.querySelector(
      '[aria-current="page"]',
    ) as HTMLElement;
    expect(currentCrumb.textContent?.trim()).toBe('Dashboard Clínico');

    expect(fixture.nativeElement.textContent).toContain('MediCore ERP');
    expect(fixture.nativeElement.textContent).toContain('Unidade Clínica Central');
    expect(fixture.nativeElement.textContent).toContain('medico@medicore.com');
  });

  it('delegates theme switching to ThemeService with mouse coordinates when present', () => {
    const themeButton = fixture.nativeElement.querySelector(
      '.topbar__pill--actions button',
    ) as HTMLButtonElement;
    themeButton.click();

    expect(themeServiceMock.toggleTheme).toHaveBeenCalledTimes(1);

    themeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 50 }));
    expect(themeServiceMock.toggleTheme).toHaveBeenLastCalledWith({ x: 200, y: 50 });
  });

  it('emits toggleMobileMenu when clicking menu button and focuses trigger via focusMenuTrigger', () => {
    const toggleSpy = vi.fn();
    fixture.componentInstance.toggleMobileMenu.subscribe(toggleSpy);

    const menuBtn = fixture.nativeElement.querySelector(
      'button.topbar__menu-btn, .topbar__menu-btn button',
    ) as HTMLButtonElement;
    menuBtn.click();
    expect(toggleSpy).toHaveBeenCalledTimes(1);

    const focusSpy = vi.spyOn(menuBtn, 'focus');
    fixture.componentInstance.focusMenuTrigger();
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('hides user email and avatar when currentUser is null', () => {
    currentUserSignal.set(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.topbar__email')).toBeNull();
  });
});
