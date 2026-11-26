import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { appConfig } from '../../../app.config';
import { AuthService } from '../../auth/auth.service';
import { UserProfile, UserRole } from '../../models/auth.model';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let fixture: ComponentFixture<Sidebar>;
  let router: Router;

  const currentRoleSignal = signal<UserRole | null>('MEDICO');
  const currentUserSignal = signal<UserProfile | null>({
    id: '22222222-2222-2222-2222-222222222222',
    email: 'medico@medicore.com',
    fullName: 'Dr. Henrique Vasconcelos',
    role: 'MEDICO',
    document: 'CRM-SP 148.920',
  });

  const authServiceMock = {
    currentUser: currentUserSignal.asReadonly(),
    currentRole: currentRoleSignal.asReadonly(),
    homeRouteByRole: signal('/dashboard').asReadonly(),
    logout: vi.fn(),
  };

  beforeEach(async () => {
    currentRoleSignal.set('MEDICO');
    authServiceMock.logout.mockClear();

    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [...appConfig.providers, { provide: AuthService, useValue: authServiceMock }],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(Sidebar);
    fixture.detectChanges();
  });

  it('renders only navigation links permitted for MEDICO role', () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('.sidebar__link') as NodeListOf<HTMLAnchorElement>,
    ).map((el) => el.textContent?.trim());

    expect(links).toEqual(['Dashboard', 'Agenda Médica', 'Receituários', 'Estoque', 'Pedidos de Compra']);
    expect(links).not.toContain('Meu Portal');
  });

  it('updates visible links reactively when role changes to PACIENTE', () => {
    currentRoleSignal.set('PACIENTE');
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('.sidebar__link') as NodeListOf<HTMLAnchorElement>,
    ).map((el) => el.textContent?.trim());

    expect(links).toEqual(['Meu Portal', 'Minhas Consultas', 'Meus Receituários']);
  });

  it('logs out and redirects to /login when clicking the logout button', () => {
    const logoutBtn = fixture.nativeElement.querySelector(
      '.sidebar__footer button',
    ) as HTMLButtonElement;
    logoutBtn.click();

    expect(authServiceMock.logout).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('renders correct links for GERENTE_ESTOQUE, RECEPCIONISTA, and empty list when unauthenticated', () => {
    currentRoleSignal.set('GERENTE_ESTOQUE');
    fixture.detectChanges();
    let links = Array.from(
      fixture.nativeElement.querySelectorAll('.sidebar__link') as NodeListOf<HTMLAnchorElement>,
    ).map((el) => el.textContent?.trim());
    expect(links).toEqual(['Estoque', 'Pedidos de Compra', 'Auditoria de Estoque']);

    currentRoleSignal.set('RECEPCIONISTA');
    fixture.detectChanges();
    links = Array.from(
      fixture.nativeElement.querySelectorAll('.sidebar__link') as NodeListOf<HTMLAnchorElement>,
    ).map((el) => el.textContent?.trim());
    expect(links).toEqual(['Dashboard', 'Agenda Médica', 'Pacientes']);

    currentRoleSignal.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.sidebar__link').length).toBe(0);
  });

  it('emits closeMobile on navigation click and focuses drawer target via focusDrawer', () => {
    const closeSpy = vi.fn();
    fixture.componentInstance.closeMobile.subscribe(closeSpy);

    const firstLink = fixture.nativeElement.querySelector('.sidebar__link') as HTMLAnchorElement;
    firstLink.click();
    expect(closeSpy).toHaveBeenCalledTimes(1);

    const closeBtn = fixture.nativeElement.querySelector(
      'button.sidebar__close-btn, .sidebar__close-btn',
    ) as HTMLElement;
    const focusSpy = vi.spyOn(closeBtn, 'focus');
    fixture.componentInstance.focusDrawer();
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });
});
